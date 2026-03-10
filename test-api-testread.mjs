/**
 * 通过系统API多次调用通信测试（testRead），读取C001的CH2/CH3/CH4
 * 模拟前端点击"通信测试"按钮的行为
 */

// 通道ID映射（从数据库查询结果）
// CH1=270001, CH2=270002, CH3=270003, CH4=270004
const CHANNELS = [
  { id: 270002, label: 'CH2' },
  { id: 270003, label: 'CH3' },
  { id: 270004, label: 'CH4' },
];

const BASE_URL = 'http://localhost:3000';
const READ_COUNT = 5;

// 先登录获取cookie
async function login() {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    redirect: 'manual',
  });
  // 获取set-cookie
  const rawHeaders = res.headers;
  let cookies = '';
  // Node.js fetch getSetCookie
  if (typeof rawHeaders.getSetCookie === 'function') {
    cookies = rawHeaders.getSetCookie().join('; ');
  } else {
    // fallback
    const setCookie = rawHeaders.get('set-cookie');
    if (setCookie) cookies = setCookie;
  }
  console.log('登录状态:', res.status, '| Cookie:', cookies ? '已获取' : '未获取');
  return cookies;
}

// 调用tRPC mutation
async function callTestRead(channelId, cookie) {
  const res = await fetch(`${BASE_URL}/api/trpc/channels.testRead`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookie,
    },
    body: JSON.stringify({ json: { channelId } }),
  });
  const data = await res.json();
  if (data.error) {
    throw new Error(JSON.stringify(data.error));
  }
  return data.result?.data?.json || data;
}

async function main() {
  console.log('=== 通过系统API调用通信测试（testRead） ===\n');
  
  // 登录
  const cookie = await login();
  if (!cookie) {
    console.error('警告：未获取到cookie，可能导致认证失败');
  }
  console.log('');
  
  const allResults = {};
  for (const ch of CHANNELS) {
    allResults[ch.label] = [];
  }
  
  for (let i = 1; i <= READ_COUNT; i++) {
    console.log(`--- 第${i}次读取 ---`);
    for (const ch of CHANNELS) {
      try {
        const result = await callTestRead(ch.id, cookie);
        allResults[ch.label].push(result);
        console.log(`  ${ch.label}: success=${result.success}, rawValue=${result.rawValue}, calibratedValue=${result.calibratedValue}, unit=${result.unit}${result.message ? ', message=' + result.message : ''}`);
      } catch (err) {
        console.error(`  ${ch.label}: 调用失败 - ${err.message}`);
      }
    }
    // 间隔1秒
    if (i < READ_COUNT) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  
  // 统计
  console.log('\n=== 统计结果 ===');
  for (const ch of CHANNELS) {
    const successResults = allResults[ch.label].filter(r => r.success);
    const failResults = allResults[ch.label].filter(r => !r.success);
    
    if (successResults.length > 0) {
      const values = successResults.map(r => r.calibratedValue);
      const min = Math.min(...values);
      const max = Math.max(...values);
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      console.log(`${ch.label}: 最小值=${min}, 最大值=${max}, 平均值=${avg.toFixed(2)}, 范围=${max - min}, 成功次数=${successResults.length}/${READ_COUNT}`);
    } else if (failResults.length > 0) {
      console.log(`${ch.label}: 全部失败, 最后一次结果:`, JSON.stringify(failResults[failResults.length - 1]));
    } else {
      console.log(`${ch.label}: 无结果`);
    }
  }
}

main().catch(console.error);
