import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { TRPCError } from "@trpc/server";
import { layoutEditorRouter } from "./routers/layoutEditor";

// Admin权限检查
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: '需要管理员权限' });
  }
  return next({ ctx });
});

export const appRouter = router({
  system: systemRouter,
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // 用户管理
  users: router({
    list: adminProcedure.query(async () => {
      return await db.getAllUsers();
    }),
    
    getById: adminProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      return await db.getUserById(input.id);
    }),
    
    updateRole: adminProcedure
      .input(z.object({ 
        id: z.number(), 
        role: z.enum(['admin', 'user']) 
      }))
      .mutation(async ({ input }) => {
        await db.updateUserRole(input.id, input.role);
        return { success: true };
      }),
    
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (input.id === ctx.user.id) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '不能删除自己的账号' });
        }
        await db.deleteUser(input.id);
        return { success: true };
      }),
  }),

  // 网关管理
  gateways: router({
    list: protectedProcedure.query(async () => {
      return await db.getAllGateways();
    }),
    
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getGatewayById(input.id);
      }),
    
    create: adminProcedure
      .input(z.object({
        name: z.string().min(1).max(100),
        ipAddress: z.string().min(1).max(45),
        port: z.number().int().min(1).max(65535),
        description: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const id = await db.createGateway(input);
        return { id, ...input };
      }),
    
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).max(100).optional(),
        ipAddress: z.string().min(1).max(45).optional(),
        port: z.number().int().min(1).max(65535).optional(),
        description: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateGateway(id, data);
        return { success: true };
      }),
    
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteGateway(input.id);
        return { success: true };
      }),

    batchDelete: adminProcedure
      .input(z.object({ ids: z.array(z.number()).min(1) }))
      .mutation(async ({ input }) => {
        for (const id of input.ids) {
          await db.deleteGateway(id);
        }
        return { success: true, count: input.ids.length };
      }),
    
    updateStatus: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(['online', 'offline']),
      }))
      .mutation(async ({ input }) => {
        await db.updateGatewayStatus(input.id, input.status, new Date());
        return { success: true };
      }),
  }),

  // 网关COM端口管理
  gatewayComPorts: router({
    listByGateway: protectedProcedure
      .input(z.object({ gatewayId: z.number() }))
      .query(async ({ input }) => {
        return await db.getComPortsByGateway(input.gatewayId);
      }),
    
    create: adminProcedure
      .input(z.object({
        gatewayId: z.number(),
        portNumber: z.string().min(1).max(10),
        baudRate: z.number().int().default(9600),
        dataBits: z.number().int().default(8),
        stopBits: z.number().int().default(1),
        parity: z.string().default("none"),
        description: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const id = await db.createComPort(input);
        return { id, ...input };
      }),
    
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        portNumber: z.string().min(1).max(10).optional(),
        baudRate: z.number().int().optional(),
        dataBits: z.number().int().optional(),
        stopBits: z.number().int().optional(),
        parity: z.string().optional(),
        description: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateComPort(id, data);
        return { success: true };
      }),
    
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteComPort(input.id);
        return { success: true };
      }),
  }),

  // 称重仪表管理
  instruments: router({
    list: protectedProcedure.query(async () => {
      return await db.getAllInstruments();
    }),
    
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getInstrumentById(input.id);
      }),
    
    getByComPort: protectedProcedure
      .input(z.object({ comPortId: z.number() }))
      .query(async ({ input }) => {
        return await db.getInstrumentsByComPortId(input.comPortId);
      }),
    
    create: adminProcedure
      .input(z.object({
        name: z.string().min(1).max(100),
        modelType: z.enum(["DY7001", "DY7004"]),
        gatewayComPortId: z.number(),
        slaveAddress: z.number().int().min(1).max(247),
        description: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const id = await db.createInstrument(input);
        return { id, ...input };
      }),
    
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).max(100).optional(),
        modelType: z.enum(["DY7001", "DY7004"]).optional(),
        gatewayComPortId: z.number().optional(),
        slaveAddress: z.number().int().min(1).max(247).optional(),
        description: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateInstrument(id, data);
        return { success: true };
      }),
    
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteInstrument(input.id);
        return { success: true };
      }),

    batchDelete: adminProcedure
      .input(z.object({ ids: z.array(z.number()).min(1) }))
      .mutation(async ({ input }) => {
        for (const id of input.ids) {
          await db.deleteInstrument(id);
        }
        return { success: true, count: input.ids.length };
      }),
    
    updateStatus: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(['online', 'offline']),
      }))
      .mutation(async ({ input }) => {
        await db.updateInstrumentStatus(input.id, input.status, new Date());
        return { success: true };
      }),
  }),

  // 保险柜组管理
  cabinetGroups: router({
    list: protectedProcedure.query(async () => {
      return await db.getAllCabinetGroups();
    }),
    
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getCabinetGroupById(input.id);
      }),
    
    create: adminProcedure
      .input(z.object({
        name: z.string().min(1).max(100),
        initialWeight: z.number().int().min(0),
        alarmThreshold: z.number().int().min(0),
        positionX: z.number().int().default(0),
        positionY: z.number().int().default(0),
        positionZ: z.number().int().default(0),
        description: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const id = await db.createCabinetGroup({
          ...input,
          currentWeight: input.initialWeight,
        });
        return { id, ...input };
      }),
    
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).max(100).optional(),
        initialWeight: z.number().int().min(0).optional(),
        alarmThreshold: z.number().int().min(0).optional(),
        positionX: z.number().int().optional(),
        positionY: z.number().int().optional(),
        positionZ: z.number().int().optional(),
        description: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateCabinetGroup(id, data);
        return { success: true };
      }),
    
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteCabinetGroup(input.id);
        return { success: true };
      }),

    batchDelete: adminProcedure
      .input(z.object({ ids: z.array(z.number()).min(1) }))
      .mutation(async ({ input }) => {
        for (const id of input.ids) {
          await db.deleteCabinetGroup(id);
        }
        return { success: true, count: input.ids.length };
      }),
    
    // 配置网关绑定
    setGatewayBinding: adminProcedure
      .input(z.object({
        cabinetGroupId: z.number(),
        gatewayComPortId: z.number(),
      }))
      .mutation(async ({ input }) => {
        await db.setGatewayBinding(input.cabinetGroupId, input.gatewayComPortId);
        return { success: true };
      }),
    
    // 获取网关绑定
    getGatewayBinding: protectedProcedure
      .input(z.object({ cabinetGroupId: z.number() }))
      .query(async ({ input }) => {
        return await db.getGatewayBinding(input.cabinetGroupId);
      }),
    
    // 添加传感器绑定
    addSensorBinding: adminProcedure
      .input(z.object({
        cabinetGroupId: z.number(),
        instrumentId: z.number(),
        sensorChannel: z.number().int().min(1).max(4),
      }))
      .mutation(async ({ input }) => {
        const id = await db.addSensorBinding(input);
        return { id, ...input };
      }),
    
    // 获取传感器绑定
    getSensorBindings: protectedProcedure
      .input(z.object({ cabinetGroupId: z.number() }))
      .query(async ({ input }) => {
        return await db.getSensorBindings(input.cabinetGroupId);
      }),
    
    // 删除传感器绑定
    removeSensorBinding: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.removeSensorBinding(input.id);
        return { success: true };
      }),
    
    updateWeight: protectedProcedure
      .input(z.object({
        id: z.number(),
        currentWeight: z.number().int().min(0),
      }))
      .mutation(async ({ input }) => {
        const group = await db.getCabinetGroupById(input.id);
        if (!group) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '保险柜组不存在' });
        }
        
        const changeValue = input.currentWeight - group.currentWeight;
        const isAlarm = Math.abs(changeValue) > group.alarmThreshold;
        const status = isAlarm ? 'alarm' : Math.abs(changeValue) > group.alarmThreshold * 0.7 ? 'warning' : 'normal';
        
        // 更新重量
        await db.updateCabinetGroupWeight(input.id, input.currentWeight, status);
        
        // 记录重量变化
        await db.createWeightChangeRecord({
          cabinetGroupId: input.id,
          previousWeight: group.currentWeight,
          currentWeight: input.currentWeight,
          changeValue,
          isAlarm: isAlarm ? 1 : 0,
        });
        
        // 如果触发报警，创建报警记录
        if (isAlarm) {
          await db.createAlarmRecord({
            cabinetGroupId: input.id,
            weightChangeRecordId: 0,
            alarmType: 'threshold_exceeded',
            alarmMessage: `重量变化${changeValue > 0 ? '增加' : '减少'}${Math.abs(changeValue)}克，超过阈值${group.alarmThreshold}克`,
          });
        }
        
        return { success: true, isAlarm, status };
      }),
  }),

  // 重量变化记录
  weightRecords: router({
    list: protectedProcedure
      .input(z.object({
        cabinetGroupId: z.number().optional(),
        limit: z.number().int().min(1).max(1000).default(100),
      }))
      .query(async ({ input }) => {
        if (input.cabinetGroupId) {
          return await db.getWeightChangeRecordsByCabinetGroup(input.cabinetGroupId, input.limit);
        }
        return await db.getAllWeightChangeRecords(input.limit);
      }),
    
    getByDateRange: protectedProcedure
      .input(z.object({
        startDate: z.date(),
        endDate: z.date(),
      }))
      .query(async ({ input }) => {
        return await db.getWeightChangeRecordsByDateRange(input.startDate, input.endDate);
      }),
  }),

  // 报警记录
  alarms: router({
    list: protectedProcedure
      .input(z.object({
        cabinetGroupId: z.number().optional(),
        limit: z.number().int().min(1).max(1000).default(100),
      }))
      .query(async ({ input }) => {
        if (input.cabinetGroupId) {
          return await db.getAlarmRecordsByCabinetGroup(input.cabinetGroupId, input.limit);
        }
        return await db.getAllAlarmRecords(input.limit);
      }),
    
    getUnhandled: protectedProcedure.query(async () => {
      return await db.getUnhandledAlarmRecords();
    }),
    
    handle: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.handleAlarmRecord(input.id, ctx.user.id);
        return { success: true };
      }),
  }),

  layoutEditor: layoutEditorRouter,
});

export type AppRouter = typeof appRouter;
