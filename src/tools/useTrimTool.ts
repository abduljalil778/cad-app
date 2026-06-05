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
  const { entities, setEntities, pushLog } = useCADStore();

  const onMouseClick = useCallback(
    (_snap: SnapPoint | null, wx: number, wy: number) => {
      // Find nearest entity to click point
      const threshold = 0.2;
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

      // Sort by t parameter
      intersections.sort((a, b) => a.t - b.t);

      // Split entity at intersection points
      const splitPoints = intersections.map(i => i.point);
      const segments = splitEntityAtPoints(hit.entity, splitPoints);

      if (segments.length <= 1) {
        pushLog('TRIM: Cannot trim — only one segment.');
        return;
      }

      // Find which segment was clicked (closest to click point)
      let clickedSegIdx = 0;
      let minDist = Infinity;
      segments.forEach((seg, idx) => {
        const d = distToEntity(seg, clickPt);
        if (d < minDist) {
          minDist = d;
          clickedSegIdx = idx;
        }
      });

      // Remove the clicked segment, keep others
      const remaining = segments.filter((_, i) => i !== clickedSegIdx);

      // Update entities: remove original, add remaining segments
      const newEntities = entities.filter(e => e.id !== hit.entity.id);
      newEntities.push(...remaining);
      setEntities(newEntities);

      pushLog(`TRIM: Removed segment from ${hit.entity.type}.`);
      useCADStore.getState().setActiveTool('select');
    },
    [entities, setEntities, pushLog],
  );

  const cancel = useCallback(() => {
    useCADStore.getState().setActiveTool('select');
  }, []);

  return { onMouseClick, cancel };
}
