import { describe, expect, it, afterAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

/** Generate a random suffix to avoid conflicts across test runs */
const rnd = () => Math.random().toString(36).slice(2, 8);

/** Track all created resource IDs for cleanup */
const createdGatewayIds: number[] = [];
const createdInstrumentIds: number[] = [];
const createdCabinetGroupIds: number[] = [];
const createdLayoutIds: number[] = [];

function createAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    username: "admin",
    passwordHash: "$2b$10$fakehash",
    name: "Admin User",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

function createOperatorContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 2,
    username: "operator_test",
    passwordHash: "$2b$10$fakehash",
    name: "Test Operator",
    role: "operator",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

/** Cleanup all test-created resources after all tests complete */
afterAll(async () => {
  const ctx = createAdminContext();
  const caller = appRouter.createCaller(ctx);

  // 1. Delete cabinet groups first (this removes bindings that reference channels)
  if (createdCabinetGroupIds.length > 0) {
    try {
      await caller.cabinetGroups.batchDelete({ ids: createdCabinetGroupIds });
    } catch {
      // Ignore cleanup errors
    }
  }

  // 2. Delete instruments with force=true to bypass binding checks and cascade delete channels
  if (createdInstrumentIds.length > 0) {
    try {
      await caller.instruments.batchDelete({ ids: createdInstrumentIds, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }

  // 3. Delete gateways (cascade deletes COM ports)
  if (createdGatewayIds.length > 0) {
    try {
      await caller.gateways.batchDelete({ ids: createdGatewayIds });
    } catch {
      // Ignore cleanup errors
    }
  }

  // 4. Delete test layouts
  for (const id of createdLayoutIds) {
    try {
      await caller.layoutEditor.vaultLayouts.delete({ id });
    } catch {
      // Ignore cleanup errors
    }
  }
});

describe("Gateway Management", () => {
  it("should list gateways", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.gateways.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("should create a gateway with model and remark", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    
    const gateway = await caller.gateways.create({
      name: `Test Gateway ${rnd()}`,
      model: "USR-N540",
      remark: "Test gateway for unit testing",
    });

    createdGatewayIds.push(gateway.id);

    expect(gateway.id).toBeGreaterThan(0);
    expect(gateway.name).toContain("Test Gateway");
    expect(gateway.model).toBe("USR-N540");
    expect(gateway.status).toBe("offline");
  });
});

describe("Weighing Instrument Management", () => {
  it("should list instruments", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.instruments.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("should create an instrument with deviceCode and slaveId", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const gw = await caller.gateways.create({
      name: `Inst Test GW ${rnd()}`,
      ipAddress: "192.168.1.110",
      port: 502,
    });
    createdGatewayIds.push(gw.id);

    const comPort = await caller.gatewayComPorts.create({
      gatewayId: gw.id,
      portNumber: "COM1",
      ipAddress: "192.168.1.100",
      networkPort: 502,
    });

    const instrument = await caller.instruments.create({
      deviceCode: `DY-TEST-001-${rnd()}`,
      modelType: "DY7001",
      slaveId: 1,
      comPortId: comPort.id,
      name: "Test DY7001",
    });
    createdInstrumentIds.push(instrument.id);

    expect(instrument.id).toBeGreaterThan(0);
    expect(instrument.deviceCode).toContain("DY-TEST-001");
    expect(instrument.modelType).toBe("DY7001");
    expect(instrument.channelIds.length).toBe(1);
  });

  it("should auto-generate 4 channels for DY7004", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const gw = await caller.gateways.create({
      name: `DY7004 Test GW ${rnd()}`,
      ipAddress: "192.168.1.111",
      port: 502,
    });
    createdGatewayIds.push(gw.id);

    const comPort = await caller.gatewayComPorts.create({
      gatewayId: gw.id,
      portNumber: "COM2",
      ipAddress: "192.168.1.100",
      networkPort: 502,
    });

    const instrument = await caller.instruments.create({
      deviceCode: `DY-TEST-002-${rnd()}`,
      modelType: "DY7004",
      slaveId: 2,
      comPortId: comPort.id,
    });
    createdInstrumentIds.push(instrument.id);

    expect(instrument.channelIds.length).toBe(4);

    const channels = await caller.channels.listByInstrument({ instrumentId: instrument.id });
    expect(channels.length).toBe(4);
    expect(channels[0].channelNo).toBe(1);
    expect(channels[0].label).toBe("CH1");
    expect(channels[3].channelNo).toBe(4);
    expect(channels[3].label).toBe("CH4");
  });

  it("should detect slaveId conflict on same COM port", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const gw = await caller.gateways.create({
      name: `SlaveId Conflict GW ${rnd()}`,
      ipAddress: "192.168.1.112",
      port: 502,
    });
    createdGatewayIds.push(gw.id);

    const comPort = await caller.gatewayComPorts.create({
      gatewayId: gw.id,
      portNumber: "COM3",
      ipAddress: "192.168.1.100",
      networkPort: 502,
    });

    const inst1 = await caller.instruments.create({
      deviceCode: `DY-CONFLICT-001-${rnd()}`,
      modelType: "DY7001",
      slaveId: 5,
      comPortId: comPort.id,
    });
    createdInstrumentIds.push(inst1.id);

    await expect(
      caller.instruments.create({
        deviceCode: `DY-CONFLICT-002-${rnd()}`,
        modelType: "DY7001",
        slaveId: 5,
        comPortId: comPort.id,
      })
    ).rejects.toThrow("从站地址");
  });

  it("should detect deviceCode conflict", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const uniqueCode = `DY-UNIQUE-${rnd()}`;

    const gw = await caller.gateways.create({
      name: `DevCode Conflict GW ${rnd()}`,
      ipAddress: "192.168.1.113",
      port: 502,
    });
    createdGatewayIds.push(gw.id);

    const comPort = await caller.gatewayComPorts.create({
      gatewayId: gw.id,
      portNumber: "COM4",
      ipAddress: "192.168.1.100",
      networkPort: 502,
    });

    const inst = await caller.instruments.create({
      deviceCode: uniqueCode,
      modelType: "DY7001",
      slaveId: 1,
      comPortId: comPort.id,
    });
    createdInstrumentIds.push(inst.id);

    await expect(
      caller.instruments.create({
        deviceCode: uniqueCode,
        modelType: "DY7004",
        slaveId: 2,
        comPortId: comPort.id,
      })
    ).rejects.toThrow("设备编码");
  });
});

describe("Cabinet Group Management", () => {
  it("should list cabinet groups", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.cabinetGroups.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("should create a cabinet group with area", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const group = await caller.cabinetGroups.create({
      area: `测试区-${rnd()}`,
      name: `Test Cabinet Group ${rnd()}`,
      initialWeight: 50000,
      alarmThreshold: 5000,
    });
    createdCabinetGroupIds.push(group.id);

    expect(group.id).toBeGreaterThan(0);
    expect(group.name).toContain("Test Cabinet Group");
  });
});

describe("Channel Binding Management", () => {
  it("should add and list channel bindings for a cabinet group", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const gw = await caller.gateways.create({
      name: `Binding Test GW ${rnd()}`,
      ipAddress: "192.168.1.120",
      port: 502,
    });
    createdGatewayIds.push(gw.id);

    const comPort = await caller.gatewayComPorts.create({
      gatewayId: gw.id,
      portNumber: "COM1",
      ipAddress: "192.168.1.100",
      networkPort: 502,
    });
    const instrument = await caller.instruments.create({
      deviceCode: `DY-BIND-${rnd()}`,
      modelType: "DY7004",
      slaveId: 1,
      comPortId: comPort.id,
    });
    createdInstrumentIds.push(instrument.id);

    const channels = await caller.channels.listByInstrument({ instrumentId: instrument.id });
    expect(channels.length).toBe(4);

    const group = await caller.cabinetGroups.create({
      area: `测试区`,
      name: `Binding Test Group ${rnd()}`,
      initialWeight: 30000,
      alarmThreshold: 3000,
    });
    createdCabinetGroupIds.push(group.id);

    const binding = await caller.cabinetGroups.addBinding({
      groupId: group.id,
      channelId: channels[0].id,
      coefficient: 1.5,
      offset: -0.2,
    });
    expect(binding.id).toBeGreaterThan(0);

    const bindings = await caller.cabinetGroups.getBindings({ groupId: group.id });
    expect(bindings.length).toBe(1);
    expect(bindings[0].coefficient).toBe(1.5);
    expect(bindings[0].offset).toBe(-0.2);
  });

  it("should remove channel binding", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const gw = await caller.gateways.create({
      name: `Remove Binding GW ${rnd()}`,
      ipAddress: "192.168.1.121",
      port: 502,
    });
    createdGatewayIds.push(gw.id);

    const comPort = await caller.gatewayComPorts.create({
      gatewayId: gw.id,
      portNumber: "COM2",
      ipAddress: "192.168.1.100",
      networkPort: 502,
    });
    const instrument = await caller.instruments.create({
      deviceCode: `DY-UNBIND-${rnd()}`,
      modelType: "DY7001",
      slaveId: 1,
      comPortId: comPort.id,
    });
    createdInstrumentIds.push(instrument.id);

    const channels = await caller.channels.listByInstrument({ instrumentId: instrument.id });

    const group = await caller.cabinetGroups.create({
      area: `测试区`,
      name: `Unbind Test Group ${rnd()}`,
      initialWeight: 20000,
      alarmThreshold: 2000,
    });
    createdCabinetGroupIds.push(group.id);

    const binding = await caller.cabinetGroups.addBinding({
      groupId: group.id,
      channelId: channels[0].id,
    });

    const result = await caller.cabinetGroups.removeBinding({ id: binding.id });
    expect(result.success).toBe(true);

    const bindings = await caller.cabinetGroups.getBindings({ groupId: group.id });
    expect(bindings.length).toBe(0);
  });

  it("should prevent duplicate channel binding to same group", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const gw = await caller.gateways.create({
      name: `Dup Binding GW ${rnd()}`,
      ipAddress: "192.168.1.122",
      port: 502,
    });
    createdGatewayIds.push(gw.id);

    const comPort = await caller.gatewayComPorts.create({
      gatewayId: gw.id,
      portNumber: "COM3",
      ipAddress: "192.168.1.100",
      networkPort: 502,
    });
    const instrument = await caller.instruments.create({
      deviceCode: `DY-DUP-${rnd()}`,
      modelType: "DY7001",
      slaveId: 1,
      comPortId: comPort.id,
    });
    createdInstrumentIds.push(instrument.id);

    const channels = await caller.channels.listByInstrument({ instrumentId: instrument.id });

    const group = await caller.cabinetGroups.create({
      area: `测试区`,
      name: `Dup Binding Group ${rnd()}`,
      initialWeight: 15000,
      alarmThreshold: 1500,
    });
    createdCabinetGroupIds.push(group.id);

    await caller.cabinetGroups.addBinding({
      groupId: group.id,
      channelId: channels[0].id,
    });

    await expect(
      caller.cabinetGroups.addBinding({
        groupId: group.id,
        channelId: channels[0].id,
      })
    ).rejects.toThrow("已绑定");
  });
});

