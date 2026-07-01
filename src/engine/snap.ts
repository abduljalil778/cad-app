import {
  CADEntity,
  LineEntity,
  CircleEntity,
  ArcEntity,
  RectangleEntity,
  PolylineEntity,
  BlockReferenceEntity,
} from "./entities";

export interface SnapPoint {
  x: number;
  y: number;
  type:
    | "endpoint"
    | "midpoint"
    | "center"
    | "quadrant"
    | "intersection"
    | "nearest";
}

const SNAP_THRESHOLD = 0.5; // pixel radius untuk snap

/**
 * Prioritas snap — semakin kecil angka, semakin tinggi prioritasnya.
 * Digunakan sebagai tie-breaker ketika jarak dua kandidat sama atau sangat dekat.
 */
const SNAP_PRIORITY: Record<SnapPoint["type"], number> = {
  endpoint: 0,
  midpoint: 1,
  center: 2,
  quadrant: 3,
  intersection: 4,
  nearest: 5,
};

// ─── Utilitas ──────────────────────────────────────────────────────────────────

/**
 * Konversi threshold pixel → world unit
 */
function pixelToWorld(px: number, zoom: number): number {
  return px / zoom;
}

/**
 * Jarak antara dua titik dalam world space
 */
function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
}

// ─── Snap-point collectors per entity type ─────────────────────────────────────

function collectLineSnaps(line: LineEntity): SnapPoint[] {
  return [
    { x: line.x1, y: line.y1, type: "endpoint" },
    { x: line.x2, y: line.y2, type: "endpoint" },
    {
      x: (line.x1 + line.x2) / 2,
      y: (line.y1 + line.y2) / 2,
      type: "midpoint",
    },
  ];
}

function collectCircleSnaps(circle: CircleEntity): SnapPoint[] {
  const { cx, cy, radius: r } = circle;
  return [
    { x: cx, y: cy, type: "center" },
    // Quadrant points: 0°, 90°, 180°, 270°
    { x: cx + r, y: cy, type: "quadrant" },
    { x: cx - r, y: cy, type: "quadrant" },
    { x: cx, y: cy + r, type: "quadrant" },
    { x: cx, y: cy - r, type: "quadrant" },
  ];
}

