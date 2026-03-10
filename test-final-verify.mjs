/**
 * 最终验证脚本：
 * 1. TCP直连485网关多次读取C001的CH2/CH3/CH4
 * 2. 通过系统API通信测试多次读取同样通道
 * 3. 对比结果确认实时性和准确性
 */

import net from 'net';
import http from 'http';

const GATEWAY_IP = '58.33.106.19';
const GATEWAY_PORT = 5001;
const SLAVE_ID = 1;
const API_BASE = 'http://localhost:3000';
const CHANNELS = [
  { name: 'CH2', no: 2, id: 270002, regAddr: 0x07D4 },  // 2002 -> 0x07D2
  { name: 'CH3', no: 3, id: 270003, regAddr: 0x07D4 },  // 2004
  { name: 'CH4', no: 4, id: 270004, regAddr: 0x07D6 },  // 2006
];

// Fix register addresses
CHANNELS[0].regAddr = 0x07D2; // CH2 = 2002
CHANNELS[1].regAddr = 0x07D4; // CH3 = 2004
CHANNELS[2].regAddr = 0x07D6; // CH4 = 2006

function calculateCRC16(data) {
  let crc = 0xFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      if (crc & 1) crc = (crc >> 1) ^ 0xA001;
      else crc >>= 1;
    }
  }
  return crc;
}

function buildReadCommand(slaveId, startAddress, quantity) {
  const buf = Buffer.alloc(8);
  buf.writeUInt8(slaveId, 0);
  buf.writeUInt8(0x03, 1);
  buf.writeUInt16BE(startAddress, 2);
  buf.writeUInt16BE(quantity, 4);
  const crc = calculateCRC16(buf.slice(0, 6));
  buf.writeUInt16LE(crc, 6);
  return buf;
}

function parseModbusResponse(buffer, expectedSlaveId, expectedByteCount) {
  for (let i = 0; i < buffer.length - 4; i++) {
    if (buffer[i] !== expectedSlaveId) continue;
    if (buffer[i + 1] !== 0x03) continue;
    if (buffer[i + 2] !== expectedByteCount) continue;
    const frameLen = 3 + expectedByteCount + 2;
    if (i + frameLen > buffer.length) continue;
    const frame = buffer.slice(i, i + frameLen);
    const dataWithoutCRC = frame.slice(0, frame.length - 2);
    const expectedCRC = calculateCRC16(dataWithoutCRC);
    const actualCRC = frame.readUInt16LE(frame.length - 2);
    if (expectedCRC !== actualCRC) continue;
    const regs = [];
    for (let j = 0; j < expectedByteCount; j += 2) {
      regs.push(frame.readUInt16BE(3 + j));
    }
    return regs;
  }
  return null;
}

function registersToInt32(high, low) {
  const buf = Buffer.alloc(4);
  buf.writeUInt16BE(high, 0);
  buf.writeUInt16BE(low, 2);
  return buf.readInt32BE(0);
}

// TCP直连读取单个通道
function tcpReadChannel(channelNo) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let buffer = Buffer.alloc(0);
    const startAddr = 0x07D0 + (channelNo - 1) * 2;
    
    socket.setTimeout(5000, () => { socket.destroy(); reject(new Error('timeout')); });
    socket.on('error', (err) => { reject(err); });
    socket.on('data', (data) => { buffer = Buffer.concat([buffer, data]); });
    
    socket.connect(GATEWAY_PORT, GATEWAY_IP, async () => {
      await new Promise(r => setTimeout(r, 100));
      buffer = Buffer.alloc(0);
      const cmd = buildReadCommand(SLAVE_ID, startAddr, 2);
      socket.write(cmd);
      
      setTimeout(() => {
        const regs = parseModbusResponse(buffer, SLAVE_ID, 4);
        socket.destroy();
        if (regs && regs.length >= 2) {
          resolve(registersToInt32(regs[0], regs[1]));
        } else {
          reject(new Error('parse failed'));
        }
      }, 500);
    });
  });
}

