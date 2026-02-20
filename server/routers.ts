import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router, createModuleViewProcedure, createModuleOperateProcedure } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { TRPCError } from "@trpc/server";
import { layoutEditorRouter } from "./routers/layoutEditor";
import { sdk } from "./_core/sdk";

// Admin权限检查
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: '需要管理员权限' });
  }
  return next({ ctx });
});

// 各模块的查看/操作权限中间件
const gatewayView = createModuleViewProcedure('gateway_config');
const gatewayOperate = createModuleOperateProcedure('gateway_config');
const instrumentView = createModuleViewProcedure('instrument_config');
const instrumentOperate = createModuleOperateProcedure('instrument_config');
const cabinetView = createModuleViewProcedure('cabinet_group');
const cabinetOperate = createModuleOperateProcedure('cabinet_group');
const recordsView = createModuleViewProcedure('data_records');
const alarmView = createModuleViewProcedure('alarm_management');
const alarmOperate = createModuleOperateProcedure('alarm_management');
const analyticsView = createModuleViewProcedure('data_analysis');
const auditView = createModuleViewProcedure('audit_logs');
const dashboardView = createModuleViewProcedure('dashboard');
const layoutView = createModuleViewProcedure('layout_editor');
const layoutOperate = createModuleOperateProcedure('layout_editor');

/** 记录审计日志的辅助函数 */
async function audit(userId: number, userName: string | null, action: string, targetType: string, targetId: number | null, summary: string, details?: unknown) {
  try {
    await db.createAuditLog({
      userId,
      userName: userName || undefined,
      action,
      targetType,
      targetId: targetId || undefined,
      summary,
      details: details ? JSON.stringify(details) : undefined,
    });
  } catch (e) {
    console.error("[Audit] Failed to log:", e);
  }
}

