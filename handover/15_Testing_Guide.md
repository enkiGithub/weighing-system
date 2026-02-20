# 15 — 测试指南

## 测试概览

| 测试文件 | 测试数量 | 覆盖范围 |
|----------|----------|----------|
| `server/auth.logout.test.ts` | 3 | 认证登出逻辑 |
| `server/permissions.test.ts` | 9 | 权限系统（RBAC） |
| `server/weighing.test.ts` | 30 | 称重业务核心逻辑 |
| **合计** | **42** | |

## 运行测试

```bash
# 运行所有测试
pnpm test

# 运行特定测试文件
npx vitest run server/weighing.test.ts

# 监听模式（文件变更自动重跑）
npx vitest watch

# 查看覆盖率
npx vitest run --coverage
```

## 测试架构

### 测试上下文

测试通过模拟 tRPC 上下文来调用 procedure，不需要启动 HTTP 服务器：

```typescript
// 模拟管理员上下文
function createAdminContext() {
  return {
    user: {
      id: adminUserId,
      username: 'test-admin-xxx',
      name: 'Test Admin',
      role: 'admin' as const,
    },
    res: { cookie: vi.fn(), clearCookie: vi.fn() } as any,
  };
}

// 调用 procedure
const result = await router.createCaller(createAdminContext()).gateways.create({
  name: 'Test Gateway',
  ipAddress: '192.168.1.100',
  port: 4001,
  comPorts: [{ portNumber: 'COM1', baudRate: 9600, ... }],
});
```

### 数据清理

每个测试文件在 `afterAll` 中清理所有创建的测试数据：

```typescript
afterAll(async () => {
  // 按依赖关系逆序删除
  // 1. 先删柜组（解除绑定）
  // 2. 再删仪表（force=true 跳过绑定检查）
  // 3. 最后删网关
  // 4. 删除测试用户
});
```

**关键原则**：测试数据使用随机后缀（如 `test-gw-${Date.now()}`）避免与真实数据冲突，`afterAll` 必须清理所有创建的资源。

## 测试覆盖范围

### weighing.test.ts（30 项）

| 分类 | 测试项 |
|------|--------|
| 网关管理 | 创建、更新、删除、重复名称检查 |
| COM 端口 | 创建、更新、删除、参数验证 |
| 仪表管理 | 创建（DY7001/DY7004）、自动生成通道、编码唯一性、从站地址唯一性 |
| 批量删除 | 无绑定删除、有绑定确认、强制删除 |
| 通道管理 | 更新标签、更新校准参数、启用/禁用 |
| 柜组管理 | 创建、更新、删除、通道绑定、绑定查询 |
| 柜组批量删除 | 无绑定删除、有绑定确认、强制删除 |

### permissions.test.ts（9 项）

| 测试项 |
|--------|
| 管理员可以访问所有功能 |
| 操作员无权限时被拒绝 |
| 设置权限后操作员可以访问 |
| 操作员无法管理用户 |
| 操作员无法删除网关 |
| 权限更新生效 |
| 查看权限与操作权限分离 |
| 管理员可以查看审计日志 |
| 操作员无审计日志权限时被拒绝 |

## 编写新测试

### 模板

```typescript
import { describe, it, expect, afterAll, vi } from 'vitest';
import { router } from './routers';

describe('新功能测试', () => {
  const createdIds: number[] = [];

  function createAdminContext() {
    return {
      user: { id: 1, username: 'admin', name: 'Admin', role: 'admin' as const },
      res: { cookie: vi.fn(), clearCookie: vi.fn() } as any,
    };
  }

  afterAll(async () => {
    // 清理所有创建的测试数据
    for (const id of createdIds) {
      try {
        await router.createCaller(createAdminContext()).feature.delete({ id });
      } catch {}
    }
  });

  it('应该创建新记录', async () => {
    const caller = router.createCaller(createAdminContext());
    const result = await caller.feature.create({ name: `test-${Date.now()}` });
    createdIds.push(result.id);
    expect(result.name).toContain('test-');
  });
});
```

### 注意事项

1. **必须清理测试数据**：使用 `afterAll` 删除所有创建的资源
2. **使用随机后缀**：避免与真实数据或并行测试冲突
3. **按依赖顺序清理**：先删子表记录，再删父表记录
4. **使用 `force` 参数**：删除有关联的记录时传 `force: true`
5. **不要修改真实数据**：测试只操作自己创建的数据