describe("Channel Management", () => {
  it("should list all channels", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.channels.listAll();
    expect(Array.isArray(result)).toBe(true);
  });

  it("should update channel parameters", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    // Create a dedicated test instrument so we don't touch user data
    const gw = await caller.gateways.create({
      name: `Channel Update GW ${rnd()}`,
      ipAddress: "192.168.1.130",
      port: 502,
    });
    createdGatewayIds.push(gw.id);

    const comPort = await caller.gatewayComPorts.create({
      gatewayId: gw.id,
      portNumber: "COM1",
      ipAddress: "192.168.1.100",
      networkPort: 502,
    });
    const instrument = await caller.instruments.create({
      deviceCode: `DY-CH-UPD-${rnd()}`,
      modelType: "DY7001",
      slaveId: 1,
      comPortId: comPort.id,
    });
    createdInstrumentIds.push(instrument.id);

    const channels = await caller.channels.listByInstrument({ instrumentId: instrument.id });

    // Update channel parameters on test-created channel only
    const result = await caller.channels.update({
      id: channels[0].id,
      label: "Test Updated Label",
      scale: 2.5,
      offset: -1.0,
      unit: "kg",
      precision: 3,
    });
    expect(result.success).toBe(true);

    const updated = await caller.channels.getById({ id: channels[0].id });
    expect(updated?.label).toBe("Test Updated Label");
    expect(updated?.scale).toBe(2.5);
    expect(updated?.offset).toBe(-1.0);
    expect(updated?.unit).toBe("kg");
    expect(updated?.precision).toBe(3);
  });

  it("should test read channel (simulated)", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const gw = await caller.gateways.create({
      name: `Channel Test GW ${rnd()}`,
      ipAddress: "192.168.1.131",
      port: 502,
    });
    createdGatewayIds.push(gw.id);

    const comPort = await caller.gatewayComPorts.create({
      gatewayId: gw.id,
      portNumber: "COM2",
      ipAddress: "192.168.1.100",
      networkPort: 502,
    });
    const instrument = await caller.instruments.create({
      deviceCode: `DY-CH-TEST-${rnd()}`,
      modelType: "DY7001",
      slaveId: 2,
      comPortId: comPort.id,
    });
    createdInstrumentIds.push(instrument.id);

    const channels = await caller.channels.listByInstrument({ instrumentId: instrument.id });

    const result = await caller.channels.testRead({ channelId: channels[0].id });
    expect(result.success).toBe(true);
    expect(typeof result.rawValue).toBe("number");
    expect(typeof result.calibratedValue).toBe("number");
    expect(typeof result.unit).toBe("string");
  });
});