export const appRouter = router({
  system: systemRouter,
  
  auth: router({
    me: publicProcedure.query(opts => {
      if (!opts.ctx.user) return null;
      // 不返回passwordHash
      const { passwordHash, ...safeUser } = opts.ctx.user;
      return safeUser;
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
    /** 修改当前用户密码 */
    changePassword: protectedProcedure
      .input(z.object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(6, '新密码至少6位'),
      }))
      .mutation(async ({ input, ctx }) => {
        const user = await db.getUserById(ctx.user.id);
        if (!user) throw new TRPCError({ code: 'NOT_FOUND', message: '用户不存在' });
        const isValid = await db.verifyPassword(input.currentPassword, user.passwordHash);
        if (!isValid) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '当前密码错误' });
        }
        await db.updateUserPassword(ctx.user.id, input.newPassword);
        await audit(ctx.user.id, ctx.user.name, 'change_password', 'user', ctx.user.id, `用户 ${ctx.user.username} 修改了密码`);
        return { success: true };
      }),
  }),

  // 用户管理
  users: router({
    list: adminProcedure.query(async () => {
      return await db.getAllUsers();
    }),
    
    getById: adminProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      const user = await db.getUserById(input.id);
      if (!user) return undefined;
      const { passwordHash, ...safeUser } = user;
      return safeUser;
    }),

    /** 创建操作员账户 */
    create: adminProcedure
      .input(z.object({
        username: z.string().min(2, '用户名至少2位').max(64),
        password: z.string().min(6, '密码至少6位'),
        name: z.string().optional(),
        role: z.enum(['admin', 'operator']).default('operator'),
      }))
      .mutation(async ({ input, ctx }) => {
        // 检查用户名是否已存在
        const conflict = await db.checkUsernameConflict(input.username);
        if (conflict) {
          throw new TRPCError({ code: 'CONFLICT', message: '用户名已存在' });
        }
        const id = await db.createUser({
          username: input.username,
          password: input.password,
          name: input.name || input.username,
          role: input.role,
        });
        await audit(ctx.user.id, ctx.user.name, 'create_user', 'user', id, `创建用户 ${input.username} (角色: ${input.role})`);
        return { success: true, id };
      }),

    /** 更新用户信息 */
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        username: z.string().min(2).max(64).optional(),
        name: z.string().optional(),
        role: z.enum(['admin', 'operator']).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // 检查用户名冲突
        if (input.username) {
          const conflict = await db.checkUsernameConflict(input.username, input.id);
          if (conflict) {
            throw new TRPCError({ code: 'CONFLICT', message: '用户名已存在' });
          }
        }
        await db.updateUser(input.id, {
          username: input.username,
          name: input.name,
          role: input.role,
        });
        await audit(ctx.user.id, ctx.user.name, 'update_user', 'user', input.id, `更新用户 #${input.id} 信息`);
        return { success: true };
      }),

    /** 重置用户密码（管理员专用） */
    resetPassword: adminProcedure
      .input(z.object({
        id: z.number(),
        newPassword: z.string().min(6, '密码至少6位'),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.updateUserPassword(input.id, input.newPassword);
        await audit(ctx.user.id, ctx.user.name, 'reset_password', 'user', input.id, `管理员重置用户 #${input.id} 的密码`);
        return { success: true };
      }),
    
    updateRole: adminProcedure
      .input(z.object({ 
        id: z.number(), 
        role: z.enum(['admin', 'operator']) 
      }))
      .mutation(async ({ input, ctx }) => {
        await db.updateUserRole(input.id, input.role);
        await audit(ctx.user.id, ctx.user.name, 'update_role', 'user', input.id, `更新用户 #${input.id} 角色为 ${input.role}`);
        return { success: true };
      }),
    
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (input.id === ctx.user.id) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '不能删除自己的账号' });
        }
        const targetUser = await db.getUserById(input.id);
        await db.deleteUser(input.id);
        await db.deleteUserPermissions(input.id);
        await audit(ctx.user.id, ctx.user.name, 'delete_user', 'user', input.id, `删除用户 ${targetUser?.username || '#' + input.id}`);
        return { success: true };
      }),

    getPermissions: adminProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        return await db.getUserPermissions(input.userId);
      }),

    setPermissions: adminProcedure
      .input(z.object({
        userId: z.number(),
        permissions: z.array(z.object({
          module: z.string(),
          canView: z.number().min(0).max(1),
          canOperate: z.number().min(0).max(1),
        })),
      }))
      .mutation(async ({ input, ctx }) => {
        const targetUser = await db.getUserById(input.userId);
        if (targetUser?.role === 'admin') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '管理员拥有所有权限，无需配置' });
        }
        await db.setUserPermissions(input.userId, input.permissions);
        await audit(ctx.user.id, ctx.user.name, 'update_permissions', 'user', input.userId, `更新用户 #${input.userId} 的权限配置`, input.permissions);
        return { success: true };
      }),

    getModules: protectedProcedure.query(() => {
      return db.SYSTEM_MODULES;
    }),

    myPermissions: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role === 'admin') {
        return db.SYSTEM_MODULES.map(m => ({
          module: m.id,
          canView: 1,
          canOperate: 1,
        }));
      }
      return await db.getUserPermissions(ctx.user.id);
    }),
  }),

  // 网关管理
  gateways: router({
    list: gatewayView.query(async () => {
      return await db.getAllGateways();
    }),
    
    getById: gatewayView
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getGatewayById(input.id);
      }),
    
    create: gatewayOperate
      .input(z.object({
        name: z.string().min(1).max(100),
        ipAddress: z.string().min(1).max(45),
        port: z.number().int().min(1).max(65535),
        model: z.string().max(50).optional(),
        remark: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const id = await db.createGateway(input);
        await audit(ctx.user.id, ctx.user.name, "create", "gateway", id, `创建网关: ${input.name}`, input);
        return { id, ...input };
      }),
    
    update: gatewayOperate
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).max(100).optional(),
        ipAddress: z.string().min(1).max(45).optional(),
        port: z.number().int().min(1).max(65535).optional(),
        model: z.string().max(50).optional(),
        remark: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        await db.updateGateway(id, data);
        await audit(ctx.user.id, ctx.user.name, "update", "gateway", id, `更新网关 #${id}`, data);
        return { success: true };
      }),
    
    delete: gatewayOperate
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.deleteGateway(input.id);
        await audit(ctx.user.id, ctx.user.name, "delete", "gateway", input.id, `删除网关 #${input.id}`);
        return { success: true };
      }),

    batchDelete: gatewayOperate
      .input(z.object({ ids: z.array(z.number()).min(1) }))
      .mutation(async ({ input, ctx }) => {
        for (const id of input.ids) {
          await db.deleteGateway(id);
        }
        await audit(ctx.user.id, ctx.user.name, "batchDelete", "gateway", null, `批量删除网关: ${input.ids.join(",")}`, { ids: input.ids });
        return { success: true, count: input.ids.length };
      }),
    
    updateStatus: gatewayOperate
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
    listAll: gatewayView.query(async () => {
      return await db.getAllComPorts();
    }),

    listByGateway: gatewayView
      .input(z.object({ gatewayId: z.number() }))
      .query(async ({ input }) => {
        return await db.getComPortsByGateway(input.gatewayId);
      }),
    
    create: gatewayOperate
      .input(z.object({
        gatewayId: z.number(),
        portNumber: z.string().min(1).max(10),
        baudRate: z.number().int().default(9600),
        dataBits: z.number().int().default(8),
        stopBits: z.number().int().default(1),
        parity: z.string().default("none"),
        protocolType: z.string().max(30).default("modbus_rtu"),
        timeoutMs: z.number().int().default(1000),
        retryCount: z.number().int().default(3),
        remark: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const id = await db.createComPort(input);
        await audit(ctx.user.id, ctx.user.name, "create", "comPort", id, `创建COM端口: ${input.portNumber}`, input);
        return { id, ...input };
      }),
    
    update: gatewayOperate
      .input(z.object({
        id: z.number(),
        portNumber: z.string().min(1).max(10).optional(),
        baudRate: z.number().int().optional(),
        dataBits: z.number().int().optional(),
        stopBits: z.number().int().optional(),
        parity: z.string().optional(),
        protocolType: z.string().max(30).optional(),
        timeoutMs: z.number().int().optional(),
        retryCount: z.number().int().optional(),
        remark: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        await db.updateComPort(id, data);
        await audit(ctx.user.id, ctx.user.name, "update", "comPort", id, `更新COM端口 #${id}`, data);
        return { success: true };
      }),
    
    delete: gatewayOperate
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        // 检查是否有仪表绑定到此COM端口
        const instruments = await db.getInstrumentsByComPortId(input.id);
        if (instruments.length > 0) {
          throw new TRPCError({ 
            code: 'BAD_REQUEST', 
            message: `该COM端口下有 ${instruments.length} 个仪表，请先删除或迁移仪表` 
          });
        }
        await db.deleteComPort(input.id);
        await audit(ctx.user.id, ctx.user.name, "delete", "comPort", input.id, `删除COM端口 #${input.id}`);
        return { success: true };
      }),
  }),

  // 称重仪表管理
  instruments: router({
    list: instrumentView.query(async () => {
      return await db.getAllInstruments();
    }),
    
    getById: instrumentView
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getInstrumentById(input.id);
      }),
    
    getByComPort: instrumentView
      .input(z.object({ comPortId: z.number() }))
      .query(async ({ input }) => {
        return await db.getInstrumentsByComPortId(input.comPortId);
      }),
    
    create: instrumentOperate
      .input(z.object({
        deviceCode: z.string().min(1).max(50),
        modelType: z.enum(["DY7001", "DY7004"]),
        slaveId: z.number().int().min(1).max(247),
        comPortId: z.number(),
        name: z.string().max(100).optional(),
        location: z.string().optional(),
        remark: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // 检查deviceCode唯一性
        const codeConflict = await db.checkDeviceCodeConflict(input.deviceCode);
        if (codeConflict) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: `设备编码 ${input.deviceCode} 已存在` });
        }
        // 检查同一COM端口下slaveId唯一性
        const slaveConflict = await db.checkSlaveIdConflict(input.comPortId, input.slaveId);
        if (slaveConflict) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: `该COM端口下从站地址 ${input.slaveId} 已被占用` });
        }
        
        const id = await db.createInstrument(input);
        // 自动生成通道
        const channelIds = await db.autoGenerateChannels(id, input.modelType);
        
        await audit(ctx.user.id, ctx.user.name, "create", "instrument", id, `创建仪表: ${input.deviceCode} (${input.modelType})`, { ...input, channelIds });
        return { id, channelIds, ...input };
      }),
    
    update: instrumentOperate
      .input(z.object({
        id: z.number(),
        deviceCode: z.string().min(1).max(50).optional(),
        name: z.string().max(100).optional(),
        modelType: z.enum(["DY7001", "DY7004"]).optional(),
        slaveId: z.number().int().min(1).max(247).optional(),
        comPortId: z.number().optional(),
        location: z.string().optional(),
        remark: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        const existing = await db.getInstrumentById(id);
        if (!existing) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '仪表不存在' });
        }
        
        // 检查deviceCode唯一性
        if (data.deviceCode) {
          const codeConflict = await db.checkDeviceCodeConflict(data.deviceCode, id);
          if (codeConflict) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: `设备编码 ${data.deviceCode} 已存在` });
          }
        }
        
        // 检查slaveId唯一性
        const targetComPortId = data.comPortId || existing.comPortId;
        const targetSlaveId = data.slaveId || existing.slaveId;
        if (data.slaveId || data.comPortId) {
          const slaveConflict = await db.checkSlaveIdConflict(targetComPortId, targetSlaveId, id);
          if (slaveConflict) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: `该COM端口下从站地址 ${targetSlaveId} 已被占用` });
          }
        }
        
        await db.updateInstrument(id, data);
        
        // 如果型号变更，需要调整通道数量
        if (data.modelType && data.modelType !== existing.modelType) {
          const oldChannelCount = existing.modelType === "DY7001" ? 1 : 4;
          const newChannelCount = data.modelType === "DY7001" ? 1 : 4;
          
          if (newChannelCount > oldChannelCount) {
            // 型号升级（如DY7001→DY7004）：补充新通道
            const existingChannels = await db.getChannelsByInstrument(id);
            const existingNos = new Set(existingChannels.map(ch => ch.channelNo));
            for (let i = 1; i <= newChannelCount; i++) {
              if (!existingNos.has(i)) {
                await db.createChannel({
                  instrumentId: id,
                  channelNo: i,
                  label: `CH${i}`,
                  enabled: 1,
                  scale: 1.0,
                  offset: 0.0,
                  unit: "g",
                  precision: 2,
                });
              }
            }
          } else if (newChannelCount < oldChannelCount) {
            // 型号降级（如DY7004→DY7001）：删除多余通道（先解除绑定）
            const existingChannels = await db.getChannelsByInstrument(id);
            const toRemove = existingChannels.filter(ch => ch.channelNo > newChannelCount);
            for (const ch of toRemove) {
              await db.deleteBindingsByChannel(ch.id);
              await db.deleteChannel(ch.id);
            }
          }
        }
        
        await audit(ctx.user.id, ctx.user.name, "update", "instrument", id, `更新仪表 #${id}`, data);
        return { success: true };
      }),
    
    delete: instrumentOperate
      .input(z.object({ id: z.number(), force: z.boolean().optional() }))
      .mutation(async ({ input, ctx }) => {
        // 检查通道是否有柜组绑定
        const channels = await db.getChannelsByInstrument(input.id);
        const boundChannels: string[] = [];
        for (const ch of channels) {
          const bindings = await db.getBindingsByChannel(ch.id);
          if (bindings.length > 0) {
            boundChannels.push(ch.label);
          }
        }
        if (boundChannels.length > 0 && !input.force) {
          // 返回需要确认的信息，而非直接报错
          return { success: false, needConfirm: true, boundChannels };
        }
        // 级联删除：先解除所有通道绑定
        for (const ch of channels) {
          await db.deleteBindingsByChannel(ch.id);
        }
        // 删除通道
        await db.deleteChannelsByInstrument(input.id);
        // 删除仪表
        await db.deleteInstrument(input.id);
        const detail = boundChannels.length > 0 ? `（已自动解除 ${boundChannels.join(',')} 的柜组绑定）` : '';
        await audit(ctx.user.id, ctx.user.name, "delete", "instrument", input.id, `删除仪表 #${input.id}${detail}`);
        return { success: true };
      }),

    batchDelete: instrumentOperate
      .input(z.object({ ids: z.array(z.number()).min(1), force: z.boolean().optional() }))
      .mutation(async ({ input, ctx }) => {
        // 批量获取所有相关通道
        const allChannels = await db.getChannelsByInstrumentIds(input.ids);
        const allChannelIds = allChannels.map(ch => ch.id);

        // 检查绑定情况（如果有通道的话）
        if (allChannelIds.length > 0 && !input.force) {
          const boundChannels = await db.getBoundChannelIds(allChannelIds);
          if (boundChannels.length > 0) {
            // 组装绑定信息
            const boundSet = new Set(boundChannels);
            const allBound: { id: number; channels: string[] }[] = [];
            for (const id of input.ids) {
              const bound = allChannels
                .filter(ch => ch.instrumentId === id && boundSet.has(ch.id))
                .map(ch => ch.label);
              if (bound.length > 0) allBound.push({ id, channels: bound });
            }
            if (allBound.length > 0) {
              return { success: false, needConfirm: true, boundInstruments: allBound, count: 0 };
            }
          }
        }

        // 批量级联删除：绑定 → 通道 → 仪表
        if (allChannelIds.length > 0) {
          await db.deleteBindingsByChannelIds(allChannelIds);
          await db.deleteChannelsByInstrumentIds(input.ids);
        }
        await db.deleteInstrumentsByIds(input.ids);
        await audit(ctx.user.id, ctx.user.name, "batchDelete", "instrument", null, `批量删除仪表: ${input.ids.join(",")}（含级联解绑）`, { ids: input.ids });
        return { success: true, count: input.ids.length };
      }),
    
    updateStatus: instrumentOperate
      .input(z.object({
        id: z.number(),
        status: z.enum(['online', 'offline']),
      }))
      .mutation(async ({ input }) => {
        await db.updateInstrumentStatus(input.id, input.status, new Date());
        return { success: true };
      }),

    /** 影响分析：删除前检查关联柜组 */
    impactAnalysis: instrumentView
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const channels = await db.getChannelsByInstrument(input.id);
        const affectedGroups: { groupId: number; channelLabel: string }[] = [];
        for (const ch of channels) {
          const bindings = await db.getBindingsByChannel(ch.id);
          for (const b of bindings) {
            affectedGroups.push({ groupId: b.groupId, channelLabel: ch.label });
          }
        }
        return { affectedGroups, channelCount: channels.length };
      }),
  }),

  // 仪表通道管理
  channels: router({
    listByInstrument: instrumentView
      .input(z.object({ instrumentId: z.number() }))
      .query(async ({ input }) => {
        return await db.getChannelsByInstrument(input.instrumentId);
      }),
    
    listAll: instrumentView.query(async () => {
      return await db.getAllChannels();
    }),

    getById: instrumentView
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getChannelById(input.id);
      }),
    
    update: instrumentOperate
      .input(z.object({
        id: z.number(),
        label: z.string().min(1).max(50).optional(),
        enabled: z.number().int().min(0).max(1).optional(),
        scale: z.number().optional(),
        offset: z.number().optional(),
        unit: z.string().max(10).optional(),
        precision: z.number().int().min(0).max(6).optional(),
        remark: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        await db.updateChannel(id, data);
        await audit(ctx.user.id, ctx.user.name, "update", "channel", id, `更新通道 #${id}`, data);
        return { success: true };
      }),

    /** 通信测试：模拟读取仪表通道值 */
    testRead: instrumentOperate
      .input(z.object({ channelId: z.number() }))
      .mutation(async ({ input }) => {
        const channel = await db.getChannelById(input.channelId);
        if (!channel) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '通道不存在' });
        }
        // 模拟读取：生成随机值
        const rawValue = Math.random() * 100;
        const calibratedValue = rawValue * channel.scale + channel.offset;
        // 更新通道当前值
        await db.updateChannel(input.channelId, { 
          currentValue: calibratedValue,
          lastReadAt: new Date(),
        });
        return { 
          success: true, 
          rawValue: Number(rawValue.toFixed(channel.precision)),
          calibratedValue: Number(calibratedValue.toFixed(channel.precision)),
          unit: channel.unit,
        };
      }),
  }),

  // 保险柜组管理
  cabinetGroups: router({
    list: cabinetView.query(async () => {
      return await db.getAllCabinetGroups();
    }),
    
    getById: cabinetView
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getCabinetGroupById(input.id);
      }),
    
    create: cabinetOperate
      .input(z.object({
        area: z.string().max(100).optional(),
        name: z.string().min(1).max(100),
        initialWeight: z.number().min(0).default(0),
        alarmThreshold: z.number().min(0).default(5),
        remark: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const id = await db.createCabinetGroup({
          ...input,
          area: input.area || "",
          currentWeight: input.initialWeight,
        });
        await audit(ctx.user.id, ctx.user.name, "create", "cabinetGroup", id, `创建柜组: ${input.name}`, input);
        return { id, ...input };
      }),
    
    update: cabinetOperate
      .input(z.object({
        id: z.number(),
        area: z.string().max(100).optional(),
        name: z.string().min(1).max(100).optional(),
        initialWeight: z.number().min(0).optional(),
        alarmThreshold: z.number().min(0).optional(),
        remark: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        await db.updateCabinetGroup(id, data);
        await audit(ctx.user.id, ctx.user.name, "update", "cabinetGroup", id, `更新柜组 #${id}`, data);
        return { success: true };
      }),
    
    delete: cabinetOperate
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        // 删除关联的通道绑定
        await db.deleteBindingsByGroup(input.id);
        await db.deleteCabinetGroup(input.id);
        await audit(ctx.user.id, ctx.user.name, "delete", "cabinetGroup", input.id, `删除柜组 #${input.id}`);
        return { success: true };
      }),

    batchDelete: cabinetOperate
      .input(z.object({ ids: z.array(z.number()).min(1) }))
      .mutation(async ({ input, ctx }) => {
        for (const id of input.ids) {
          await db.deleteBindingsByGroup(id);
          await db.deleteCabinetGroup(id);
        }
        await audit(ctx.user.id, ctx.user.name, "batchDelete", "cabinetGroup", null, `批量删除柜组: ${input.ids.join(",")}`, { ids: input.ids });
        return { success: true, count: input.ids.length };
      }),

    // 获取柜组关联的仪表和通道树形结构
    getBoundInstruments: cabinetView
      .input(z.object({ groupId: z.number() }))
      .query(async ({ input }) => {
        return await db.getGroupBoundInstruments(input.groupId);
      }),

    // 通道绑定管理
    getBindings: cabinetView
      .input(z.object({ groupId: z.number() }))
      .query(async ({ input }) => {
        return await db.getBindingsByGroup(input.groupId);
      }),

    addBinding: cabinetOperate
      .input(z.object({
        groupId: z.number(),
        channelId: z.number(),
        coefficient: z.number().default(1.0),
        offset: z.number().default(0.0),
        sortOrder: z.number().int().default(0),
      }))
      .mutation(async ({ input, ctx }) => {
        // 检查通道是否存在且启用
        const channel = await db.getChannelById(input.channelId);
        if (!channel) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '通道不存在' });
        }
        if (!channel.enabled) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '通道未启用' });
        }
        // 检查通道是否已被其他柜组绑定
        const conflict = await db.checkChannelBindingConflict(input.channelId, input.groupId);
        if (conflict) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '该通道已被其他柜组绑定' });
        }
        // 检查同一柜组是否已绑定此通道
        const existingBindings = await db.getBindingsByGroup(input.groupId);
        if (existingBindings.some(b => b.channelId === input.channelId)) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '该柜组已绑定此通道' });
        }
        
        const id = await db.createBinding(input);
        await audit(ctx.user.id, ctx.user.name, "addBinding", "groupChannelBinding", id, `柜组#${input.groupId}绑定通道#${input.channelId}`, input);
        return { id, ...input };
      }),

    batchAddBinding: cabinetOperate
      .input(z.object({
        groupId: z.number(),
        channels: z.array(z.object({
          channelId: z.number(),
          coefficient: z.number().default(1.0),
          offset: z.number().default(0.0),
        })),
      }))
      .mutation(async ({ input, ctx }) => {
        const results: { channelId: number; success: boolean; error?: string; id?: number }[] = [];
        const existingBindings = await db.getBindingsByGroup(input.groupId);
        const existingChannelIds = new Set(existingBindings.map(b => b.channelId));
        
        for (const ch of input.channels) {
          // 跳过已绑定的
          if (existingChannelIds.has(ch.channelId)) {
            results.push({ channelId: ch.channelId, success: false, error: '已绑定' });
            continue;
          }
          // 检查通道是否存在且启用
          const channel = await db.getChannelById(ch.channelId);
          if (!channel) {
            results.push({ channelId: ch.channelId, success: false, error: '通道不存在' });
            continue;
          }
          if (!channel.enabled) {
            results.push({ channelId: ch.channelId, success: false, error: '通道未启用' });
            continue;
          }
          // 检查是否被其他柜组绑定
          const conflict = await db.checkChannelBindingConflict(ch.channelId, input.groupId);
          if (conflict) {
            results.push({ channelId: ch.channelId, success: false, error: '已被其他柜组绑定' });
            continue;
          }
          const id = await db.createBinding({ groupId: input.groupId, channelId: ch.channelId, coefficient: ch.coefficient, offset: ch.offset });
          results.push({ channelId: ch.channelId, success: true, id });
        }
        const successCount = results.filter(r => r.success).length;
        if (successCount > 0) {
          await audit(ctx.user.id, ctx.user.name, "batchAddBinding", "groupChannelBinding", input.groupId, `柜组#${input.groupId}批量绑定${successCount}个通道`, { results });
        }
        return { results, successCount, failCount: results.length - successCount };
      }),

    updateBinding: cabinetOperate
      .input(z.object({
        id: z.number(),
        coefficient: z.number().optional(),
        offset: z.number().optional(),
        sortOrder: z.number().int().optional(),
        enabled: z.number().int().min(0).max(1).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        await db.updateBinding(id, data);
        await audit(ctx.user.id, ctx.user.name, "updateBinding", "groupChannelBinding", id, `更新绑定 #${id}`, data);
        return { success: true };
      }),

    removeBinding: cabinetOperate
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.deleteBinding(input.id);
        await audit(ctx.user.id, ctx.user.name, "removeBinding", "groupChannelBinding", input.id, `移除绑定 #${input.id}`);
        return { success: true };
      }),
    
    updateWeight: cabinetOperate
      .input(z.object({
        id: z.number(),
        currentWeight: z.number().min(0),
      }))
      .mutation(async ({ input }) => {
        const group = await db.getCabinetGroupById(input.id);
        if (!group) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '保险柜组不存在' });
        }
        
        const changeValue = input.currentWeight - group.currentWeight;
        const isAlarm = Math.abs(changeValue) > group.alarmThreshold;
        const status = isAlarm ? 'alarm' : Math.abs(changeValue) > group.alarmThreshold * 0.7 ? 'warning' : 'normal';
        
        await db.updateCabinetGroupWeight(input.id, input.currentWeight, status);
        
        await db.createWeightChangeRecord({
          cabinetGroupId: input.id,
          previousWeight: group.currentWeight,
          currentWeight: input.currentWeight,
          changeValue,
          isAlarm: isAlarm ? 1 : 0,
        });
        
        if (isAlarm) {
          await db.createAlarmRecord({
            cabinetGroupId: input.id,
            weightChangeRecordId: 0,
            alarmType: 'threshold_exceeded',
            alarmMessage: `重量变化${changeValue > 0 ? '增加' : '减少'}${Math.abs(changeValue).toFixed(2)}kg，超过阈值${group.alarmThreshold}kg`,
          });
        }
        
        return { success: true, isAlarm, status };
      }),
  }),

  // 重量变化记录
  weightRecords: router({
    list: recordsView
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
    
    getByDateRange: recordsView
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
    list: alarmView
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
    
    getUnhandled: alarmView.query(async () => {
      return await db.getUnhandledAlarmRecords();
    }),
    
    handle: alarmOperate
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.handleAlarmRecord(input.id, ctx.user.id);
        return { success: true };
      }),
  }),

  // 审计日志
  auditLogs: router({
    list: auditView
      .input(z.object({
        limit: z.number().int().min(1).max(500).default(200),
      }))
      .query(async ({ input }) => {
        return await db.getAuditLogs(input.limit);
      }),
    
    getByTarget: auditView
      .input(z.object({
        targetType: z.string(),
        targetId: z.number(),
        limit: z.number().int().min(1).max(100).default(50),
      }))
      .query(async ({ input }) => {
        return await db.getAuditLogsByTarget(input.targetType, input.targetId, input.limit);
      }),
  }),

  layoutEditor: layoutEditorRouter,

  // 实时监视专用路由（使用dashboard权限，避免跨模块权限冲突）
  monitor: router({
    /** 获取激活布局（dashboard权限即可查看） */
    getActiveLayout: dashboardView.query(async () => {
      const layout = await db.getActiveVaultLayout();
      return layout || null;
    }),
    /** 获取所有柜组状态（dashboard权限即可查看） */
    getCabinetGroups: dashboardView.query(async () => {
      return await db.getAllCabinetGroups();
    }),
  }),
});

export type AppRouter = typeof appRouter;