function collectArcSnaps(arc: ArcEntity): SnapPoint[] {
  const { cx, cy, radius: r, startAngle, endAngle } = arc;

  // Titik start & end pada busur
  const x1 = cx + r * Math.cos(startAngle);
  const y1 = cy + r * Math.sin(startAngle);
  const x2 = cx + r * Math.cos(endAngle);
  const y2 = cy + r * Math.sin(endAngle);

  // Midpoint: sudut tengah antara start dan end
  let midAngle: number;
  let sa = ((startAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  let ea = ((endAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  if (ea <= sa) ea += 2 * Math.PI;
  midAngle = (sa + ea) / 2;

  const mx = cx + r * Math.cos(midAngle);
  const my = cy + r * Math.sin(midAngle);

  return [
    { x: cx, y: cy, type: "center" },
    { x: x1, y: y1, type: "endpoint" },
    { x: x2, y: y2, type: "endpoint" },
    { x: mx, y: my, type: "midpoint" },
  ];
}

function collectRectangleSnaps(rect: RectangleEntity): SnapPoint[] {
  const { x, y, width: w, height: h } = rect;

  // 4 corners
  const corners: SnapPoint[] = [
    { x: x, y: y, type: "endpoint" },
    { x: x + w, y: y, type: "endpoint" },
    { x: x + w, y: y + h, type: "endpoint" },
    { x: x, y: y + h, type: "endpoint" },
  ];

  // 4 edge midpoints
  const edgeMids: SnapPoint[] = [
    { x: x + w / 2, y: y, type: "midpoint" }, // top
    { x: x + w, y: y + h / 2, type: "midpoint" }, // right
    { x: x + w / 2, y: y + h, type: "midpoint" }, // bottom
    { x: x, y: y + h / 2, type: "midpoint" }, // left
  ];

  // Center
  const center: SnapPoint = {
    x: x + w / 2,
    y: y + h / 2,
    type: "center",
  };

  return [...corners, ...edgeMids, center];
}

function collectPolylineSnaps(poly: PolylineEntity): SnapPoint[] {
  const pts = poly.points;
  const snaps: SnapPoint[] = [];

  // Semua vertex sebagai endpoint
  for (const p of pts) {
    snaps.push({ x: p.x, y: p.y, type: "endpoint" });
  }

  // Midpoint setiap segment
  const segCount = poly.closed ? pts.length : pts.length - 1;
  for (let i = 0; i < segCount; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    snaps.push({
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
      type: "midpoint",
    });
  }

  return snaps;
}

// ─── Line-Line Intersection ────────────────────────────────────────────────────

/**
 * Hitung titik potong dua segmen garis.
 * Mengembalikan titik potong hanya jika berada DI ATAS kedua segmen
 * (bukan pada perpanjangan garis).
 */
function lineLineIntersection(a: LineEntity, b: LineEntity): SnapPoint | null {
  const x1 = a.x1,
    y1 = a.y1,
    x2 = a.x2,
    y2 = a.y2;
  const x3 = b.x1,
    y3 = b.y1,
    x4 = b.x2,
    y4 = b.y2;

  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denom) < 1e-10) return null; // garis sejajar / kolinear

  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

  // Titik potong harus berada di dalam kedua segmen (0 ≤ t ≤ 1, 0 ≤ u ≤ 1)
  if (t < -1e-10 || t > 1 + 1e-10 || u < -1e-10 || u > 1 + 1e-10) return null;

  return {
    x: x1 + t * (x2 - x1),
    y: y1 + t * (y2 - y1),
    type: "intersection",
  };
}

/**
 * Kumpulkan semua titik potong antara semua pasangan garis.
 */
function collectAllIntersections(entities: CADEntity[]): SnapPoint[] {
  const lines = entities.filter((e): e is LineEntity => e.type === "line");
  const snaps: SnapPoint[] = [];

  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      const pt = lineLineIntersection(lines[i], lines[j]);
      if (pt) snaps.push(pt);
    }
  }

  return snaps;
}

// ─── Nearest point on entity (lowest priority) ────────────────────────────────

