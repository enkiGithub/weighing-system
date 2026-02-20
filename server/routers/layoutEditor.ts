import { protectedProcedure, adminProcedure, router, createModuleViewProcedure, createModuleOperateProcedure } from "../_core/trpc";

const layoutView = createModuleViewProcedure('layout_editor');
const layoutOperate = createModuleOperateProcedure('layout_editor');
import { z } from "zod";
import * as db from "../db";
import { TRPCError } from "@trpc/server";

// 布局实例的JSON结构验证
const instanceSchema = z.object({
  instanceId: z.string(),
  type: z.enum(["cabinetGroup"]),
  cabinetGroupId: z.number().nullable(),
  transform: z.object({
    position: z.object({ x: z.number(), y: z.number(), z: z.number() }),
    rotation: z.object({ x: z.number(), y: z.number(), z: z.number() }),
    scale: z.object({ x: z.number(), y: z.number(), z: z.number() }),
  }),
  model: z.object({
    columns: z.number().int().min(1).max(20).default(2),
    columnSpacing: z.number().default(0.05),
    cabinetWidth: z.number().default(0.6),
    cabinetHeight: z.number().default(1.8),
    cabinetDepth: z.number().default(0.5),
    shelves: z.number().int().min(1).max(20).default(6),
  }),
  meta: z.object({
    label: z.string().default(""),
    remark: z.string().default(""),
  }).default({ label: "", remark: "" }),
});

const layoutDataSchema = z.object({
  scene: z.object({
    gridSize: z.number().default(20),
    unit: z.string().default("m"),
    cameraDefault: z.object({
      position: z.object({ x: z.number(), y: z.number(), z: z.number() }).default({ x: 8, y: 6, z: 8 }),
      target: z.object({ x: z.number(), y: z.number(), z: z.number() }).default({ x: 0, y: 0, z: 0 }),
    }).default({ position: { x: 8, y: 6, z: 8 }, target: { x: 0, y: 0, z: 0 } }),
  }).default({ gridSize: 20, unit: "m", cameraDefault: { position: { x: 8, y: 6, z: 8 }, target: { x: 0, y: 0, z: 0 } } }),
  instances: z.array(instanceSchema).default([]),
});

export const layoutEditorRouter = router({
  // 保管库布局管理
  vaultLayouts: router({
    list: layoutView.query(async () => {
      return await db.getAllVaultLayouts();
    }),

    getById: layoutView
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const layout = await db.getVaultLayoutById(input.id);
        return layout || null;
      }),

    getActive: layoutView.query(async () => {
      const layout = await db.getActiveVaultLayout();
      return layout || null;
    }),

    create: layoutOperate
      .input(z.object({
        name: z.string().min(1).max(100),
        description: z.string().optional(),
        layoutData: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        // 验证layoutData是合法JSON
        try {
          const parsed = JSON.parse(input.layoutData);
          layoutDataSchema.parse(parsed);
        } catch {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '布局数据格式不正确' });
        }
        const id = await db.createVaultLayout({
          ...input,
          createdBy: ctx.user.id,
        });
        return { id, ...input };
      }),

    update: layoutOperate
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).max(100).optional(),
        description: z.string().optional(),
        layoutData: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        // 如果更新了layoutData，验证绑定冲突
        if (input.layoutData) {
          try {
            const parsed = JSON.parse(input.layoutData);
            const data = layoutDataSchema.parse(parsed);
            
            // 检查同一布局内是否有重复绑定
            const boundIds = data.instances
              .filter((inst: z.infer<typeof instanceSchema>) => inst.cabinetGroupId !== null)
              .map((inst: z.infer<typeof instanceSchema>) => inst.cabinetGroupId);
            const uniqueIds = new Set(boundIds);
            if (boundIds.length !== uniqueIds.size) {
              throw new TRPCError({ 
                code: 'BAD_REQUEST', 
                message: '同一布局内不允许重复绑定同一个柜组资产' 
              });
            }

            // 检查绑定的柜组是否存在
            for (const groupId of boundIds) {
              if (groupId !== null) {
                const group = await db.getCabinetGroupById(groupId);
                if (!group) {
                  throw new TRPCError({ 
                    code: 'BAD_REQUEST', 
                    message: `柜组资产ID ${groupId} 不存在` 
                  });
                }
              }
            }
          } catch (e) {
            if (e instanceof TRPCError) throw e;
            throw new TRPCError({ code: 'BAD_REQUEST', message: '布局数据格式不正确' });
          }
        }

        const { id, ...data } = input;
        await db.updateVaultLayout(id, data);
        return { success: true };
      }),

    delete: layoutOperate
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteVaultLayout(input.id);
        return { success: true };
      }),

    setActive: layoutOperate
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.setActiveVaultLayout(input.id);
        return { success: true };
      }),
  }),
});
