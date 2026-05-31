import {
  CADEntity,
  LineEntity,
  RectangleEntity,
  CircleEntity,
  PolylineEntity,
  ArcEntity,
  DimensionEntity,
  TextEntity,
  EllipseEntity,
} from "./entities";

type Point = { x: number; y: number };

/** Rotate a point around a center by angle (radians) */
function rotatePoint(p: Point, center: Point, angle: number): Point {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = p.x - center.x;
  const dy = p.y - center.y;
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  };
}

/** Mirror a point across a line defined by two points */
function mirrorPoint(p: Point, lineP1: Point, lineP2: Point): Point {
  const dx = lineP2.x - lineP1.x;
  const dy = lineP2.y - lineP1.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-10) return p; // degenerate line
  const t = ((p.x - lineP1.x) * dx + (p.y - lineP1.y) * dy) / lenSq;
  const projX = lineP1.x + t * dx;
  const projY = lineP1.y + t * dy;
  return {
    x: 2 * projX - p.x,
    y: 2 * projY - p.y,
  };
}

/** Scale a point relative to a center by a scale factor */
function scalePoint(p: Point, center: Point, factor: number): Point {
  return {
    x: center.x + (p.x - center.x) * factor,
    y: center.y + (p.y - center.y) * factor,
  };
}

// ─── Public Transform Functions ─────────────────────────────────────

/** Translate an entity by (dx, dy) */
export function translateEntity(entity: CADEntity, dx: number, dy: number): CADEntity {
  switch (entity.type) {
    case "line": {
      const e = entity as LineEntity;
      return { ...e, x1: e.x1 + dx, y1: e.y1 + dy, x2: e.x2 + dx, y2: e.y2 + dy };
    }
    case "circle": {
      const e = entity as CircleEntity;
      return { ...e, cx: e.cx + dx, cy: e.cy + dy };
    }
    case "arc": {
      const e = entity as ArcEntity;
      return { ...e, cx: e.cx + dx, cy: e.cy + dy };
    }
    case "rectangle": {
      const e = entity as RectangleEntity;
      return { ...e, x: e.x + dx, y: e.y + dy };
    }
    case "polyline": {
      const e = entity as PolylineEntity;
      return { ...e, points: e.points.map(p => ({ x: p.x + dx, y: p.y + dy })) };
    }
    case "text": {
      const e = entity as TextEntity;
      return { ...e, x: e.x + dx, y: e.y + dy };
    }
    case "dimension": {
      const e = entity as DimensionEntity;
      return { ...e, x1: e.x1 + dx, y1: e.y1 + dy, x2: e.x2 + dx, y2: e.y2 + dy };
    }
    case "ellipse": {
      const e = entity as EllipseEntity;
      return { ...e, cx: e.cx + dx, cy: e.cy + dy };
    }
    default:
      return entity;
  }
}

