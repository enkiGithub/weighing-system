# 10 — 硬件集成指南

## 硬件架构

```
保险柜称重传感器
    │ 模拟信号
    ▼
DY7001/DY7004 称重仪表  ← Modbus RTU 从站
    │ RS485 总线
    ▼
ZLAN6808 串口服务器  ← 8路RS485转TCP/IP网关
    │ TCP/IP
    ▼
采集服务（Node.js / Python）  ← 需要开发
    │ MySQL / tRPC API
    ▼
称重系统管理平台（本系统）
```

## 设备型号与参数

### DY7001 单通道称重仪表

| 参数 | 值 |
|------|-----|
| 通道数 | 1（CH1） |
| 通信协议 | Modbus RTU |
| 波特率 | 9600（默认） |
| 数据位 | 8 |
| 停止位 | 1 |
| 校验 | None |
| 从站地址 | 1~247（可设置） |

### DY7004 四通道称重仪表

| 参数 | 值 |
|------|-----|
| 通道数 | 4（CH1~CH4） |
| 通信协议 | Modbus RTU |
| 波特率 | 9600（默认） |
| 数据位 | 8 |
| 停止位 | 1 |
| 校验 | None |
| 从站地址 | 1~247（可设置） |

### ZLAN6808 串口服务器

| 参数 | 值 |
|------|-----|
| 串口数量 | 8 路 RS485 |
| 网络接口 | 1 × RJ45 以太网 |
| 工作模式 | TCP Server / TCP Client |
| 默认 IP | 192.168.1.200 |
| 默认端口 | 4001~4008（对应 COM1~COM8） |

## Modbus RTU 寄存器地址（DY7004 参考）

> 以下寄存器地址需要根据 DY7004 实际手册确认，此处为常见称重仪表的典型配置。

| 功能 | 功能码 | 起始地址 | 寄存器数 | 数据类型 | 说明 |
|------|--------|----------|----------|----------|------|
| 读取 CH1 重量 | 03 | 0x0000 | 2 | Float32 | 通道1当前重量 |
| 读取 CH2 重量 | 03 | 0x0002 | 2 | Float32 | 通道2当前重量 |
| 读取 CH3 重量 | 03 | 0x0004 | 2 | Float32 | 通道3当前重量 |
| 读取 CH4 重量 | 03 | 0x0008 | 2 | Float32 | 通道4当前重量 |
| 读取仪表状态 | 03 | 0x0010 | 1 | UINT16 | 0=正常, 1=过载, 2=欠载 |

**注意**：Float32 占 2 个 Modbus 寄存器（4 字节），字节序通常为 Big-Endian（ABCD），但部分仪表使用 CDAB 或 BADC，需实际测试确认。

## 采集服务开发指南

### 方案一：Node.js 采集服务（推荐）

使用 `modbus-serial` npm 包通过 TCP 连接 ZLAN6808 网关，读取 Modbus RTU 数据。

```bash
npm install modbus-serial mysql2
```

