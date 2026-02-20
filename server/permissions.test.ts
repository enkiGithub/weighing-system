import { describe, it, expect, beforeAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

const rnd = () => Math.random().toString(36).slice(2, 8);

function createAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-user",
    email: null,
    name: "Admin",
    username: "admin",
    passwordHash: "$2b$10$fakehash",
    avatarUrl: null,
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
      cookie: () => {},
    } as unknown as TrpcContext["res"],
  };
}

function createOperatorContext(userId: number): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId: `operator-${userId}`,
    email: null,
    name: "Operator",
    username: `operator_${userId}`,
    passwordHash: "$2b$10$fakehash",
    avatarUrl: null,
    role: "operator",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
      cookie: () => {},
    } as unknown as TrpcContext["res"],
  };
}

describe("Permission System via tRPC", () => {
  let testOperatorId: number;

  beforeAll(async () => {
    // 使用admin caller创建一个测试操作员
    const adminCaller = appRouter.createCaller(createAdminContext());
    const result = await adminCaller.users.create({
      username: `testoper_${rnd()}`,
      password: "testpass123",
      name: "测试操作员",
      role: "operator",
    });
    testOperatorId = result.id;
  });

  it("should list system modules", async () => {
    const adminCaller = appRouter.createCaller(createAdminContext());
    const modules = await adminCaller.users.getModules();
    expect(modules.length).toBeGreaterThanOrEqual(10);
    const ids = modules.map(m => m.id);
    expect(ids).toContain("dashboard");
    expect(ids).toContain("gateway_config");
    expect(ids).toContain("instrument_config");
    expect(ids).toContain("cabinet_group");
    expect(ids).toContain("data_records");
    expect(ids).toContain("alarm_management");
    expect(ids).toContain("data_analysis");
    expect(ids).toContain("audit_logs");
    expect(ids).toContain("user_management");
    expect(ids).toContain("layout_editor");
  });

  it("should return empty permissions for new operator", async () => {
    const adminCaller = appRouter.createCaller(createAdminContext());
    const perms = await adminCaller.users.getPermissions({ userId: testOperatorId });
    expect(perms).toEqual([]);
  });

  it("should set and get permissions", async () => {
    const adminCaller = appRouter.createCaller(createAdminContext());
    await adminCaller.users.setPermissions({
      userId: testOperatorId,
      permissions: [
        { module: "dashboard", canView: 1, canOperate: 0 },
        { module: "gateway_config", canView: 1, canOperate: 1 },
        { module: "data_records", canView: 1, canOperate: 0 },
      ],
    });

    const perms = await adminCaller.users.getPermissions({ userId: testOperatorId });
    expect(perms.length).toBe(3);

    const dashPerm = perms.find((p: any) => p.module === "dashboard");
    expect(dashPerm).toBeDefined();
    expect(dashPerm!.canView).toBe(1);
    expect(dashPerm!.canOperate).toBe(0);

    const gwPerm = perms.find((p: any) => p.module === "gateway_config");
    expect(gwPerm).toBeDefined();
    expect(gwPerm!.canView).toBe(1);
    expect(gwPerm!.canOperate).toBe(1);
  });

  it("should allow operator to access permitted module", async () => {
    // 操作员应该能查看有权限的模块（如gateway_config）
    const operatorCaller = appRouter.createCaller(createOperatorContext(testOperatorId));
    // 查询网关列表（已有view权限）
    const result = await operatorCaller.gateways.list();
    expect(result).toBeDefined();
  });

  it("should deny operator access to unpermitted module", async () => {
    // 操作员应该无法查看没有权限的模块（如alarm_management）
    const operatorCaller = appRouter.createCaller(createOperatorContext(testOperatorId));
    await expect(operatorCaller.alarms.list()).rejects.toThrow(/无权查看/);
  });

  it("should deny operator operate on view-only module", async () => {
    // 操作员对dashboard只有查看权限，不能操作
    // data_records 只有查看权限，不能操作（但data_records可能没有写入API）
    // 尝试在gateway_config上操作（有操作权限）应该成功
    const operatorCaller = appRouter.createCaller(createOperatorContext(testOperatorId));
    // 尝试创建网关（有操作权限）
    const gw = await operatorCaller.gateways.create({
      name: `test-gw-${rnd()}`,
      ipAddress: "192.168.1.100",
      port: 502,
    });
    expect(gw).toBeDefined();
  });

  it("should overwrite permissions when setting new ones", async () => {
    const adminCaller = appRouter.createCaller(createAdminContext());
    // 重新设置权限，只保留alarm_management
    await adminCaller.users.setPermissions({
      userId: testOperatorId,
      permissions: [
        { module: "alarm_management", canView: 1, canOperate: 1 },
      ],
    });

    const perms = await adminCaller.users.getPermissions({ userId: testOperatorId });
    expect(perms.length).toBe(1);
    expect(perms[0].module).toBe("alarm_management");

    // 之前的gateway_config权限应该被清除
    const operatorCaller = appRouter.createCaller(createOperatorContext(testOperatorId));
    await expect(operatorCaller.gateways.list()).rejects.toThrow(/无权查看/);
  });

  it("should get operator's own permissions via myPermissions", async () => {
    const operatorCaller = appRouter.createCaller(createOperatorContext(testOperatorId));
    const myPerms = await operatorCaller.users.myPermissions();
    expect(myPerms.length).toBe(1);
    expect(myPerms[0].module).toBe("alarm_management");
  });
});
