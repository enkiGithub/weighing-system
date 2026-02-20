import { protectedProcedure, adminProcedure, router, createModuleViewProcedure, createModuleOperateProcedure } from "../_core/trpc";

const layoutView = createModuleViewProcedure('layout_editor');
const layoutOperate = createModuleOperateProcedure('layout_editor');
import { z } from "zod";
import * as db from "../db";
import { TRPCError } from "@trpc/server";
import { parseDxfFile } from "../dxfParser";

// DXF布局数据schema（新的2D布局格式）
const dxfCabinetSchema = z.object({
  id: z.number(),
  blockName: z.string(),
  centerX: z.number(),
  centerY: z.number(),
  rotation: z.number(),
  corners: z.array(z.tuple([z.number(), z.number()])),
  crossLines: z.array(z.tuple([z.tuple([z.number(), z.number()]), z.tuple([z.number(), z.number()])])),
  cabinetGroupId: z.number().nullable(),
});

const dxfPolylineSchema = z.object({
  points: z.array(z.tuple([z.number(), z.number()])),
  closed: z.boolean(),
  layer: z.string(),
});

const dxfLineSchema = z.object({
  x1: z.number(),
  y1: z.number(),
  x2: z.number(),
  y2: z.number(),
  layer: z.string(),
});

const dxfLayoutDataSchema = z.object({
  bounds: z.object({
    minX: z.number(),
    minY: z.number(),
    maxX: z.number(),
    maxY: z.number(),
  }),
  lines: z.array(dxfLineSchema).default([]),
  polylines: z.array(dxfPolylineSchema).default([]),
  cabinets: z.array(dxfCabinetSchema).default([]),
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

    /** 上传DXF文件并解析为布局数据 */
    parseDxf: layoutOperate
      .input(z.object({
        /** base64编码的DXF文件内容 */
        fileBase64: z.string(),
        fileName: z.string(),
      }))
      .mutation(async ({ input }) => {
        try {
          const buffer = Buffer.from(input.fileBase64, 'base64');
          const layoutData = await parseDxfFile(buffer);
          return {
            success: true,
            data: layoutData,
            stats: {
              cabinets: layoutData.cabinets.length,
              polylines: layoutData.polylines.length,
              lines: layoutData.lines.length,
            },
          };
        } catch (e: any) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `DXF解析失败: ${e.message}`,
          });
        }
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
          JSON.parse(input.layoutData);
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
        if (input.layoutData) {
          try {
            JSON.parse(input.layoutData);
          } catch {
            throw new TRPCError({ code: 'BAD_REQUEST', message: '布局数据格式不正确' });
          }
        }
        const { id, ...data } = input;
        await db.updateVaultLayout(id, data);
        return { success: true };
      }),

    /** 更新柜列绑定关系（批量绑定多个柜列到一个柜组） */
    bindCabinets: layoutOperate
      .input(z.object({
        layoutId: z.number(),
        /** 要绑定的柜列ID列表 */
        cabinetIds: z.array(z.number()),
        /** 目标柜组ID，null表示解绑 */
        cabinetGroupId: z.number().nullable(),
      }))
      .mutation(async ({ input }) => {
        const layout = await db.getVaultLayoutById(input.layoutId);
        if (!layout) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '布局不存在' });
        }
        
        // 验证柜组存在
        if (input.cabinetGroupId !== null) {
          const group = await db.getCabinetGroupById(input.cabinetGroupId);
          if (!group) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: '柜组不存在' });
          }
        }

        // 解析布局数据
        let layoutData: any;
        try {
          layoutData = JSON.parse(layout.layoutData);
        } catch {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '布局数据损坏' });
        }

        // 更新指定柜列的绑定
        const cabinetIdSet = new Set(input.cabinetIds);
        if (layoutData.cabinets) {
          for (const cab of layoutData.cabinets) {
            if (cabinetIdSet.has(cab.id)) {
              cab.cabinetGroupId = input.cabinetGroupId;
            }
          }
        }

        // 保存更新后的布局数据
        await db.updateVaultLayout(input.layoutId, {
          layoutData: JSON.stringify(layoutData),
        });

        return { success: true, updatedCount: input.cabinetIds.length };
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
