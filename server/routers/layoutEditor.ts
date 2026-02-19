import { protectedProcedure, adminProcedure, router } from "../_core/trpc";
import { z } from "zod";
import * as db from "../db";
import { TRPCError } from "@trpc/server";

export const layoutEditorRouter = router({
  // 柜子管理
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
        return await db.getVaultLayoutById(input.id);
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
        const { id, ...data } = input;
        await db.updateVaultLayout(id, data);
        return { success: true };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        // 删除关联的柜组布局
        await db.deleteCabinetGroupLayoutsByVaultLayout(input.id);
        // 删除布局本身
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

  // 柜组布局管理
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

    // 批量更新柜组布局（用于编辑器保存）
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
        // 删除现有的柜组布局
        await db.deleteCabinetGroupLayoutsByVaultLayout(input.vaultLayoutId);
        
        // 创建新的柜组布局
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
