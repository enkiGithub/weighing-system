/**
 * DXF文件解析模块
 * 使用纯Node.js dxf-parser库解析DXF文件，提取柜列和背景几何体
 * 不依赖Python环境
 */
import DxfParser from "dxf-parser";

export interface DxfCabinet {
  id: number;
  blockName: string;
  centerX: number;
  centerY: number;
  rotation: number;
  corners: [number, number][];
  crossLines: [[number, number], [number, number]][];
  cabinetGroupId: number | null;
}

export interface DxfPolyline {
  points: [number, number][];
  closed: boolean;
  layer: string;
}

export interface DxfLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  layer: string;
}

export interface DxfLayoutData {
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
  lines: DxfLine[];
  polylines: DxfPolyline[];
  cabinets: DxfCabinet[];
}

/** 坐标变换：缩放 → 旋转 → 平移 */
function transformPoint(
  x: number, y: number,
  ix: number, iy: number,
  rot: number,
  sx: number = 1, sy: number = 1
): [number, number] {
  x *= sx;
  y *= sy;
  const r = (rot * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [x * c - y * s + ix, x * s + y * c + iy];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function parseDxfFile(fileBuffer: Buffer): Promise<DxfLayoutData> {
  const content = fileBuffer.toString("utf-8");
  const parser = new DxfParser();
  const dxf = parser.parseSync(content);

  if (!dxf) {
    throw new Error("DXF文件解析失败：无法读取文件内容");
  }

  // Step 1: 识别柜列块（包含1个LWPOLYLINE + 2个LINE的块）
  const cabinetBlocks = new Set<string>();
  const cabinetBlockInfo: Record<string, { points: [number, number][] }> = {};

  for (const [name, block] of Object.entries(dxf.blocks || {})) {
    if (name.startsWith("*")) continue;
    const entities = block.entities || [];
    const etypes: Record<string, number> = {};
    for (const e of entities) {
      etypes[e.type] = (etypes[e.type] || 0) + 1;
    }
    // 柜列块特征：1个矩形多段线 + 2条对角线（叉号）
    if (etypes["LWPOLYLINE"] === 1 && etypes["LINE"] === 2 && Object.keys(etypes).length === 2) {
      cabinetBlocks.add(name);
      for (const e of entities) {
        if (e.type === "LWPOLYLINE") {
          const vertices = (e as any).vertices || [];
          cabinetBlockInfo[name] = {
            points: vertices.map((v: any) => [v.x, v.y] as [number, number]),
          };
        }
      }
    }
  }

  // Step 2: 递归遍历实体，展开INSERT引用
  const allLines: DxfLine[] = [];
  const allPolylines: DxfPolyline[] = [];
  const allCabinets: DxfCabinet[] = [];
  let cabinetId = 0;

  function processEntity(
    entity: any,
    px: number, py: number, pr: number,
    psx: number, psy: number,
    depth: number
  ) {
    if (entity.type === "LINE") {
      const vs = entity.vertices || [];
      if (vs.length >= 2) {
        const [sx2, sy2] = transformPoint(vs[0].x, vs[0].y, px, py, pr, psx, psy);
        const [ex2, ey2] = transformPoint(vs[1].x, vs[1].y, px, py, pr, psx, psy);
        allLines.push({
          x1: round2(sx2), y1: round2(sy2),
          x2: round2(ex2), y2: round2(ey2),
          layer: entity.layer || "",
        });
      }
    } else if (entity.type === "LWPOLYLINE") {
      const pts: [number, number][] = (entity.vertices || []).map((v: any) => [v.x, v.y]);
      const wp = pts.map((p) => transformPoint(p[0], p[1], px, py, pr, psx, psy));
      allPolylines.push({
        points: wp.map((p) => [round2(p[0]), round2(p[1])] as [number, number]),
        closed: entity.shape || false,
        layer: entity.layer || "",
      });
    } else if (entity.type === "INSERT") {
      const n: string = entity.name;
      const ix = entity.position?.x || 0;
      const iy = entity.position?.y || 0;
      const ir = entity.rotation || 0;
      const isx = entity.xScale ?? 1;
      const isy = entity.yScale ?? 1;
      const [wx, wy] = transformPoint(ix, iy, px, py, pr, psx, psy);
      const wr = pr + ir;
      const wsx = psx * isx;
      const wsy = psy * isy;

      if (cabinetBlocks.has(n)) {
        const info = cabinetBlockInfo[n];
        if (info) {
          // 变换柜列矩形顶点到世界坐标
          const wc = info.points.map((p) => transformPoint(p[0], p[1], wx, wy, wr, wsx, wsy));
          const cx = wc.reduce((s, p) => s + p[0], 0) / wc.length;
          const cy = wc.reduce((s, p) => s + p[1], 0) / wc.length;

          // 获取叉号线段
          const crossLines: [[number, number], [number, number]][] = [];
          const block = dxf!.blocks?.[n];
          if (block) {
            for (const e of block.entities || []) {
              if (e.type === "LINE") {
                const vs = (e as any).vertices || [];
                if (vs.length >= 2) {
                  const [s1, s2] = transformPoint(vs[0].x, vs[0].y, wx, wy, wr, wsx, wsy);
                  const [e1, e2] = transformPoint(vs[1].x, vs[1].y, wx, wy, wr, wsx, wsy);
                  crossLines.push([
                    [round2(s1), round2(s2)],
                    [round2(e1), round2(e2)],
                  ]);
                }
              }
            }
          }

          allCabinets.push({
            id: cabinetId++,
            blockName: n,
            centerX: round2(cx),
            centerY: round2(cy),
            rotation: round2(wr % 360),
            corners: wc.map((c) => [round2(c[0]), round2(c[1])] as [number, number]),
            crossLines,
            cabinetGroupId: null,
          });
        }
      } else if (depth < 6) {
        // 递归展开非柜列块引用
        const block = dxf!.blocks?.[n];
        if (block) {
          for (const sub of block.entities || []) {
            processEntity(sub, wx, wy, wr, wsx, wsy, depth + 1);
          }
        }
      }
    }
  }

  // 遍历模型空间中的所有实体
  for (const e of dxf.entities || []) {
    processEntity(e, 0, 0, 0, 1, 1, 0);
  }

  // Step 3: 计算边界
  const ax: number[] = [];
  const ay: number[] = [];
  for (const c of allCabinets) {
    for (const cr of c.corners) { ax.push(cr[0]); ay.push(cr[1]); }
  }
  for (const l of allLines) {
    ax.push(l.x1, l.x2); ay.push(l.y1, l.y2);
  }
  for (const p of allPolylines) {
    for (const pt of p.points) { ax.push(pt[0]); ay.push(pt[1]); }
  }

  const bounds = ax.length > 0
    ? { minX: round2(Math.min(...ax)), minY: round2(Math.min(...ay)), maxX: round2(Math.max(...ax)), maxY: round2(Math.max(...ay)) }
    : { minX: 0, minY: 0, maxX: 1000, maxY: 1000 };

  return { bounds, lines: allLines, polylines: allPolylines, cabinets: allCabinets };
}