function nearestPointOnLine(
  wx: number,
  wy: number,
  line: LineEntity,
): SnapPoint {
  const dx = line.x2 - line.x1;
  const dy = line.y2 - line.y1;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    return { x: line.x1, y: line.y1, type: "nearest" };
  }

  let t = ((wx - line.x1) * dx + (wy - line.y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  return {
    x: line.x1 + t * dx,
    y: line.y1 + t * dy,
    type: "nearest",
  };
}

function nearestPointOnCircle(
  wx: number,
  wy: number,
  circle: CircleEntity,
): SnapPoint {
  const dx = wx - circle.cx;
  const dy = wy - circle.cy;
  const d = Math.sqrt(dx * dx + dy * dy);

  if (d === 0) {
    // Cursor tepat di center, snap ke quadrant 0°
    return { x: circle.cx + circle.radius, y: circle.cy, type: "nearest" };
  }

  return {
    x: circle.cx + (dx / d) * circle.radius,
    y: circle.cy + (dy / d) * circle.radius,
    type: "nearest",
  };
}

function nearestPointOnArc(
  wx: number,
  wy: number,
  arc: ArcEntity,
): SnapPoint | null {
  const dx = wx - arc.cx;
  const dy = wy - arc.cy;
  const d = Math.sqrt(dx * dx + dy * dy);

  let angle: number;
  if (d === 0) {
    angle = arc.startAngle;
  } else {
    angle = Math.atan2(dy, dx);
  }

  // Normalkan sudut dan periksa apakah berada di dalam busur
  let sa = ((arc.startAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  let ea = ((arc.endAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  let a = ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

  if (ea <= sa) ea += 2 * Math.PI;
  if (a < sa) a += 2 * Math.PI;

  if (a >= sa && a <= ea) {
    return {
      x: arc.cx + arc.radius * Math.cos(angle),
      y: arc.cy + arc.radius * Math.sin(angle),
      type: "nearest",
    };
  }

  // Di luar busur — snap ke endpoint terdekat
  const sx = arc.cx + arc.radius * Math.cos(arc.startAngle);
  const sy = arc.cy + arc.radius * Math.sin(arc.startAngle);
  const ex = arc.cx + arc.radius * Math.cos(arc.endAngle);
  const ey = arc.cy + arc.radius * Math.sin(arc.endAngle);

  const ds = dist(wx, wy, sx, sy);
  const de = dist(wx, wy, ex, ey);

  return ds < de
    ? { x: sx, y: sy, type: "nearest" }
    : { x: ex, y: ey, type: "nearest" };
}

/**
 * Nearest point on a rectangle (4 edge segments).
 */
function nearestPointOnRectangle(
  wx: number,
  wy: number,
  rect: RectangleEntity,
): SnapPoint {
  const { x, y, width: w, height: h } = rect;
  const edges: [number, number, number, number][] = [
    [x, y, x + w, y],
    [x + w, y, x + w, y + h],
    [x + w, y + h, x, y + h],
    [x, y + h, x, y],
  ];

  let best: SnapPoint = { x: x, y: y, type: "nearest" };
  let bestD = Infinity;

  for (const [x1, y1, x2, y2] of edges) {
    const fakeLineEntity = { x1, y1, x2, y2 } as LineEntity;
    const pt = nearestPointOnLine(wx, wy, fakeLineEntity);
    const d = dist(wx, wy, pt.x, pt.y);
    if (d < bestD) {
      bestD = d;
      best = pt;
    }
  }

  return best;
}

/**
 * Return the nearest point on any entity (no threshold) — useful for
 * tools that want to pick anywhere on an entity even when not near a snap.
 */
export function getNearestPointOnEntities(
  worldX: number,
  worldY: number,
  entities: CADEntity[],
): SnapPoint | null {
  let best: SnapPoint | null = null;
  let bestD = Infinity;

  for (const entity of entities) {
    let nearPt: SnapPoint | null = null;
    switch (entity.type) {
      case "line":
        nearPt = nearestPointOnLine(worldX, worldY, entity);
        break;
      case "circle":
        nearPt = nearestPointOnCircle(worldX, worldY, entity);
        break;
      case "arc":
        nearPt = nearestPointOnArc(worldX, worldY, entity);
        break;
      case "rectangle":
        nearPt = nearestPointOnRectangle(worldX, worldY, entity);
        break;
      case "polyline":
        nearPt = nearestPointOnPolyline(worldX, worldY, entity);
        break;
      default:
        break;
    }

    if (nearPt) {
      const d = dist(worldX, worldY, nearPt.x, nearPt.y);
      if (d < bestD) {
        bestD = d;
        best = nearPt;
      }
    }
  }

  return best;
}

/**
 * Nearest point on a polyline.
 */
function nearestPointOnPolyline(
  wx: number,
  wy: number,
  poly: PolylineEntity,
): SnapPoint | null {
  const pts = poly.points;
  if (pts.length < 2) return null;

  let best: SnapPoint | null = null;
  let bestD = Infinity;

  const segCount = poly.closed ? pts.length : pts.length - 1;
  for (let i = 0; i < segCount; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const fakeLineEntity = { x1: a.x, y1: a.y, x2: b.x, y2: b.y } as LineEntity;
    const pt = nearestPointOnLine(wx, wy, fakeLineEntity);
    const d = dist(wx, wy, pt.x, pt.y);
    if (d < bestD) {
      bestD = d;
      best = pt;
    }
  }

  return best;
}

// ─── Fungsi utama ──────────────────────────────────────────────────────────────

/**
 * Bandingkan dua kandidat snap. Mengembalikan true jika `a` lebih baik
 * daripada `b` (jarak lebih dekat, atau jarak sama tapi prioritas lebih
 * tinggi).
 */
function isBetter(
  aDist: number,
  aType: SnapPoint["type"],
  bDist: number,
  bType: SnapPoint["type"],
): boolean {
  // Toleransi kecil: jika selisih jarak < 1e-6, gunakan prioritas
  if (Math.abs(aDist - bDist) < 1e-6) {
    return SNAP_PRIORITY[aType] < SNAP_PRIORITY[bType];
  }
  return aDist < bDist;
}

/**
 * Cari snap point terdekat dari semua entity.
 *
 * Algoritma:
 * 1. Jika snapEnabled false, langsung return null
 * 2. Konversi SNAP_THRESHOLD (px) ke world unit menggunakan zoom
 * 3. Kumpulkan semua kandidat snap dari semua entity
 * 4. Cari kandidat terdekat dalam threshold
 * 5. Jika tidak ada entity snap, fallback ke grid snap
 * 6. Return snap terbaik atau null
 *
 * Prioritas (ketika beberapa snap berada dalam threshold):
 *   endpoint > midpoint > center > quadrant > intersection > grid > nearest
 */
export function findSnapPoint(
  worldX: number,
  worldY: number,
  entities: CADEntity[],
  zoom: number,
  _gridSize: number,
  snapEnabled: boolean,
): SnapPoint | null {
  if (!snapEnabled) return null;

  const threshold = pixelToWorld(SNAP_THRESHOLD, zoom);
  let best: SnapPoint | null = null;
  let bestDist = Infinity;

  // ── Kumpulkan snap point dari setiap entity ──
  const candidates: SnapPoint[] = [];

  for (const entity of entities) {
    switch (entity.type) {
      case "line":
        candidates.push(...collectLineSnaps(entity));
        break;
      case "circle":
        candidates.push(...collectCircleSnaps(entity));
        break;
      case "arc":
        candidates.push(...collectArcSnaps(entity));
        break;
      case "rectangle":
        candidates.push(...collectRectangleSnaps(entity));
        break;
      case "polyline":
        candidates.push(...collectPolylineSnaps(entity));
        break;
      case 'block_ref': {
        const ref = entity as BlockReferenceEntity;
        candidates.push({ x: ref.insertX, y: ref.insertY, type: 'center' });
        break;
      }
      // DimensionEntity tidak menghasilkan snap point
      default:
        break;
    }
  }

  // ── Tambahkan intersection points (line-line) ──
  candidates.push(...collectAllIntersections(entities));

  // ── Cari kandidat terbaik ──
  for (const pt of candidates) {
    const d = dist(worldX, worldY, pt.x, pt.y);
    if (
      d < threshold &&
      isBetter(d, pt.type, bestDist, best?.type ?? "nearest")
    ) {
      bestDist = d;
      best = pt;
    }
  }

  // ── Nearest-point fallback (lowest priority entity snap) ──
  if (!best) {
    for (const entity of entities) {
      let nearPt: SnapPoint | null = null;
      switch (entity.type) {
        case "line":
          nearPt = nearestPointOnLine(worldX, worldY, entity);
          break;
        case "circle":
          nearPt = nearestPointOnCircle(worldX, worldY, entity);
          break;
        case "arc":
          nearPt = nearestPointOnArc(worldX, worldY, entity);
          break;
        case "rectangle":
          nearPt = nearestPointOnRectangle(worldX, worldY, entity);
          break;
        case "polyline":
          nearPt = nearestPointOnPolyline(worldX, worldY, entity);
          break;
        default:
          break;
      }

      if (nearPt) {
        const d = dist(worldX, worldY, nearPt.x, nearPt.y);
        if (d < threshold && d < bestDist) {
          bestDist = d;
          best = nearPt;
        }
      }
    }
  }

  return best;
}
