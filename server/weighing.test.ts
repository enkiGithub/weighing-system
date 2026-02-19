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

  it("should create a vault layout", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    
    const layout = await caller.layoutEditor.vaultLayouts.create({
      name: "Test Layout",
      description: "Test vault layout",
      layoutData: JSON.stringify([]),
    });

    expect(layout.id).toBeGreaterThan(0);
    expect(layout.name).toBe("Test Layout");
  });

  it("should get active vault layout", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.layoutEditor.vaultLayouts.getActive();
    // May be undefined if no active layout
    expect(result === undefined || typeof result === "object").toBe(true);
  });

  it("should list cabinet group layouts", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    
    // First create a vault layout
    const layout = await caller.layoutEditor.vaultLayouts.create({
      name: "Test Layout for Groups",
      description: "Test",
      layoutData: JSON.stringify([]),
    });

    const result = await caller.layoutEditor.cabinetGroupLayouts.listByVaultLayout({
      vaultLayoutId: layout.id,
    });

    expect(Array.isArray(result)).toBe(true);
  });
});
