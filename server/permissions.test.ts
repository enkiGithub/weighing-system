import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

const rnd = () => Math.random().toString(36).slice(2, 8);

/** Track all created resource IDs for cleanup */
const createdGatewayIds: number[] = [];
let testOperatorId: number | null = null;

function createAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    username: "admin",
    passwordHash: "$2b$10$fakehash",
    name: "Admin",
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
    username: `operator_${userId}`,
    passwordHash: "$2b$10$fakehash",
    name: "Operator",
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

/** Cleanup all test-created resources after all tests complete */
afterAll(async () => {
  const adminCaller = appRouter.createCaller(createAdminContext());

  // Delete test gateways
  if (createdGatewayIds.length > 0) {
    try {
      await adminCaller.gateways.batchDelete({ ids: createdGatewayIds });
    } catch {
      // Ignore cleanup errors
    }
  }

  // Delete test operator user
  if (testOperatorId !== null) {
    try {
      await adminCaller.users.delete({ id: testOperatorId });
    } catch {
      // Ignore cleanup errors
    }
  }
});

describe("Permission System via tRPC", () => {
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
    const perms = await adminCaller.users.getPermissions({ userId: testOperatorId! });
    expect(perms).toEqual([]);
  });

  it("should set and get permissions", async () => {
    const adminCaller = appRouter.createCaller(createAdminContext());
    await adminCaller.users.setPermissions({
      userId: testOperatorId!,
      permissions: [
        { module: "dashboard", canView: 1, canOperate: 0 },
        { module: "gateway_config", canView: 1, canOperate: 1 },
        { module: "data_records", canView: 1, canOperate: 0 },
      ],
    });

    const perms = await adminCaller.users.getPermissions({ userId: testOperatorId! });
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
    const operatorCaller = appRouter.createCaller(createOperatorContext(testOperatorId!));
    // 查询网关列表（已有view权限）
    const result = await operatorCaller.gateways.list();
    expect(result).toBeDefined();
  });

  it("should deny operator access to unpermitted module", async () => {
    // 操作员应该无法查看没有权限的模块（如alarm_management）
    const operatorCaller = appRouter.createCaller(createOperatorContext(testOperatorId!));
    await expect(operatorCaller.alarms.list()).rejects.toThrow(/无权查看/);
  });

  it("should deny operator operate on view-only module", async () => {
    // 操作员对gateway_config有操作权限，应该能创建网关
    const operatorCaller = appRouter.createCaller(createOperatorContext(testOperatorId!));
    const gw = await operatorCaller.gateways.create({
      name: `test-gw-${rnd()}`,
      ipAddress: "192.168.1.100",
      port: 502,
    });
    createdGatewayIds.push(gw.id);
    expect(gw).toBeDefined();
  });

  it("should overwrite permissions when setting new ones", async () => {
    const adminCaller = appRouter.createCaller(createAdminContext());
    // 重新设置权限，只保留alarm_management
    await adminCaller.users.setPermissions({
      userId: testOperatorId!,
      permissions: [
        { module: "alarm_management", canView: 1, canOperate: 1 },
      ],
    });

    const perms = await adminCaller.users.getPermissions({ userId: testOperatorId! });
    expect(perms.length).toBe(1);
    expect(perms[0].module).toBe("alarm_management");

    // 之前的gateway_config权限应该被清除
    const operatorCaller = appRouter.createCaller(createOperatorContext(testOperatorId!));
    await expect(operatorCaller.gateways.list()).rejects.toThrow(/无权查看/);
  });

  it("should get operator's own permissions via myPermissions", async () => {
    const operatorCaller = appRouter.createCaller(createOperatorContext(testOperatorId!));
    const myPerms = await operatorCaller.users.myPermissions();
    expect(myPerms.length).toBe(1);
    expect(myPerms[0].module).toBe("alarm_management");
  });
});