/** Rotate an entity around a center point by angle (radians) */
export function rotateEntity(entity: CADEntity, center: Point, angle: number): CADEntity {
  switch (entity.type) {
    case "line": {
      const e = entity as LineEntity;
      const p1 = rotatePoint({ x: e.x1, y: e.y1 }, center, angle);
      const p2 = rotatePoint({ x: e.x2, y: e.y2 }, center, angle);
      return { ...e, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
    }
    case "circle": {
      const e = entity as CircleEntity;
      const c = rotatePoint({ x: e.cx, y: e.cy }, center, angle);
      return { ...e, cx: c.x, cy: c.y };
    }
    case "arc": {
      const e = entity as ArcEntity;
      const c = rotatePoint({ x: e.cx, y: e.cy }, center, angle);
      return { ...e, cx: c.x, cy: c.y, startAngle: e.startAngle + angle, endAngle: e.endAngle + angle };
    }
    case "rectangle": {
      // Rectangle can't be rotated natively (it has x,y,width,height).
      // Convert to a polyline when rotated by non-0/90/180/270 angles.
      const e = entity as RectangleEntity;
      const corners = [
        { x: e.x, y: e.y },
        { x: e.x + e.width, y: e.y },
        { x: e.x + e.width, y: e.y + e.height },
        { x: e.x, y: e.y + e.height },
      ].map(p => rotatePoint(p, center, angle));
      // Convert to closed polyline
      return {
        id: e.id,
        type: "polyline" as const,
        layerId: e.layerId,
        color: e.color,
        lineWidth: e.lineWidth,
        points: corners,
        closed: true,
      } as PolylineEntity;
    }
    case "polyline": {
      const e = entity as PolylineEntity;
      return { ...e, points: e.points.map(p => rotatePoint(p, center, angle)) };
    }
    case "text": {
      const e = entity as TextEntity;
      const p = rotatePoint({ x: e.x, y: e.y }, center, angle);
      return { ...e, x: p.x, y: p.y, rotation: e.rotation + angle };
    }
    case "dimension": {
      const e = entity as DimensionEntity;
      const p1 = rotatePoint({ x: e.x1, y: e.y1 }, center, angle);
      const p2 = rotatePoint({ x: e.x2, y: e.y2 }, center, angle);
      // Also rotate the offset vector
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const ndx = e.dx * cos - e.dy * sin;
      const ndy = e.dx * sin + e.dy * cos;
      return { ...e, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, dx: ndx, dy: ndy };
    }
    case "ellipse": {
      const e = entity as EllipseEntity;
      const c = rotatePoint({ x: e.cx, y: e.cy }, center, angle);
      return { ...e, cx: c.x, cy: c.y, rotation: e.rotation + angle };
    }
    default:
      return entity;
  }
}

/** Mirror an entity across a line defined by two points */
export function mirrorEntity(entity: CADEntity, lineP1: Point, lineP2: Point): CADEntity {
  // Compute mirror line angle for angle-dependent entities
  const mirrorAngle = Math.atan2(lineP2.y - lineP1.y, lineP2.x - lineP1.x);

  switch (entity.type) {
    case "line": {
      const e = entity as LineEntity;
      const p1 = mirrorPoint({ x: e.x1, y: e.y1 }, lineP1, lineP2);
      const p2 = mirrorPoint({ x: e.x2, y: e.y2 }, lineP1, lineP2);
      return { ...e, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
    }
    case "circle": {
      const e = entity as CircleEntity;
      const c = mirrorPoint({ x: e.cx, y: e.cy }, lineP1, lineP2);
      return { ...e, cx: c.x, cy: c.y };
    }
    case "arc": {
      const e = entity as ArcEntity;
      const c = mirrorPoint({ x: e.cx, y: e.cy }, lineP1, lineP2);
      // Mirror arc angles: reflect across mirror line
      const newStart = 2 * mirrorAngle - e.endAngle;
      const newEnd = 2 * mirrorAngle - e.startAngle;
      return { ...e, cx: c.x, cy: c.y, startAngle: newStart, endAngle: newEnd };
    }
    case "rectangle": {
      const e = entity as RectangleEntity;
      const corners = [
        { x: e.x, y: e.y },
        { x: e.x + e.width, y: e.y },
        { x: e.x + e.width, y: e.y + e.height },
        { x: e.x, y: e.y + e.height },
      ].map(p => mirrorPoint(p, lineP1, lineP2));
      // Convert to closed polyline (mirrored rectangle may not be axis-aligned)
      return {
        id: e.id,
        type: "polyline" as const,
        layerId: e.layerId,
        color: e.color,
        lineWidth: e.lineWidth,
        points: corners,
        closed: true,
      } as PolylineEntity;
    }
    case "polyline": {
      const e = entity as PolylineEntity;
      return { ...e, points: e.points.map(p => mirrorPoint(p, lineP1, lineP2)) };
    }
    case "text": {
      const e = entity as TextEntity;
      const p = mirrorPoint({ x: e.x, y: e.y }, lineP1, lineP2);
      return { ...e, x: p.x, y: p.y, rotation: 2 * mirrorAngle - e.rotation };
    }
    case "dimension": {
      const e = entity as DimensionEntity;
      const p1 = mirrorPoint({ x: e.x1, y: e.y1 }, lineP1, lineP2);
      const p2 = mirrorPoint({ x: e.x2, y: e.y2 }, lineP1, lineP2);
      const ndx = e.dx * Math.cos(2 * mirrorAngle) + e.dy * Math.sin(2 * mirrorAngle);
      const ndy = e.dx * Math.sin(2 * mirrorAngle) - e.dy * Math.cos(2 * mirrorAngle);
      return { ...e, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, dx: ndx, dy: ndy };
    }
    case "ellipse": {
      const e = entity as EllipseEntity;
      const c = mirrorPoint({ x: e.cx, y: e.cy }, lineP1, lineP2);
      return { ...e, cx: c.x, cy: c.y, rotation: 2 * mirrorAngle - e.rotation };
    }
    default:
      return entity;
  }
}

/** Scale an entity relative to a center point by a factor */
export function scaleEntity(entity: CADEntity, center: Point, factor: number): CADEntity {
  switch (entity.type) {
    case "line": {
      const e = entity as LineEntity;
      const p1 = scalePoint({ x: e.x1, y: e.y1 }, center, factor);
      const p2 = scalePoint({ x: e.x2, y: e.y2 }, center, factor);
      return { ...e, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
    }
    case "circle": {
      const e = entity as CircleEntity;
      const c = scalePoint({ x: e.cx, y: e.cy }, center, factor);
      return { ...e, cx: c.x, cy: c.y, radius: e.radius * Math.abs(factor) };
    }
    case "arc": {
      const e = entity as ArcEntity;
      const c = scalePoint({ x: e.cx, y: e.cy }, center, factor);
      return { ...e, cx: c.x, cy: c.y, radius: e.radius * Math.abs(factor) };
    }
    case "rectangle": {
      const e = entity as RectangleEntity;
      const p = scalePoint({ x: e.x, y: e.y }, center, factor);
      return { ...e, x: p.x, y: p.y, width: e.width * Math.abs(factor), height: e.height * Math.abs(factor) };
    }
    case "polyline": {
      const e = entity as PolylineEntity;
      return { ...e, points: e.points.map(p => scalePoint(p, center, factor)) };
    }
    case "text": {
      const e = entity as TextEntity;
      const p = scalePoint({ x: e.x, y: e.y }, center, factor);
      return { ...e, x: p.x, y: p.y, fontSize: e.fontSize * Math.abs(factor) };
    }
    case "dimension": {
      const e = entity as DimensionEntity;
      const p1 = scalePoint({ x: e.x1, y: e.y1 }, center, factor);
      const p2 = scalePoint({ x: e.x2, y: e.y2 }, center, factor);
      return { ...e, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, dx: e.dx * factor, dy: e.dy * factor };
    }
    case "ellipse": {
      const e = entity as EllipseEntity;
      const c = scalePoint({ x: e.cx, y: e.cy }, center, factor);
      return { ...e, cx: c.x, cy: c.y, rx: e.rx * Math.abs(factor), ry: e.ry * Math.abs(factor) };
    }
    default:
      return entity;
  }
}

/** Create a copy of an entity with a new ID */
export function cloneEntity(entity: CADEntity): CADEntity {
  return { ...entity, id: `${entity.type}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}` };
}
