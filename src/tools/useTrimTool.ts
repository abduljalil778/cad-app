import { useCallback } from 'react';
import { useCADStore } from '../store/useCADStore';
import { CADEntity, LineEntity, CircleEntity, ArcEntity, PolylineEntity } from '../engine/entities';
import { findAllIntersections, splitEntityAtPoints } from '../engine/intersection';
import { SnapPoint } from '../engine/snap';

/**
 * Distance from a point to a line segment.
 */
function distToLine(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
  return Math.sqrt((x1 + t * dx - px) ** 2 + (y1 + t * dy - py) ** 2);
}

/**
 * Distance from a point to a CAD entity.
 */
function distToEntity(entity: CADEntity, pt: { x: number; y: number }): number {
  switch (entity.type) {
    case 'line': {
      const l = entity as LineEntity;
      return distToLine(pt.x, pt.y, l.x1, l.y1, l.x2, l.y2);
    }
    case 'circle': {
      const c = entity as CircleEntity;
      return Math.abs(Math.sqrt((pt.x - c.cx) ** 2 + (pt.y - c.cy) ** 2) - c.radius);
    }
    case 'arc': {
      const a = entity as ArcEntity;
      const dist = Math.sqrt((pt.x - a.cx) ** 2 + (pt.y - a.cy) ** 2);
      const radialDist = Math.abs(dist - a.radius);
      // Check if point is within arc angle range
      let angle = Math.atan2(pt.y - a.cy, pt.x - a.cx);
      let start = a.startAngle, end = a.endAngle;
      if (end < start) end += Math.PI * 2;
      if (angle < start) angle += Math.PI * 2;
      if (angle >= start && angle <= end) return radialDist;
      // Outside arc range - distance to nearest endpoint
      const sx = a.cx + a.radius * Math.cos(a.startAngle);
      const sy = a.cy + a.radius * Math.sin(a.startAngle);
      const ex = a.cx + a.radius * Math.cos(a.endAngle);
      const ey = a.cy + a.radius * Math.sin(a.endAngle);
      return Math.min(
        Math.sqrt((pt.x - sx) ** 2 + (pt.y - sy) ** 2),
        Math.sqrt((pt.x - ex) ** 2 + (pt.y - ey) ** 2),
      );
    }
    case 'polyline': {
      const p = entity as PolylineEntity;
      let minDist = Infinity;
      for (let i = 0; i < p.points.length - 1; i++) {
        const d = distToLine(pt.x, pt.y, p.points[i].x, p.points[i].y, p.points[i + 1].x, p.points[i + 1].y);
        if (d < minDist) minDist = d;
      }
      if (p.closed && p.points.length > 2) {
        const last = p.points[p.points.length - 1];
        const first = p.points[0];
        const d = distToLine(pt.x, pt.y, last.x, last.y, first.x, first.y);
        if (d < minDist) minDist = d;
      }
      return minDist;
    }
    default:
      return Infinity;
  }
}

/**
 * Find the nearest entity within a threshold distance.
 */
function findNearestEntity(
  entities: CADEntity[],
  pt: { x: number; y: number },
  threshold: number,
): { entity: CADEntity; dist: number } | null {
  let best: { entity: CADEntity; dist: number } | null = null;
  for (const entity of entities) {
    // Only trim line, circle, arc, polyline
    if (!['line', 'circle', 'arc', 'polyline'].includes(entity.type)) continue;
    const d = distToEntity(entity, pt);
    if (d < threshold && (!best || d < best.dist)) {
      best = { entity, dist: d };
    }
  }
  return best;
}