// 通过API登录获取cookie
async function login() {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ username: 'admin', password: 'admin123' });
    const req = http.request(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) },
    }, (res) => {
      const cookies = res.headers['set-cookie'];
      let cookie = '';
      if (cookies) {
        for (const c of cookies) {
          if (c.includes('app_session_id')) {
            cookie = c.split(';')[0];
            break;
          }
        }
      }
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve(cookie));
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// 通过API通信测试读取通道
async function apiTestRead(channelId, cookie) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ json: { channelId } });
    const req = http.request(`${API_BASE}/api/trpc/channels.testRead`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Cookie': cookie,
      },
    }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve(parsed.result?.data?.json || parsed.result?.data || parsed);
        } catch (e) {
          reject(new Error('parse error: ' + body.substring(0, 200)));
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function main() {
  console.log('=== 最终验证：通信测试实时性确认 ===\n');
  
  // 登录
  const cookie = await login();
  if (!cookie) {
    console.error('登录失败');
    process.exit(1);
  }
  console.log('登录成功\n');
  
  const ROUNDS = 5;
  const tcpResults = { CH2: [], CH3: [], CH4: [] };
  const apiResults = { CH2: [], CH3: [], CH4: [] };
  
  // Step 1: TCP直连读取
  console.log('--- Step 1: TCP直连485网关读取 ---');
  for (let i = 0; i < ROUNDS; i++) {
    for (const ch of CHANNELS) {
      try {
        const val = await tcpReadChannel(ch.no);
        tcpResults[ch.name].push(val);
        console.log(`  Round ${i+1} ${ch.name}: ${val}`);
      } catch (e) {
        console.log(`  Round ${i+1} ${ch.name}: ERROR - ${e.message}`);
        tcpResults[ch.name].push(null);
      }
    }
    if (i < ROUNDS - 1) await new Promise(r => setTimeout(r, 500));
  }
  
  console.log('\n--- Step 2: API通信测试按钮读取 ---');
  for (let i = 0; i < ROUNDS; i++) {
    for (const ch of CHANNELS) {
      try {
        const result = await apiTestRead(ch.id, cookie);
        const val = result.rawValue !== undefined ? result.rawValue : result.calibratedValue;
        apiResults[ch.name].push(result);
        console.log(`  Round ${i+1} ${ch.name}: raw=${result.rawValue}, calibrated=${result.calibratedValue}, success=${result.success}`);
      } catch (e) {
        console.log(`  Round ${i+1} ${ch.name}: ERROR - ${e.message}`);
        apiResults[ch.name].push(null);
      }
    }
    if (i < ROUNDS - 1) await new Promise(r => setTimeout(r, 500));
  }
  
  // Step 3: 对比分析
  console.log('\n=== 对比分析 ===');
  for (const ch of CHANNELS) {
    const tcpVals = tcpResults[ch.name].filter(v => v !== null);
    const apiVals = apiResults[ch.name].filter(v => v !== null).map(v => v.rawValue);
    
    const tcpMin = Math.min(...tcpVals);
    const tcpMax = Math.max(...tcpVals);
    const tcpAvg = (tcpVals.reduce((a, b) => a + b, 0) / tcpVals.length).toFixed(2);
    
    const apiMin = Math.min(...apiVals);
    const apiMax = Math.max(...apiVals);
    const apiAvg = (apiVals.reduce((a, b) => a + b, 0) / apiVals.length).toFixed(2);
    
    const apiUnique = new Set(apiVals).size;
    const isRealtime = apiUnique > 1 || (apiMax - apiMin === 0 && tcpMax - tcpMin <= 2);
    
    console.log(`\n${ch.name}:`);
    console.log(`  TCP直连: 范围 ${tcpMin} ~ ${tcpMax}, 平均 ${tcpAvg}`);
    console.log(`  API通信: 范围 ${apiMin} ~ ${apiMax}, 平均 ${apiAvg}`);
    console.log(`  API不同值数: ${apiUnique}/${ROUNDS}`);
    console.log(`  同一量级: ${Math.abs(parseFloat(tcpAvg) - parseFloat(apiAvg)) < Math.max(Math.abs(parseFloat(tcpAvg)) * 0.1, 50) ? '是' : '否'}`);
    console.log(`  实时性确认: ${isRealtime ? '✅ 是实时读取' : '⚠️ 需要进一步确认'}`);
  }
}

main().catch(console.error);
