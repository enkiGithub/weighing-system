# 数据库单位转换分析

## cabinetGroups 表
- initialWeight: 20000 → 这是 g（克），需要除以1000 → 20 kg
- currentWeight: 0 → 不需要转换
- alarmThreshold: 1~5 → 这些值看起来已经是 kg 单位（1kg, 2kg, 5kg 的阈值合理）

**结论**: initialWeight 需要除以1000，alarmThreshold 保持不变（已经是kg）

## alarmRecords 表
- 当前无数据，不需要转换

## collectionData 表
- 当前无数据，不需要转换

## instrumentChannels 表
- currentValue: 大部分为0，有两个非零值（234.1858, 21.695526）
- scale: 0.1, 1, 2.5 → 这些是校准系数，不是重量值
- offset: 0, -1 → 校准偏移，不是重量值
- unit: 'kg' 或 'g' → 部分通道单位标记为 'g'

**结论**: instrumentChannels 的 scale/offset 是校准系数不需要转换，unit='g' 的通道可能需要统一为 'kg'

## 转换计划
1. cabinetGroups.initialWeight 除以1000
2. 前端移除所有 /1000 和 *1000 换算
3. 确保所有新数据直接以 kg 为单位存储