describe("Weight Records", () => {
  it("should list weight records", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.weightRecords.list({ limit: 100 });
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("Alarm Management", () => {
  it("should list alarms", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.alarms.list({ limit: 100 });
    expect(Array.isArray(result)).toBe(true);
  });

  it("should get unhandled alarms", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.alarms.getUnhandled();
    expect(typeof result).toBe('number');
    expect(result).toBeGreaterThanOrEqual(0);
  });
});

describe("Audit Logs", () => {
  it("should list audit logs", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auditLogs.list({ limit: 50 });
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("User Management", () => {
  it("should list users for admin", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.users.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("should deny user list access for non-admin (operator)", async () => {
    const ctx = createOperatorContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.users.list()).rejects.toThrow();
  });
});

describe("Authentication", () => {
  it("should return current user info", async () => {
    const ctx = createOperatorContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeDefined();
    expect(result?.id).toBe(2);
    expect(result?.role).toBe("operator");
  });
});

describe("Layout Editor", () => {
  it("should list vault layouts", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.layoutEditor.vaultLayouts.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("should create a vault layout with valid JSON data", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    
    const validLayoutData = {
      cabinets: [],
      polylines: [],
      bindings: {},
      viewBox: { minX: 0, minY: 0, width: 100, height: 100 },
    };

    const layout = await caller.layoutEditor.vaultLayouts.create({
      name: `Test Layout ${rnd()}`,
      description: "Test vault layout",
      layoutData: JSON.stringify(validLayoutData),
    });
    createdLayoutIds.push(layout.id);

    expect(layout.id).toBeGreaterThan(0);
    expect(layout.name).toContain("Test Layout");
  });

  it("should reject invalid layout data", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    
    await expect(
      caller.layoutEditor.vaultLayouts.create({
        name: "Bad Layout",
        layoutData: "not valid json",
      })
    ).rejects.toThrow();
  });

  it("should get active vault layout (null when none set)", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.layoutEditor.vaultLayouts.getActive();
    expect(result === null || typeof result === "object").toBe(true);
  });
});

describe("Gateway COM Port Management", () => {
  it("should create a COM port for a gateway", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const gateway = await caller.gateways.create({
      name: `COM Port Test Gateway ${rnd()}`,
      ipAddress: "192.168.1.200",
      port: 502,
    });
    createdGatewayIds.push(gateway.id);

    const comPort = await caller.gatewayComPorts.create({
      gatewayId: gateway.id,
      portNumber: "COM1",
      ipAddress: "192.168.1.100",
      networkPort: 502,
      baudRate: 9600,
      dataBits: 8,
      stopBits: 1,
      parity: "none",
    });

    expect(comPort.id).toBeGreaterThan(0);
    expect(comPort.portNumber).toBe("COM1");
    expect(comPort.baudRate).toBe(9600);
  });

  it("should list COM ports by gateway", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const gateways = await caller.gateways.list();
    if (gateways.length > 0) {
      const result = await caller.gatewayComPorts.listByGateway({ gatewayId: gateways[0].id });
      expect(Array.isArray(result)).toBe(true);
    }
  });
});

