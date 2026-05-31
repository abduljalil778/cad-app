import DxfParser from "dxf-parser";
import {
  CADEntity,
  LineEntity,
  CircleEntity,
  PolylineEntity,
  ArcEntity,
} from "../engine/entities";

let idCounter = 0;
const genId = (type: string) => `${type}_import_${Date.now()}_${idCounter++}`;

export interface ImportResult {
  entities: CADEntity[];
  center: { x: number; y: number };
  suggestedZoom: number;
  suggestedPan: { x: number; y: number };
}

export function importDXF(
  dxfString: string,
  viewportWidth: number,
  viewportHeight: number,
  gridPixel: number,
): ImportResult {
  const parser = new DxfParser();
  let dxf: any;

  try {
    dxf = parser.parseSync(dxfString);
  } catch (e) {
    console.error("DXF parse error:", e);
    return empty();
  }

  if (!dxf?.entities) return empty();

  const entities: CADEntity[] = [];

  for (const e of dxf.entities) {
    const layerId = e.layer ?? "0";
    const color = e.colorIndex ? aciToHex(e.colorIndex) : "#ffffff";

    // ── LINE ──────────────────────────────────────────
    if (e.type === "LINE") {
      entities.push({
        id: genId("line"),
        type: "line",
        layerId,
        color,
        x1: e.vertices[0].x,
        y1: -e.vertices[0].y,
        x2: e.vertices[1].x,
        y2: -e.vertices[1].y,
      } as LineEntity);
    }

    // ── CIRCLE ────────────────────────────────────────
    else if (e.type === "CIRCLE") {
      entities.push({
        id: genId("circle"),
        type: "circle",
        layerId,
        color,
        cx: e.center.x,
        cy: -e.center.y,
        radius: e.radius,
      } as CircleEntity);
    }

    // ── ARC ───────────────────────────────────────────
    else if (e.type === "ARC") {
      // dxf-parser mengembalikan startAngle & endAngle dalam RADIAN
      // angleLength negatif = clockwise arc
      // Setelah Y-invert, arc CW di DXF menjadi CCW di canvas kita — swap start/end
      const startRad = e.startAngle;
      const endRad = e.endAngle;

      // Y-invert: cerminkan sudut terhadap sumbu X
      // sudut baru = -sudut lama, lalu swap start/end
      const newStart = -endRad;
      const newEnd = -startRad;

      entities.push({
        id: genId("arc"),
        type: "arc",
        layerId,
        color,
        cx: e.center.x,
        cy: -e.center.y, // invert Y
        radius: e.radius,
        startAngle: newStart,
        endAngle: newEnd,
      } as ArcEntity);
    }

    // ── LWPOLYLINE ────────────────────────────────────
    // dxf-parser: e.vertices array of {x, y}, e.shape = closed
    else if (e.type === "LWPOLYLINE") {
      if (!e.vertices || e.vertices.length < 2) continue;
      entities.push({
        id: genId("pline"),
        type: "polyline",
        layerId,
        color,
        points: e.vertices.map((v: any) => ({ x: v.x, y: -v.y })),
        closed: !!e.shape,
      } as PolylineEntity);
    }

    // ── POLYLINE (old format) ─────────────────────────
    else if (e.type === "POLYLINE") {
      if (!e.vertices || e.vertices.length < 2) continue;
      entities.push({
        id: genId("pline"),
        type: "polyline",
        layerId,
        color,
        points: e.vertices.map((v: any) => ({ x: v.x, y: -v.y })),
        closed: !!(e.shape || e.flags & 1),
      } as PolylineEntity);
    }
  }

  if (entities.length === 0) return empty();

  // ── Bounding box & auto-fit ───────────────────────
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  for (const e of entities) {
    if (e.type === "line") {
      const l = e as LineEntity;
      minX = Math.min(minX, l.x1, l.x2);
      maxX = Math.max(maxX, l.x1, l.x2);
      minY = Math.min(minY, l.y1, l.y2);
      maxY = Math.max(maxY, l.y1, l.y2);
    } else if (e.type === "circle") {
      const c = e as CircleEntity;
      minX = Math.min(minX, c.cx - c.radius);
      maxX = Math.max(maxX, c.cx + c.radius);
      minY = Math.min(minY, c.cy - c.radius);
      maxY = Math.max(maxY, c.cy + c.radius);
    } else if (e.type === "polyline") {
      const p = e as PolylineEntity;
      for (const pt of p.points) {
        minX = Math.min(minX, pt.x);
        maxX = Math.max(maxX, pt.x);
        minY = Math.min(minY, pt.y);
        maxY = Math.max(maxY, pt.y);
      }
    } else if (e.type === "arc") {
      const a = e as ArcEntity;
      minX = Math.min(minX, a.cx - a.radius);
      maxX = Math.max(maxX, a.cx + a.radius);
      minY = Math.min(minY, a.cy - a.radius);
      maxY = Math.max(maxY, a.cy + a.radius);
    }
  }

  const contentW = maxX - minX;
  const contentH = maxY - minY;
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  const PADDING = 0.85;
  const zoomX = (viewportWidth * PADDING) / (contentW * gridPixel);
  const zoomY = (viewportHeight * PADDING) / (contentH * gridPixel);
  const suggestedZoom = Math.min(zoomX, zoomY, 2);

  const suggestedPan = {
    x: viewportWidth / 2 - centerX * suggestedZoom * gridPixel,
    y: viewportHeight / 2 - centerY * suggestedZoom * gridPixel,
  };

  return {
    entities,
    center: { x: centerX, y: centerY },
    suggestedZoom,
    suggestedPan,
  };
}

function empty(): ImportResult {
  return {
    entities: [],
    center: { x: 0, y: 0 },
    suggestedZoom: 1,
    suggestedPan: { x: 0, y: 0 },
  };
}

function aciToHex(aci: number): string {
  const map: Record<number, string> = {
    1: "#ff0000",
    2: "#ffff00",
    3: "#00ff00",
    4: "#00ffff",
    5: "#0000ff",
    6: "#ff00ff",
    7: "#ffffff",
    30: "#ffaa44",
  };
  return map[aci] ?? "#ffffff";
}
