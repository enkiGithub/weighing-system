import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-user",
    email: "admin@example.com",
    name: "Admin User",
    loginMethod: "manus",
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

function createUserContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 2,
    openId: "regular-user",
    email: "user@example.com",
    name: "Regular User",
    loginMethod: "manus",
    role: "user",
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

describe("Gateway Management", () => {
  it("should list gateways", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.gateways.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("should create a gateway", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    
    const gateway = await caller.gateways.create({
      name: "Test Gateway",
      ipAddress: "192.168.1.100",
      port: 502,
      description: "Test gateway for unit testing",
    });

    expect(gateway.id).toBeGreaterThan(0);
    expect(gateway.name).toBe("Test Gateway");
    expect(gateway.ipAddress).toBe("192.168.1.100");
    expect(gateway.port).toBe(502);
  });
});

describe("Weighing Instrument Management", () => {
  it("should list instruments", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.instruments.list();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("Cabinet Group Management", () => {
  it("should list cabinet groups", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.cabinetGroups.list();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("Weight Records", () => {
  it("should list weight records", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.weightRecords.list({ limit: 100 });
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("Alarm Management", () => {
  it("should list alarms", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.alarms.list({ limit: 100 });
    expect(Array.isArray(result)).toBe(true);
  });

  it("should get unhandled alarms", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.alarms.getUnhandled();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("User Management", () => {
  it("should list users for admin", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.users.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("should deny user list access for non-admin", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    
    await expect(caller.users.list()).rejects.toThrow();
  });
});

describe("Authentication", () => {
  it("should return current user info", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    
    expect(result).toBeDefined();
    expect(result?.id).toBe(2);
    expect(result?.role).toBe("user");
  });
});


describe("Layout Editor", () => {
  it("should list cabinets", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.layoutEditor.cabinets.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("should create a cabinet", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    
    const cabinet = await caller.layoutEditor.cabinets.create({
      name: "Test Cabinet",
      width: 500,
      height: 800,
      depth: 400,
      description: "Test cabinet for unit testing",
    });

    expect(cabinet.id).toBeGreaterThan(0);
    expect(cabinet.name).toBe("Test Cabinet");
    expect(cabinet.width).toBe(500);
  });

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
      scene: {
        gridSize: 20,
        unit: "m",
        cameraDefault: {
          position: { x: 8, y: 6, z: 8 },
          target: { x: 0, y: 0, z: 0 },
        },
      },
      instances: [
        {
          instanceId: "test-inst-1",
          type: "cabinetGroup",
          cabinetGroupId: null,
          transform: {
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            scale: { x: 1, y: 1, z: 1 },
          },
          model: {
            columns: 2,
            columnSpacing: 0.05,
            cabinetWidth: 0.6,
            cabinetHeight: 1.8,
            cabinetDepth: 0.5,
            shelves: 6,
          },
          meta: { label: "Test Group", remark: "" },
        },
      ],
    };

    const layout = await caller.layoutEditor.vaultLayouts.create({
      name: "Test Layout",
      description: "Test vault layout",
      layoutData: JSON.stringify(validLayoutData),
    });

    expect(layout.id).toBeGreaterThan(0);
    expect(layout.name).toBe("Test Layout");
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

  it("should get active vault layout (null when none)", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.layoutEditor.vaultLayouts.getActive();
    // Returns null or an object
    expect(result === null || typeof result === "object").toBe(true);
  });

  it("should activate a layout and retrieve it", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    
    const validLayoutData = {
      scene: { gridSize: 20, unit: "m", cameraDefault: { position: { x: 8, y: 6, z: 8 }, target: { x: 0, y: 0, z: 0 } } },
      instances: [],
    };

    const layout = await caller.layoutEditor.vaultLayouts.create({
      name: "Activate Test Layout",
      description: "For activation test",
      layoutData: JSON.stringify(validLayoutData),
    });

    await caller.layoutEditor.vaultLayouts.setActive({ id: layout.id });

    const active = await caller.layoutEditor.vaultLayouts.getActive();
    expect(active).not.toBeNull();
    expect(active?.name).toBe("Activate Test Layout");
  });

  it("should list cabinet group layouts by vault layout", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    
    const validLayoutData = {
      scene: { gridSize: 20, unit: "m", cameraDefault: { position: { x: 8, y: 6, z: 8 }, target: { x: 0, y: 0, z: 0 } } },
      instances: [],
    };

    const layout = await caller.layoutEditor.vaultLayouts.create({
      name: "Test Layout for Groups",
      description: "Test",
      layoutData: JSON.stringify(validLayoutData),
    });

    const result = await caller.layoutEditor.cabinetGroupLayouts.listByVaultLayout({
      vaultLayoutId: layout.id,
    });

    expect(Array.isArray(result)).toBe(true);
  });

  it("should update layout with binding validation", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    // Create a cabinet group first
    const cabinet = await caller.cabinetGroups.create({
      name: "Layout Bind Test Cabinet",
      initialWeight: 50000,
      alarmThreshold: 5000,
    });

    const validLayoutData = {
      scene: { gridSize: 20, unit: "m", cameraDefault: { position: { x: 8, y: 6, z: 8 }, target: { x: 0, y: 0, z: 0 } } },
      instances: [
        {
          instanceId: "bind-test-1",
          type: "cabinetGroup",
          cabinetGroupId: cabinet.id,
          transform: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
          model: { columns: 2, columnSpacing: 0.05, cabinetWidth: 0.6, cabinetHeight: 1.8, cabinetDepth: 0.5, shelves: 6 },
          meta: { label: "Bound Group", remark: "" },
        },
      ],
    };

    const layout = await caller.layoutEditor.vaultLayouts.create({
      name: "Binding Validation Layout",
      layoutData: JSON.stringify(validLayoutData),
    });

    // Update with duplicate binding should fail
    const duplicateData = {
      ...validLayoutData,
      instances: [
        ...validLayoutData.instances,
        {
          instanceId: "bind-test-2",
          type: "cabinetGroup" as const,
          cabinetGroupId: cabinet.id, // duplicate!
          transform: { position: { x: 2, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
          model: { columns: 2, columnSpacing: 0.05, cabinetWidth: 0.6, cabinetHeight: 1.8, cabinetDepth: 0.5, shelves: 6 },
          meta: { label: "Duplicate", remark: "" },
        },
      ],
    };

    await expect(
      caller.layoutEditor.vaultLayouts.update({
        id: layout.id,
        layoutData: JSON.stringify(duplicateData),
      })
    ).rejects.toThrow("同一布局内不允许重复绑定同一个柜组资产");
  });
});

describe("Gateway COM Port Management", () => {
  it("should create a COM port for a gateway", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    // First create a gateway
    const gateway = await caller.gateways.create({
      name: "COM Port Test Gateway",
      ipAddress: "192.168.1.200",
      port: 502,
    });

    // Create a COM port
    const comPort = await caller.gatewayComPorts.create({
      gatewayId: gateway.id,
      portNumber: "COM1",
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

describe("Instrument with COM Port Binding", () => {
  it("should create an instrument bound to a COM port", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    // Create gateway
    const gateway = await caller.gateways.create({
      name: "Instrument Binding Test Gateway",
      ipAddress: "192.168.1.201",
      port: 502,
    });

    // Create COM port
    const comPort = await caller.gatewayComPorts.create({
      gatewayId: gateway.id,
      portNumber: "COM2",
    });

    // Create DY7001 instrument
    const instrument = await caller.instruments.create({
      name: "DY7001 Test Instrument",
      modelType: "DY7001",
      gatewayComPortId: comPort.id,
      slaveAddress: 1,
    });

    expect(instrument.id).toBeGreaterThan(0);
    expect(instrument.modelType).toBe("DY7001");
  });

  it("should get instruments by COM port", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    // Create gateway and COM port
    const gateway = await caller.gateways.create({
      name: "Get By ComPort Test Gateway",
      ipAddress: "192.168.1.202",
      port: 502,
    });

    const comPort = await caller.gatewayComPorts.create({
      gatewayId: gateway.id,
      portNumber: "COM3",
    });

    // Create DY7004 instrument
    await caller.instruments.create({
      name: "DY7004 Test Instrument",
      modelType: "DY7004",
      gatewayComPortId: comPort.id,
      slaveAddress: 2,
    });

    const result = await caller.instruments.getByComPort({ comPortId: comPort.id });
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].modelType).toBe("DY7004");
  });
});

describe("Cabinet Group Hardware Binding", () => {
  it("should set and get gateway binding for a cabinet group", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    // Create gateway
    const gateway = await caller.gateways.create({
      name: "Binding Test Gateway",
      ipAddress: "192.168.1.203",
      port: 502,
    });

    // Create COM port
    const comPort = await caller.gatewayComPorts.create({
      gatewayId: gateway.id,
      portNumber: "COM4",
    });

    // Create cabinet group
    const cabinet = await caller.cabinetGroups.create({
      name: "Binding Test Cabinet",
      initialWeight: 50000,
      alarmThreshold: 5000,
    });

    // Set gateway binding
    const result = await caller.cabinetGroups.setGatewayBinding({
      cabinetGroupId: cabinet.id,
      gatewayComPortId: comPort.id,
    });
    expect(result.success).toBe(true);

    // Get gateway binding
    const binding = await caller.cabinetGroups.getGatewayBinding({
      cabinetGroupId: cabinet.id,
    });
    expect(binding).not.toBeNull();
    expect(binding?.gatewayComPortId).toBe(comPort.id);
  });

  it("should add and get sensor bindings", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    // Create gateway
    const gateway = await caller.gateways.create({
      name: "Sensor Binding Test Gateway",
      ipAddress: "192.168.1.204",
      port: 502,
    });

    // Create COM port
    const comPort = await caller.gatewayComPorts.create({
      gatewayId: gateway.id,
      portNumber: "COM5",
    });

    // Create instrument
    const instrument = await caller.instruments.create({
      name: "DY7004 Sensor Test",
      modelType: "DY7004",
      gatewayComPortId: comPort.id,
      slaveAddress: 3,
    });

    // Create cabinet group
    const cabinet = await caller.cabinetGroups.create({
      name: "Sensor Binding Test Cabinet",
      initialWeight: 60000,
      alarmThreshold: 3000,
    });

    // Add sensor binding - channel 1
    const binding1 = await caller.cabinetGroups.addSensorBinding({
      cabinetGroupId: cabinet.id,
      instrumentId: instrument.id,
      sensorChannel: 1,
    });
    expect(binding1.id).toBeGreaterThan(0);

    // Add sensor binding - channel 2
    const binding2 = await caller.cabinetGroups.addSensorBinding({
      cabinetGroupId: cabinet.id,
      instrumentId: instrument.id,
      sensorChannel: 2,
    });
    expect(binding2.id).toBeGreaterThan(0);

    // Get sensor bindings
    const bindings = await caller.cabinetGroups.getSensorBindings({
      cabinetGroupId: cabinet.id,
    });
    expect(Array.isArray(bindings)).toBe(true);
    expect(bindings.length).toBe(2);
  });

  it("should remove sensor binding", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    // Create gateway
    const gateway = await caller.gateways.create({
      name: "Remove Sensor Test Gateway",
      ipAddress: "192.168.1.205",
      port: 502,
    });

    // Create COM port
    const comPort = await caller.gatewayComPorts.create({
      gatewayId: gateway.id,
      portNumber: "COM6",
    });

    // Create instrument
    const instrument = await caller.instruments.create({
      name: "DY7001 Remove Test",
      modelType: "DY7001",
      gatewayComPortId: comPort.id,
      slaveAddress: 4,
    });

    // Create cabinet group
    const cabinet = await caller.cabinetGroups.create({
      name: "Remove Sensor Test Cabinet",
      initialWeight: 70000,
      alarmThreshold: 4000,
    });

    // Add sensor binding
    const binding = await caller.cabinetGroups.addSensorBinding({
      cabinetGroupId: cabinet.id,
      instrumentId: instrument.id,
      sensorChannel: 1,
    });

    // Remove sensor binding
    const result = await caller.cabinetGroups.removeSensorBinding({ id: binding.id });
    expect(result.success).toBe(true);

    // Verify removal
    const bindings = await caller.cabinetGroups.getSensorBindings({
      cabinetGroupId: cabinet.id,
    });
    expect(bindings.length).toBe(0);
  });
});


describe("Batch Delete Operations", () => {
  it("should batch delete gateways", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    // Create two gateways
    const gw1 = await caller.gateways.create({
      name: "Batch Del GW 1",
      ipAddress: "192.168.99.1",
      port: 502,
    });
    const gw2 = await caller.gateways.create({
      name: "Batch Del GW 2",
      ipAddress: "192.168.99.2",
      port: 502,
    });

    const result = await caller.gateways.batchDelete({ ids: [gw1.id, gw2.id] });
    expect(result.count).toBe(2);
  });

  it("should batch delete instruments", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    // Create gateway and COM port first
    const gw = await caller.gateways.create({
      name: "Batch Del Inst GW",
      ipAddress: "192.168.99.3",
      port: 502,
    });
    const comPort = await caller.gatewayComPorts.create({
      gatewayId: gw.id,
      portNumber: "COM1",
    });

    // Create two instruments
    const inst1 = await caller.instruments.create({
      name: "Batch Del Inst 1",
      modelType: "DY7001",
      gatewayComPortId: comPort.id,
      slaveAddress: 10,
    });
    const inst2 = await caller.instruments.create({
      name: "Batch Del Inst 2",
      modelType: "DY7004",
      gatewayComPortId: comPort.id,
      slaveAddress: 11,
    });

    const result = await caller.instruments.batchDelete({ ids: [inst1.id, inst2.id] });
    expect(result.count).toBe(2);
  });

  it("should batch delete cabinet groups", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    // Create two cabinet groups
    const cab1 = await caller.cabinetGroups.create({
      name: "Batch Del Cab 1",
      initialWeight: 10000,
      alarmThreshold: 1000,
    });
    const cab2 = await caller.cabinetGroups.create({
      name: "Batch Del Cab 2",
      initialWeight: 20000,
      alarmThreshold: 2000,
    });

    const result = await caller.cabinetGroups.batchDelete({ ids: [cab1.id, cab2.id] });
    expect(result.count).toBe(2);
  });

  it("should deny batch delete for non-admin users", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.gateways.batchDelete({ ids: [1] })).rejects.toThrow();
    await expect(caller.instruments.batchDelete({ ids: [1] })).rejects.toThrow();
    await expect(caller.cabinetGroups.batchDelete({ ids: [1] })).rejects.toThrow();
  });
});
