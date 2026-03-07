/**
 * Modbus-RTU 协议处理模块
 * 用于与称重仪表通信
 */

/**
 * 计算 CRC16 校验码
 */
export function calculateCRC16(data: Buffer): number {
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
 * 构建 Modbus RTU 读保持寄存器命令
 * @param slaveId 从机地址 (1-247)
 * @param startAddress 起始寄存器地址
 * @param quantity 读取寄存器数量
 */
export function buildReadHoldingRegistersCommand(
  slaveId: number,
  startAddress: number,
  quantity: number
): Buffer {
  const buffer = Buffer.alloc(6);
  buffer[0] = slaveId;           // 从机地址
  buffer[1] = 0x03;              // 功能码：读保持寄存器
  buffer.writeUInt16BE(startAddress, 2);  // 起始地址
  buffer.writeUInt16BE(quantity, 4);      // 寄存器数量
  
  // 计算 CRC
  const crc = calculateCRC16(buffer);
  const crcBuffer = Buffer.alloc(8);
  crcBuffer.writeUInt8(slaveId, 0);
  crcBuffer.writeUInt8(0x03, 1);
  crcBuffer.writeUInt16BE(startAddress, 2);
  crcBuffer.writeUInt16BE(quantity, 4);
  crcBuffer.writeUInt16LE(crc, 6);  // CRC 低字节在前
  
  return crcBuffer;
}

/**
 * 解析 Modbus RTU 读保持寄存器响应
 * @param buffer 响应数据
 * @returns 寄存器值数组，如果校验失败返回 null
 */
export function parseReadHoldingRegistersResponse(buffer: Buffer): number[] | null {
  if (buffer.length < 5) {
    return null;  // 数据太短
  }
  
  const slaveId = buffer[0];
  const functionCode = buffer[1];
  const byteCount = buffer[2];
  
  if (functionCode !== 0x03) {
    return null;  // 功能码错误
  }
  
  if (buffer.length < 5 + byteCount) {
    return null;  // 数据不完整
  }
  
  // 验证 CRC
  const dataWithoutCRC = buffer.slice(0, buffer.length - 2);
  const expectedCRC = calculateCRC16(dataWithoutCRC);
  const actualCRC = buffer.readUInt16LE(buffer.length - 2);
  
  if (expectedCRC !== actualCRC) {
    return null;  // CRC 校验失败
  }
  
  // 解析寄存器值
  const registers: number[] = [];
  for (let i = 0; i < byteCount; i += 2) {
    const value = buffer.readUInt16BE(3 + i);
    registers.push(value);
  }
  
  return registers;
}

/**
 * 将两个 16 位寄存器转换为 32 位浮点数（IEEE 754）
 * @param high 高位寄存器
 * @param low 低位寄存器
 */
export function registersToFloat(high: number, low: number): number {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt16BE(high, 0);
  buffer.writeUInt16BE(low, 2);
  return buffer.readFloatBE(0);
}

/**
 * 将两个 16 位寄存器转换为 32 位有符号整数
 * @param high 高位寄存器
 * @param low 低位寄存器
 */
export function registersToInt32(high: number, low: number): number {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt16BE(high, 0);
  buffer.writeUInt16BE(low, 2);
  return buffer.readInt32BE(0);
}
