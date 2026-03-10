/**
 * 验证脚本：对比 TCP 直连读取 vs 通信测试 API 读取
 * 步骤1：TCP 直连 58.33.106.19:5001 读取 C001 的 CH2/CH3/CH4 各5次
 * 步骤2：通过系统 API 调用通信测试读取 CH2/CH3/CH4 各5次
 * 步骤3：对比两者结果
 */

import net from 'net';

// ========== Modbus 工具函数 ==========
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

function parseResponse(buffer, expectedSlaveId, expectedByteCount) {
  for (let i = 0; i < buffer.length - 4; i++) {
    if (buffer[i + 1] !== 0x03) continue;
    if (buffer[i] !== expectedSlaveId) continue;
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

// ========== TCP 直连读取 ==========
async function tcpDirectRead(host, port, slaveId, channelNo) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let buffer = Buffer.alloc(0);
    
    const timeout = setTimeout(() => {
      socket.destroy();
      resolve({ success: false, error: 'timeout' });
    }, 5000);

    socket.on('error', (err) => {
      clearTimeout(timeout);
      socket.destroy();
      resolve({ success: false, error: err.message });
    });

    socket.on('data', (data) => {
      buffer = Buffer.concat([buffer, data]);
    });

    socket.connect(port, host, async () => {
      await new Promise(r => setTimeout(r, 100));
      buffer = Buffer.alloc(0);
      
      const startAddr = 0x07D0 + (channelNo - 1) * 2;
      const cmd = buildReadCommand(slaveId, startAddr, 2);
      socket.write(cmd);

      // 等待响应
      const startTime = Date.now();
      const check = setInterval(() => {
        if (Date.now() - startTime > 2000) {
          clearInterval(check);
          clearTimeout(timeout);
          socket.destroy();
          resolve({ success: false, error: 'read timeout' });
          return;
        }
        if (buffer.length >= 5) {
          const regs = parseResponse(buffer, slaveId, 4);
          if (regs && regs.length >= 2) {
            clearInterval(check);
            clearTimeout(timeout);
            const rawValue = registersToInt32(regs[0], regs[1]);
            socket.destroy();
            resolve({ success: true, rawValue });
          }
        }
      }, 20);
    });
  });
}

// ========== 系统 API 通信测试 ==========
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function login() {
  const resp = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  });
  const cookies = resp.headers.getSetCookie?.() || [];
  const sessionCookie = cookies.find(c => c.startsWith('app_session_id='));
  if (!sessionCookie) throw new Error('登录失败，无法获取session cookie');
  return sessionCookie.split(';')[0];
}

async function apiTestRead(cookie, channelId) {
  const resp = await fetch(`${BASE_URL}/api/trpc/channels.testRead`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookie,
    },
    body: JSON.stringify({ json: { channelId } }),
  });
  const data = await resp.json();
  if (data.result?.data?.json) {
    return data.result.data.json;
  }
  return { success: false, error: 'unexpected response format' };
}

// ========== 主流程 ==========
async function main() {
  const GATEWAY_HOST = '58.33.106.19';
  const GATEWAY_PORT = 5001;
  const SLAVE_ID = 1;
  const CHANNELS = [2, 3, 4]; // CH2, CH3, CH4
  const CHANNEL_IDS = { 2: 270002, 3: 270003, 4: 270004 }; // 数据库中的通道ID
  const ROUNDS = 5;

  console.log('=== 步骤1：TCP 直连读取 ===\n');
  const tcpResults = {};
  for (const ch of CHANNELS) {
    tcpResults[ch] = [];
    for (let i = 0; i < ROUNDS; i++) {
      const result = await tcpDirectRead(GATEWAY_HOST, GATEWAY_PORT, SLAVE_ID, ch);
      if (result.success) {
        tcpResults[ch].push(result.rawValue);
        console.log(`  TCP 直连 CH${ch} 第${i+1}次: rawValue = ${result.rawValue}`);
      } else {
        console.log(`  TCP 直连 CH${ch} 第${i+1}次: 失败 - ${result.error}`);
      }
      await new Promise(r => setTimeout(r, 300));
    }
  }

  console.log('\n=== 步骤2：系统 API 通信测试 ===\n');
  let cookie;
  try {
    cookie = await login();
    console.log('  登录成功\n');
  } catch (err) {
    console.error('  登录失败:', err.message);
    return;
  }

  const apiResults = {};
  for (const ch of CHANNELS) {
    apiResults[ch] = [];
    for (let i = 0; i < ROUNDS; i++) {
      const result = await apiTestRead(cookie, CHANNEL_IDS[ch]);
      if (result.success) {
        apiResults[ch].push({ rawValue: result.rawValue, calibratedValue: result.calibratedValue });
        console.log(`  API 通信测试 CH${ch} 第${i+1}次: rawValue = ${result.rawValue}, calibratedValue = ${result.calibratedValue} ${result.unit}`);
      } else {
        console.log(`  API 通信测试 CH${ch} 第${i+1}次: 失败 - ${result.message || result.error}`);
      }
      await new Promise(r => setTimeout(r, 500)); // API调用间隔稍长，因为每次都建立TCP连接
    }
  }

  console.log('\n=== 步骤3：对比分析 ===\n');
  for (const ch of CHANNELS) {
    const tcp = tcpResults[ch];
    const api = apiResults[ch].map(r => r.rawValue);
    
    if (tcp.length === 0 || api.length === 0) {
      console.log(`CH${ch}: 数据不足，无法对比`);
      continue;
    }

    const tcpMin = Math.min(...tcp);
    const tcpMax = Math.max(...tcp);
    const tcpAvg = (tcp.reduce((a, b) => a + b, 0) / tcp.length).toFixed(2);
    
    const apiMin = Math.min(...api);
    const apiMax = Math.max(...api);
    const apiAvg = (api.reduce((a, b) => a + b, 0) / api.length).toFixed(2);

    console.log(`CH${ch}:`);
    console.log(`  TCP 直连: min=${tcpMin}, max=${tcpMax}, avg=${tcpAvg}, 范围=${tcpMax - tcpMin}`);
    console.log(`  API 通信: min=${apiMin}, max=${apiMax}, avg=${apiAvg}, 范围=${apiMax - apiMin}`);
    
    // 判断是否在同一量级
    const overlap = !(tcpMax < apiMin - 100 || apiMax < tcpMin - 100);
    const apiValuesVary = new Set(api).size > 1;
    console.log(`  同一量级: ${overlap ? '是 ✅' : '否 ❌'}`);
    console.log(`  API值有变化: ${apiValuesVary ? '是 ✅（实时读取确认）' : '否（可能是缓存）'}`);
    console.log();
  }
}

main().catch(console.error);
