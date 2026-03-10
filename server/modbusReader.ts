/**
 * Modbus RTU 实时读取模块
 * 用于通信测试按钮：通过 TCP 连接 485 网关，发送 Modbus 命令实时读取仪表通道数据
 */

import { Socket } from 'net';

/**
 * 计算 CRC16 校验码（Modbus RTU 标准）
 */
function calculateCRC16(data: Buffer): number {
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

/**
 * 构建 Modbus RTU 读保持寄存器命令 (FC03)
 */
function buildReadCommand(slaveId: number, startAddress: number, quantity: number): Buffer {
  const buffer = Buffer.alloc(8);
  buffer.writeUInt8(slaveId, 0);
  buffer.writeUInt8(0x03, 1);
  buffer.writeUInt16BE(startAddress, 2);
  buffer.writeUInt16BE(quantity, 4);
  const crc = calculateCRC16(buffer.slice(0, 6));
  buffer.writeUInt16LE(crc, 6);
  return buffer;
}

/**
 * 解析 Modbus RTU 响应，提取寄存器值
 */
function parseResponse(buffer: Buffer, expectedSlaveId: number, expectedByteCount: number): number[] | null {
  // 扫描缓冲区找到匹配的响应帧
  for (let i = 0; i < buffer.length - 4; i++) {
    const slaveId = buffer[i];
    const funcCode = buffer[i + 1];

    if (funcCode !== 0x03) continue;
    if (slaveId !== expectedSlaveId) continue;

    const byteCount = buffer[i + 2];
    if (byteCount !== expectedByteCount) continue;

    const frameLength = 3 + byteCount + 2;
    if (i + frameLength > buffer.length) continue;

    const frame = buffer.slice(i, i + frameLength);

    // 验证 CRC
    const dataWithoutCRC = frame.slice(0, frame.length - 2);
    const expectedCRC = calculateCRC16(dataWithoutCRC);
    const actualCRC = frame.readUInt16LE(frame.length - 2);
    if (expectedCRC !== actualCRC) continue;

    // 解析寄存器值
    const registers: number[] = [];
    for (let j = 0; j < byteCount; j += 2) {
      registers.push(frame.readUInt16BE(3 + j));
    }
    return registers;
  }
  return null;
}

/**
 * 将两个 16 位寄存器转换为 32 位有符号整数
 */
function registersToInt32(high: number, low: number): number {
  const buf = Buffer.alloc(4);
  buf.writeUInt16BE(high, 0);
  buf.writeUInt16BE(low, 2);
  return buf.readInt32BE(0);
}

/**
 * DY7004/DY7001 通道寄存器地址映射
 * CH1: 0x07D0 (2000), CH2: 0x07D2 (2002), CH3: 0x07D4 (2004), CH4: 0x07D6 (2006)
 */
function getChannelRegisterAddress(channelNo: number): number {
  return 0x07D0 + (channelNo - 1) * 2;
}

export interface ModbusReadResult {
  success: boolean;
  rawValue: number;
  calibratedValue: number;
  unit: string;
  message?: string;
}

export interface ChannelConfig {
  channelNo: number;
  scale: number;
  offset: number;
  precision: number;
  unit: string;
}

export interface ComPortConfig {
  ipAddress: string;
  networkPort: number;
  timeoutMs: number;
}

/**
 * 实时读取单个通道的仪表数据
 * 建立临时 TCP 连接 → 发送 Modbus 命令 → 解析响应 → 关闭连接
 */
export async function readChannelRealtime(
  comPort: ComPortConfig,
  slaveId: number,
  channel: ChannelConfig
): Promise<ModbusReadResult> {
  return new Promise((resolve) => {
    const socket = new Socket();
    let buffer = Buffer.alloc(0);
    let resolved = false;

    const cleanup = () => {
      if (!resolved) {
        resolved = true;
      }
      try {
        socket.destroy();
      } catch (_) {}
    };

    // 总超时
    const totalTimeout = setTimeout(() => {
      cleanup();
      resolve({
        success: false,
        rawValue: 0,
        calibratedValue: 0,
        unit: channel.unit,
        message: `通信超时：无法在 ${comPort.timeoutMs}ms 内获取响应`,
      });
    }, comPort.timeoutMs + 3000); // 连接时间 + 读取超时

    socket.on('error', (err) => {
      clearTimeout(totalTimeout);
      cleanup();
      resolve({
        success: false,
        rawValue: 0,
        calibratedValue: 0,
        unit: channel.unit,
        message: `连接失败：${err.message}`,
      });
    });

    socket.on('data', (data) => {
      buffer = Buffer.concat([buffer, data]);
    });

    // 连接超时
    socket.setTimeout(3000, () => {
      clearTimeout(totalTimeout);
      cleanup();
      resolve({
        success: false,
        rawValue: 0,
        calibratedValue: 0,
        unit: channel.unit,
        message: `TCP 连接超时：${comPort.ipAddress}:${comPort.networkPort}`,
      });
    });

    socket.connect(comPort.networkPort, comPort.ipAddress, async () => {
      try {
        // 连接成功，等待一小段时间清空背景数据
        await new Promise(r => setTimeout(r, 100));
        buffer = Buffer.alloc(0);

        // 构建读取命令：读取该通道的 2 个寄存器
        const startAddress = getChannelRegisterAddress(channel.channelNo);
        const command = buildReadCommand(slaveId, startAddress, 2);

        // 发送命令
        socket.write(command);

        // 等待响应
        const readTimeout = comPort.timeoutMs || 1000;
        const startTime = Date.now();
        const expectedByteCount = 4; // 2个寄存器 × 2字节

        const checkInterval = setInterval(() => {
          if (Date.now() - startTime > readTimeout) {
            clearInterval(checkInterval);
            clearTimeout(totalTimeout);
            cleanup();
            resolve({
              success: false,
              rawValue: 0,
              calibratedValue: 0,
              unit: channel.unit,
              message: '读取响应超时',
            });
            return;
          }

          if (buffer.length < 5) return;

          const registers = parseResponse(buffer, slaveId, expectedByteCount);
          if (registers && registers.length >= 2) {
            clearInterval(checkInterval);
            clearTimeout(totalTimeout);

            // 两个16位寄存器组合为32位有符号整数
            const rawValue = registersToInt32(registers[0], registers[1]);
            // 应用校准系数
            const calibratedValue = parseFloat((rawValue * channel.scale + channel.offset).toFixed(channel.precision));

            cleanup();
            resolve({
              success: true,
              rawValue,
              calibratedValue,
              unit: channel.unit,
            });
          }
        }, 20);

      } catch (err) {
        clearTimeout(totalTimeout);
        cleanup();
        resolve({
          success: false,
          rawValue: 0,
          calibratedValue: 0,
          unit: channel.unit,
          message: `读取失败：${err instanceof Error ? err.message : String(err)}`,
        });
      }
    });
  });
}