```typescript
// collector.ts — 采集服务核心逻辑（伪代码）
import ModbusRTU from 'modbus-serial';
import mysql from 'mysql2/promise';

interface GatewayConfig {
  ip: string;
  port: number;
  comPort: string;
  instruments: Array<{
    slaveId: number;
    modelType: 'DY7001' | 'DY7004';
    channels: Array<{ channelNo: number; channelId: number }>;
  }>;
}

async function pollInstrument(client: ModbusRTU, instrument: GatewayConfig['instruments'][0]) {
  client.setID(instrument.slaveId);
  
  const channelCount = instrument.modelType === 'DY7004' ? 4 : 1;
  
  for (let ch = 0; ch < channelCount; ch++) {
    try {
      // 读取2个寄存器（Float32）
      const data = await client.readHoldingRegisters(ch * 2, 2);
      const buffer = Buffer.alloc(4);
      buffer.writeUInt16BE(data.data[0], 0);
      buffer.writeUInt16BE(data.data[1], 2);
      const weight = buffer.readFloatBE(0);
      
      // 写入数据库
      await updateChannelValue(instrument.channels[ch].channelId, weight);
    } catch (err) {
      console.error(`读取仪表 ${instrument.slaveId} CH${ch+1} 失败:`, err);
    }
  }
}

async function updateChannelValue(channelId: number, value: number) {
  await db.execute(
    'UPDATE instrumentChannels SET currentValue = ?, lastReadAt = NOW() WHERE id = ?',
    [value, channelId]
  );
}

// 主循环
async function main() {
  // 从数据库读取网关和仪表配置
  const configs = await loadConfigs();
  
  for (const gateway of configs) {
    const client = new ModbusRTU();
    await client.connectTCP(gateway.ip, { port: gateway.port });
    client.setTimeout(1000);
    
    // 轮询循环
    setInterval(async () => {
      for (const instrument of gateway.instruments) {
        await pollInstrument(client, instrument);
      }
      // 更新柜组重量
      await recalculateGroupWeights();
    }, 1000); // 1秒轮询间隔
  }
}
```

### 方案二：Python 采集服务

使用 `pymodbus` 库：

```bash
pip install pymodbus mysql-connector-python
```

### 采集服务与 Web 系统的集成方式

| 方式 | 说明 | 适用场景 |
|------|------|----------|
| **直接写数据库** | 采集服务直接 UPDATE MySQL | 最简单，推荐初期使用 |
| **HTTP API** | 采集服务调用 tRPC mutation | 需要新增 API endpoint |
| **WebSocket** | 采集服务推送到 Web 服务器 | 需要实现 WebSocket（见 08 文档） |

**推荐初期方案**：采集服务直接写数据库（方式一），Web 前端通过 HTTP 轮询（已实现的 tRPC Query）读取最新数据。后续再升级为 WebSocket 实时推送。

### 采集服务需要更新的数据库字段

```sql
-- 更新通道当前值
UPDATE instrumentChannels 
SET currentValue = ?, lastReadAt = NOW(), updatedAt = NOW() 
WHERE id = ?;

-- 更新仪表心跳
UPDATE weighingInstruments 
SET status = 'online', lastHeartbeat = NOW(), updatedAt = NOW() 
WHERE id = ?;

-- 更新网关心跳
UPDATE gateways 
SET status = 'online', lastHeartbeat = NOW(), updatedAt = NOW() 
WHERE id = ?;

-- 重新计算柜组重量（基于绑定通道）
UPDATE cabinetGroups cg
SET currentWeight = (
  SELECT COALESCE(SUM(ic.currentValue * gcb.coefficient + gcb.offset), 0)
  FROM groupChannelBindings gcb
  JOIN instrumentChannels ic ON ic.id = gcb.channelId
  WHERE gcb.groupId = cg.id AND gcb.enabled = 1
), updatedAt = NOW()
WHERE cg.id = ?;

-- 检查报警阈值
-- 如果 |currentWeight - previousWeight| > alarmThreshold，插入报警记录
```

## 通信调试工具

| 工具 | 用途 | 获取方式 |
|------|------|----------|
| **Modbus Poll** | Windows Modbus 主站模拟器 | 商业软件 |
| **QModMaster** | 开源 Modbus 主站调试工具 | GitHub |
| **sscom** | 串口调试助手 | 免费 |
| **Wireshark** | TCP 抓包分析 | 开源 |
| **mbpoll** | Linux 命令行 Modbus 工具 | `apt install mbpoll` |

### 使用 mbpoll 测试连接

```bash
# 安装
sudo apt install mbpoll

# 通过TCP连接网关，读取从站1的寄存器0~3（CH1重量）
mbpoll -a 1 -r 0 -c 4 -t 3 -1 192.168.1.200:4001
```
