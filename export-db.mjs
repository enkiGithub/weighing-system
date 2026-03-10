/**
 * 从云端数据库导出所有表结构和数据为SQL文件
 * 兼容MySQL 8.0导入
 */
import mysql from 'mysql2/promise';
import fs from 'fs';

const DB_URL = process.env.DATABASE_URL;

async function main() {
  const conn = await mysql.createConnection(DB_URL);
  
  // 获取所有表
  const [tables] = await conn.query('SHOW TABLES');
  const dbName = Object.keys(tables[0])[0];
  const tableNames = tables.map(t => t[dbName]);
  
  console.log(`找到 ${tableNames.length} 张表:`, tableNames.join(', '));
  
  let sql = '';
  sql += '-- 云端数据库导出\n';
  sql += '-- 生成时间: ' + new Date().toISOString() + '\n';
  sql += 'SET NAMES utf8mb4;\n';
  sql += 'SET FOREIGN_KEY_CHECKS = 0;\n\n';
  
  for (const tableName of tableNames) {
    console.log(`导出表: ${tableName}`);
    
    // 获取建表语句
    const [createResult] = await conn.query(`SHOW CREATE TABLE \`${tableName}\``);
    let createSQL = createResult[0]['Create Table'];
    
    // 移除 TiDB 特有的语法（如 /*T![clustered_index] ... */ 注释）
    createSQL = createSQL.replace(/\/\*T!\[.*?\]\s*.*?\*\//g, '');
    // 移除 TiDB 的 AUTO_ID_CACHE 等
    createSQL = createSQL.replace(/\/\*.*?AUTO_ID_CACHE.*?\*\//g, '');
    // 移除 TiDB 的 SHARD_ROW_ID_BITS
    createSQL = createSQL.replace(/\/\*.*?SHARD_ROW_ID_BITS.*?\*\//g, '');
    
    sql += `-- ----------------------------\n`;
    sql += `-- Table: ${tableName}\n`;
    sql += `-- ----------------------------\n`;
    sql += `DROP TABLE IF EXISTS \`${tableName}\`;\n`;
    sql += createSQL + ';\n\n';
    
    // 获取数据
    const [rows] = await conn.query(`SELECT * FROM \`${tableName}\``);
    if (rows.length > 0) {
      console.log(`  - ${rows.length} 行数据`);
      
      // 获取列名
      const columns = Object.keys(rows[0]);
      const colList = columns.map(c => `\`${c}\``).join(', ');
      
      // 分批生成INSERT语句（每100行一批）
      const batchSize = 100;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const values = batch.map(row => {
          const vals = columns.map(col => {
            const val = row[col];
            if (val === null || val === undefined) return 'NULL';
            if (val instanceof Date) return `'${val.toISOString().slice(0, 19).replace('T', ' ')}'`;
            if (typeof val === 'number') return val.toString();
            if (typeof val === 'boolean') return val ? '1' : '0';
            if (Buffer.isBuffer(val)) return `X'${val.toString('hex')}'`;
            // 转义字符串
            const escaped = String(val).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r');
            return `'${escaped}'`;
          });
          return `(${vals.join(', ')})`;
        });
        sql += `INSERT INTO \`${tableName}\` (${colList}) VALUES\n${values.join(',\n')};\n`;
      }
      sql += '\n';
    } else {
      console.log(`  - 0 行数据`);
    }
  }
  
  sql += 'SET FOREIGN_KEY_CHECKS = 1;\n';
  
  // 写入文件
  fs.writeFileSync('/home/ubuntu/weighing-system/cloud-db-export.sql', sql, 'utf8');
  console.log(`\n导出完成: cloud-db-export.sql (${(sql.length / 1024).toFixed(1)} KB)`);
  
  await conn.end();
}

main().catch(err => {
  console.error('导出失败:', err);
  process.exit(1);
});