export function useTrimTool() {
  const { entities, setEntities, pushLog, zoom } = useCADStore();

  const onMouseClick = useCallback(
    (_snap: SnapPoint | null, wx: number, wy: number) => {
      // Find nearest entity to click point (zoom-aware threshold)
      const threshold = 0.3 / (zoom * 0.5 + 0.5);
      const clickPt = { x: wx, y: wy };

      // Find hit entity
      const hit = findNearestEntity(entities, clickPt, threshold);
      if (!hit) {
        pushLog('TRIM: No entity found at click point.');
        return;
      }

      // Find all intersections with other entities
      const intersections = findAllIntersections(hit.entity, entities);
      if (intersections.length === 0) {
        pushLog('TRIM: No intersections found for this entity.');
        return;
      }

      // For line entities: compute click parameter t, find bounding intersections,
      // and only remove the segment between them (keeping rest intact).
      if (hit.entity.type === 'line') {
        const line = hit.entity as LineEntity;
        const p1 = { x: line.x1, y: line.y1 };
        const p2 = { x: line.x2, y: line.y2 };
        const dx = p2.x - p1.x, dy = p2.y - p1.y;
        const len2 = dx * dx + dy * dy;
        if (len2 === 0) return;

        // Parameter of click point on the line
        const clickT = ((clickPt.x - p1.x) * dx + (clickPt.y - p1.y) * dy) / len2;

        // Get sorted t values of all intersections (clamped to valid range)
        const tValues = intersections
          .map(i => {
            return ((i.point.x - p1.x) * dx + (i.point.y - p1.y) * dy) / len2;
          })
          .filter(t => t > 1e-6 && t < 1 - 1e-6)
          .sort((a, b) => a - b);

        // Deduplicate close t values
        const uniqueT: number[] = [];
        for (const t of tValues) {
          if (uniqueT.length === 0 || t - uniqueT[uniqueT.length - 1] > 1e-4) {
            uniqueT.push(t);
          }
        }

        if (uniqueT.length === 0) {
          pushLog('TRIM: No valid intersection points on this entity.');
          return;
        }

        // Find bounding t values around clickT
        // tLow = largest t < clickT (or 0 if none)
        // tHigh = smallest t > clickT (or 1 if none)
        let tLow = 0;
        let tHigh = 1;
        for (const t of uniqueT) {
          if (t < clickT && t > tLow) tLow = t;
          if (t > clickT && t < tHigh) tHigh = t;
        }

        // Build remaining pieces (at most 2 intact lines)
        const remaining: CADEntity[] = [];

        // Left piece: from line start to tLow (if tLow > 0)
        if (tLow > 1e-6) {
          remaining.push({
            id: `${line.id}_trim_L`,
            type: 'line',
            layerId: line.layerId,
            color: line.color,
            lineWidth: line.lineWidth,
            x1: p1.x,
            y1: p1.y,
            x2: p1.x + tLow * dx,
            y2: p1.y + tLow * dy,
          } as LineEntity);
        }

        // Right piece: from tHigh to line end (if tHigh < 1)
        if (tHigh < 1 - 1e-6) {
          remaining.push({
            id: `${line.id}_trim_R`,
            type: 'line',
            layerId: line.layerId,
            color: line.color,
            lineWidth: line.lineWidth,
            x1: p1.x + tHigh * dx,
            y1: p1.y + tHigh * dy,
            x2: p2.x,
            y2: p2.y,
          } as LineEntity);
        }

        // Replace original with remaining pieces
        const newEntities = entities.filter(e => e.id !== hit.entity.id);
        newEntities.push(...remaining);
        setEntities(newEntities);
        pushLog(`TRIM: Removed segment from line. Click another entity or ESC.`);
        return;
      }

      // For non-line entities: fallback to old split-all behavior
      const splitPoints = intersections.map(i => i.point);
      const segments = splitEntityAtPoints(hit.entity, splitPoints);

      if (segments.length <= 1) {
        pushLog('TRIM: Cannot trim — only one segment.');
        return;
      }

      let clickedSegIdx = 0;
      let minDist = Infinity;
      segments.forEach((seg, idx) => {
        const d = distToEntity(seg, clickPt);
        if (d < minDist) {
          minDist = d;
          clickedSegIdx = idx;
        }
      });

      const remaining = segments.filter((_, i) => i !== clickedSegIdx);
      const newEntities = entities.filter(e => e.id !== hit.entity.id);
      newEntities.push(...remaining);
      setEntities(newEntities);
      pushLog(`TRIM: Removed segment from ${hit.entity.type}. Click another entity or ESC.`);
    },
    [entities, setEntities, pushLog, zoom],
  );

  const cancel = useCallback(() => {
    useCADStore.getState().setActiveTool('select');
  }, []);

  return { onMouseClick, cancel };
}
