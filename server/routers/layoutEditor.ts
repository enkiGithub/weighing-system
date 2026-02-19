import { protectedProcedure, adminProcedure, router } from "../_core/trpc";
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
  // 柜子管理（最小单元）
  cabinets: router({
    list: protectedProcedure.query(async () => {
      return await db.getAllCabinets();
    }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getCabinetById(input.id);
      }),

    create: adminProcedure
      .input(z.object({
        name: z.string().min(1).max(100),
        width: z.number().int().positive(),
        height: z.number().int().positive(),
        depth: z.number().int().positive(),
        description: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const id = await db.createCabinet(input);
        return { id, ...input };
      }),

    update: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).max(100).optional(),
        width: z.number().int().positive().optional(),
        height: z.number().int().positive().optional(),
        depth: z.number().int().positive().optional(),
        description: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateCabinet(id, data);
        return { success: true };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteCabinet(input.id);
        return { success: true };
      }),
  }),

  // 保管库布局管理
  vaultLayouts: router({
    list: protectedProcedure.query(async () => {
      return await db.getAllVaultLayouts();
    }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const layout = await db.getVaultLayoutById(input.id);
        return layout || null;
      }),

    getActive: protectedProcedure.query(async () => {
      const layout = await db.getActiveVaultLayout();
      return layout || null;
    }),

    create: adminProcedure
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

    update: adminProcedure
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

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteCabinetGroupLayoutsByVaultLayout(input.id);
        await db.deleteVaultLayout(input.id);
        return { success: true };
      }),

    setActive: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.setActiveVaultLayout(input.id);
        return { success: true };
      }),
  }),

  // 柜组布局管理（兼容旧接口）
  cabinetGroupLayouts: router({
    listByVaultLayout: protectedProcedure
      .input(z.object({ vaultLayoutId: z.number() }))
      .query(async ({ input }) => {
        return await db.getCabinetGroupLayoutsByVaultLayout(input.vaultLayoutId);
      }),

    create: adminProcedure
      .input(z.object({
        vaultLayoutId: z.number(),
        cabinetGroupId: z.number(),
        positionX: z.number().int().default(0),
        positionY: z.number().int().default(0),
        positionZ: z.number().int().default(0),
        rotationX: z.number().int().default(0),
        rotationY: z.number().int().default(0),
        rotationZ: z.number().int().default(0),
        scaleX: z.number().int().default(100),
        scaleY: z.number().int().default(100),
        scaleZ: z.number().int().default(100),
      }))
      .mutation(async ({ input }) => {
        const id = await db.createCabinetGroupLayout(input);
        return { id, ...input };
      }),

    update: adminProcedure
      .input(z.object({
        id: z.number(),
        positionX: z.number().int().optional(),
        positionY: z.number().int().optional(),
        positionZ: z.number().int().optional(),
        rotationX: z.number().int().optional(),
        rotationY: z.number().int().optional(),
        rotationZ: z.number().int().optional(),
        scaleX: z.number().int().optional(),
        scaleY: z.number().int().optional(),
        scaleZ: z.number().int().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateCabinetGroupLayout(id, data);
        return { success: true };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteCabinetGroupLayout(input.id);
        return { success: true };
      }),

    batchUpdate: adminProcedure
      .input(z.object({
        vaultLayoutId: z.number(),
        layouts: z.array(z.object({
          id: z.number().optional(),
          cabinetGroupId: z.number(),
          positionX: z.number().int(),
          positionY: z.number().int(),
          positionZ: z.number().int(),
          rotationX: z.number().int(),
          rotationY: z.number().int(),
          rotationZ: z.number().int(),
          scaleX: z.number().int(),
          scaleY: z.number().int(),
          scaleZ: z.number().int(),
        })),
      }))
      .mutation(async ({ input }) => {
        await db.deleteCabinetGroupLayoutsByVaultLayout(input.vaultLayoutId);
        for (const layout of input.layouts) {
          await db.createCabinetGroupLayout({
            vaultLayoutId: input.vaultLayoutId,
            cabinetGroupId: layout.cabinetGroupId,
            positionX: layout.positionX,
            positionY: layout.positionY,
            positionZ: layout.positionZ,
            rotationX: layout.rotationX,
            rotationY: layout.rotationY,
            rotationZ: layout.rotationZ,
            scaleX: layout.scaleX,
            scaleY: layout.scaleY,
            scaleZ: layout.scaleZ,
          });
        }
        return { success: true };
      }),
  }),
});
