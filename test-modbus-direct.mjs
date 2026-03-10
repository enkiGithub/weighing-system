/**
 * 直接通过TCP连接485网关，发送Modbus RTU指令读取仪表C001的通道数据
 * 用于验证通信测试功能的正确性
 */
import net from 'net';

const GATEWAY_IP = '58.33.106.19';
const GATEWAY_PORT = 5001;
const SLAVE_ID = 1;  // C001 的从站地址
const BASE_ADDRESS = 0x07D0;  // 2000, DY7004 毛重寄存器起始地址
const TOTAL_REGISTERS = 8;    // 4个通道 × 2个寄存器

// CRC16 计算
function calculateCRC16(data) {
  let crc = 0xFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      if (crc & 1) {
        crc = (crc >> 1) ^ 0xA001;
      } else {
        crc >>= 1;
      }
    }
  }
  return crc;
}

// 构建 Modbus RTU 读保持寄存器命令
function buildReadCommand(slaveId, startAddress, quantity) {
  const buffer = Buffer.alloc(8);
  buffer.writeUInt8(slaveId, 0);
  buffer.writeUInt8(0x03, 1);
  buffer.writeUInt16BE(startAddress, 2);
  buffer.writeUInt16BE(quantity, 4);
  const crc = calculateCRC16(buffer.slice(0, 6));
  buffer.writeUInt16LE(crc, 6);
  return buffer;
}

// 解析响应
function parseResponse(buffer, expectedSlaveId, expectedByteCount) {
  // 在buffer中搜索有效的Modbus响应帧
  for (let offset = 0; offset <= buffer.length - 5; offset++) {
    if (buffer[offset] !== expectedSlaveId) continue;
    if (buffer[offset + 1] !== 0x03) continue;
    const byteCount = buffer[offset + 2];
    if (byteCount !== expectedByteCount) continue;
    
    const frameLen = 3 + byteCount + 2;
    if (offset + frameLen > buffer.length) continue;
    
    const frame = buffer.slice(offset, offset + frameLen);
    const dataWithoutCRC = frame.slice(0, frame.length - 2);
    const expectedCRC = calculateCRC16(dataWithoutCRC);
    const actualCRC = frame.readUInt16LE(frame.length - 2);
    
    if (expectedCRC !== actualCRC) continue;
    
    // CRC校验通过，解析寄存器值
    const registers = [];
    for (let i = 0; i < byteCount; i += 2) {
      registers.push(frame.readUInt16BE(3 + i));
    }
    return registers;
  }
  return null;
}

// 两个寄存器转32位有符号整数
function registersToInt32(high, low) {
  const buf = Buffer.alloc(4);
  buf.writeUInt16BE(high, 0);
  buf.writeUInt16BE(low, 2);
  return buf.readInt32BE(0);
}

// 单次读取
function readOnce(readIndex) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    socket.setTimeout(5000);
    
    let responseData = Buffer.alloc(0);
    let resolved = false;
    
    socket.connect(GATEWAY_PORT, GATEWAY_IP, () => {
      // 先等待一下清空可能的背景数据
      setTimeout(() => {
        responseData = Buffer.alloc(0);  // 清空之前收到的数据
        const command = buildReadCommand(SLAVE_ID, BASE_ADDRESS, TOTAL_REGISTERS);
        socket.write(command);
        
        // 等待响应
        setTimeout(() => {
          if (resolved) return;
          const expectedByteCount = TOTAL_REGISTERS * 2;
          const registers = parseResponse(responseData, SLAVE_ID, expectedByteCount);
          
          if (registers && registers.length >= TOTAL_REGISTERS) {
            const results = {};
            for (let ch = 1; ch <= 4; ch++) {
              const regIdx = (ch - 1) * 2;
              const rawValue = registersToInt32(registers[regIdx], registers[regIdx + 1]);
              // scale=1, offset=0
              results[`CH${ch}`] = { rawValue, calibratedValue: rawValue };
            }
            resolved = true;
            socket.destroy();
            resolve(results);
          } else {
            resolved = true;
            socket.destroy();
            reject(new Error(`第${readIndex}次读取：响应解析失败，收到 ${responseData.length} 字节: ${responseData.toString('hex')}`));
          }
        }, 500);
      }, 200);
    });
    
    socket.on('data', (data) => {
      responseData = Buffer.concat([responseData, data]);
    });
    
    socket.on('timeout', () => {
      if (!resolved) {
        resolved = true;
        socket.destroy();
        reject(new Error(`第${readIndex}次读取：连接超时`));
      }
    });
    
    socket.on('error', (err) => {
      if (!resolved) {
        resolved = true;
        reject(new Error(`第${readIndex}次读取：${err.message}`));
      }
    });
  });
}

// 主函数：多次读取
async function main() {
  const READ_COUNT = 5;
  const allResults = [];
  
  console.log(`\n=== 直接TCP连接 ${GATEWAY_IP}:${GATEWAY_PORT} 读取仪表C001 (slaveId=${SLAVE_ID}) ===`);
  console.log(`寄存器地址: 0x${BASE_ADDRESS.toString(16)} (${BASE_ADDRESS}), 读取 ${TOTAL_REGISTERS} 个寄存器`);
  console.log(`读取次数: ${READ_COUNT}\n`);
  
  for (let i = 1; i <= READ_COUNT; i++) {
    try {
      const result = await readOnce(i);
      allResults.push(result);
      console.log(`第${i}次读取: CH1=${result.CH1.calibratedValue}, CH2=${result.CH2.calibratedValue}, CH3=${result.CH3.calibratedValue}, CH4=${result.CH4.calibratedValue}`);
    } catch (err) {
      console.error(err.message);
    }
    // 间隔1秒
    await new Promise(r => setTimeout(r, 1000));
  }
  
  // 统计各通道的范围
  if (allResults.length > 0) {
    console.log('\n=== 统计结果 ===');
    for (let ch = 2; ch <= 4; ch++) {
      const values = allResults.map(r => r[`CH${ch}`].calibratedValue);
      const min = Math.min(...values);
      const max = Math.max(...values);
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      console.log(`CH${ch}: 最小值=${min}, 最大值=${max}, 平均值=${avg.toFixed(2)}, 范围=${max - min}`);
    }
  }
}

main().catch(console.error);
