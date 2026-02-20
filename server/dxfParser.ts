/**
 * DXF文件解析模块
 * 使用Python ezdxf库解析DXF文件，提取柜列和背景几何体
 */
import { execFile } from "child_process";
import { writeFile, unlink } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { tmpdir } from "os";

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

const PARSE_SCRIPT = `
import ezdxf
import json
import math
import sys

doc = ezdxf.readfile(sys.argv[1])

cabinet_blocks = set()
cabinet_block_info = {}
for block in doc.blocks:
    if block.name.startswith('*'):
        continue
    entities = list(block)
    etypes = {}
    for e in entities:
        t = e.dxftype()
        etypes[t] = etypes.get(t, 0) + 1
    if etypes.get('LWPOLYLINE', 0) == 1 and etypes.get('LINE', 0) == 2 and len(etypes) == 2:
        cabinet_blocks.add(block.name)
        for e in entities:
            if e.dxftype() == 'LWPOLYLINE':
                pts = list(e.get_points(format='xy'))
                cabinet_block_info[block.name] = {'points': pts}

def tp(x, y, ix, iy, rot, sx=1.0, sy=1.0):
    x *= sx; y *= sy
    r = math.radians(rot)
    c, s = math.cos(r), math.sin(r)
    return x*c - y*s + ix, x*s + y*c + iy

all_lines = []
all_polylines = []
all_cabinets = []
cid = [0]

def proc(entity, px=0, py=0, pr=0, psx=1, psy=1, depth=0):
    if entity.dxftype() == 'LINE':
        sx2, sy2 = tp(entity.dxf.start.x, entity.dxf.start.y, px, py, pr, psx, psy)
        ex2, ey2 = tp(entity.dxf.end.x, entity.dxf.end.y, px, py, pr, psx, psy)
        all_lines.append({'x1':round(sx2,2),'y1':round(sy2,2),'x2':round(ex2,2),'y2':round(ey2,2),'layer':entity.dxf.layer})
    elif entity.dxftype() == 'LWPOLYLINE':
        pts = list(entity.get_points(format='xy'))
        wp = [tp(p[0],p[1],px,py,pr,psx,psy) for p in pts]
        all_polylines.append({'points':[[round(p[0],2),round(p[1],2)] for p in wp],'closed':entity.closed,'layer':entity.dxf.layer})
    elif entity.dxftype() == 'INSERT':
        n = entity.dxf.name
        ix, iy = entity.dxf.insert.x, entity.dxf.insert.y
        ir = entity.dxf.get('rotation',0.0)
        isx = entity.dxf.get('xscale',1.0)
        isy = entity.dxf.get('yscale',1.0)
        wx, wy = tp(ix,iy,px,py,pr,psx,psy)
        wr, wsx, wsy = pr+ir, psx*isx, psy*isy
        if n in cabinet_blocks:
            info = cabinet_block_info[n]
            wc = [tp(p[0],p[1],wx,wy,wr,wsx,wsy) for p in info['points']]
            cx = sum(p[0] for p in wc)/len(wc)
            cy = sum(p[1] for p in wc)/len(wc)
            cl = []
            try:
                for e in doc.blocks[n]:
                    if e.dxftype()=='LINE':
                        s1,s2=tp(e.dxf.start.x,e.dxf.start.y,wx,wy,wr,wsx,wsy)
                        e1,e2=tp(e.dxf.end.x,e.dxf.end.y,wx,wy,wr,wsx,wsy)
                        cl.append([[round(s1,2),round(s2,2)],[round(e1,2),round(e2,2)]])
            except: pass
            all_cabinets.append({'id':cid[0],'blockName':n,'centerX':round(cx,2),'centerY':round(cy,2),'rotation':round(wr%360,2),'corners':[[round(c[0],2),round(c[1],2)] for c in wc],'crossLines':cl,'cabinetGroupId':None})
            cid[0]+=1
        elif depth<6:
            try:
                for sub in doc.blocks[n]: proc(sub,wx,wy,wr,wsx,wsy,depth+1)
            except: pass

for e in doc.modelspace(): proc(e)

ax=[]; ay=[]
for c in all_cabinets:
    for cr in c['corners']: ax.append(cr[0]); ay.append(cr[1])
for l in all_lines: ax.extend([l['x1'],l['x2']]); ay.extend([l['y1'],l['y2']])
for p in all_polylines:
    for pt in p['points']: ax.append(pt[0]); ay.append(pt[1])

bounds = {'minX':round(min(ax),2),'minY':round(min(ay),2),'maxX':round(max(ax),2),'maxY':round(max(ay),2)} if ax else {'minX':0,'minY':0,'maxX':1000,'maxY':1000}

print(json.dumps({'bounds':bounds,'lines':all_lines,'polylines':all_polylines,'cabinets':all_cabinets}))
`;

export async function parseDxfFile(fileBuffer: Buffer): Promise<DxfLayoutData> {
  const tmpId = randomUUID();
  const tmpDxf = join(tmpdir(), `dxf_${tmpId}.dxf`);
  const tmpPy = join(tmpdir(), `parse_${tmpId}.py`);

  try {
    await writeFile(tmpDxf, fileBuffer);
    await writeFile(tmpPy, PARSE_SCRIPT);

    const result = await new Promise<string>((resolve, reject) => {
      execFile("python3", [tmpPy, tmpDxf], { maxBuffer: 50 * 1024 * 1024 }, (err, stdout, stderr) => {
        if (err) {
          reject(new Error(`DXF parse failed: ${stderr || err.message}`));
        } else {
          resolve(stdout);
        }
      });
    });

    const data = JSON.parse(result) as DxfLayoutData;
    return data;
  } finally {
    await unlink(tmpDxf).catch(() => {});
    await unlink(tmpPy).catch(() => {});
  }
}