describe("Batch Delete Operations", () => {
  it("should batch delete gateways", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const gw1 = await caller.gateways.create({
      name: `Batch Del GW 1 ${rnd()}`,
      ipAddress: "192.168.99.1",
      port: 502,
    });
    const gw2 = await caller.gateways.create({
      name: `Batch Del GW 2 ${rnd()}`,
      ipAddress: "192.168.99.2",
      port: 502,
    });
    // These will be deleted in the test itself, no need to track

    const result = await caller.gateways.batchDelete({ ids: [gw1.id, gw2.id] });
    expect(result.count).toBe(2);
  });

  it("should batch delete cabinet groups", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const cab1 = await caller.cabinetGroups.create({
      area: `测试区`,
      name: `Batch Del Cab 1 ${rnd()}`,
      initialWeight: 10000,
      alarmThreshold: 1000,
    });
    const cab2 = await caller.cabinetGroups.create({
      area: `测试区`,
      name: `Batch Del Cab 2 ${rnd()}`,
      initialWeight: 20000,
      alarmThreshold: 2000,
    });

    const result = await caller.cabinetGroups.batchDelete({ ids: [cab1.id, cab2.id] });
    expect(result.count).toBe(2);
  });

  it("should deny batch delete for non-admin users (operator)", async () => {
    const ctx = createOperatorContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.gateways.batchDelete({ ids: [1] })).rejects.toThrow();
    await expect(caller.instruments.batchDelete({ ids: [1] })).rejects.toThrow();
    await expect(caller.cabinetGroups.batchDelete({ ids: [1] })).rejects.toThrow();
  });
});
