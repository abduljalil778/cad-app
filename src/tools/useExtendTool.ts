import { useCallback } from 'react';
import { useCADStore } from '../store/useCADStore';
import {
  CADEntity,
  LineEntity,
  ArcEntity,
  PolylineEntity,
} from '../engine/entities';
import { findAllIntersections } from '../engine/intersection';
import { SnapPoint } from '../engine/snap';

/**
 * Distance from a point to a line segment.
 */
function distToLine(
  px: number, py: number,
  x1: number, y1: number,
  x2: number, y2: number,
): number {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
  return Math.sqrt((x1 + t * dx - px) ** 2 + (y1 + t * dy - py) ** 2);
}

/**
 * Determine which endpoint of a line is closer to the given point.
 * Returns 'start' or 'end'.
 */
function closerEnd(
  px: number, py: number,
  x1: number, y1: number,
  x2: number, y2: number,
): 'start' | 'end' {
  const d1 = Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
  const d2 = Math.sqrt((px - x2) ** 2 + (py - y2) ** 2);
  return d1 <= d2 ? 'start' : 'end';
}

/**
 * Find the nearest extendable entity (line, arc, polyline) within a threshold.
 */
function findNearestExtendable(
  entities: CADEntity[],
  pt: { x: number; y: number },
  threshold: number,
): CADEntity | null {
  let best: CADEntity | null = null;
  let bestDist = Infinity;
  for (const entity of entities) {
    if (!['line', 'arc', 'polyline'].includes(entity.type)) continue;
    let d = Infinity;
    if (entity.type === 'line') {
      const l = entity as LineEntity;
      d = distToLine(pt.x, pt.y, l.x1, l.y1, l.x2, l.y2);
    } else if (entity.type === 'polyline') {
      const p = entity as PolylineEntity;
      for (let i = 0; i < p.points.length - 1; i++) {
        const dd = distToLine(
          pt.x, pt.y,
          p.points[i].x, p.points[i].y,
          p.points[i + 1].x, p.points[i + 1].y,
        );
        if (dd < d) d = dd;
      }
    } else if (entity.type === 'arc') {
      const a = entity as ArcEntity;
      const dist = Math.sqrt((pt.x - a.cx) ** 2 + (pt.y - a.cy) ** 2);
      d = Math.abs(dist - a.radius);
    }
    if (d < threshold && d < bestDist) {
      bestDist = d;
      best = entity;
    }
  }
  return best;
}

/**
 * Extend a line infinitely in one direction and find intersection with boundary entities.
 */
function extendLineToIntersection(
  line: LineEntity,
  end: 'start' | 'end',
  boundaries: CADEntity[],
): { x: number; y: number } | null {
  // Create an extended version of the line (extend far in the chosen direction)
  const dx = line.x2 - line.x1;
  const dy = line.y2 - line.y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return null;

  const ux = dx / len;
  const uy = dy / len;
  const extensionLen = 1000; // extend very far

  let extendedLine: LineEntity;
  if (end === 'start') {
    // Extend from start point backwards
    extendedLine = {
      ...line,
      id: '__extend_temp__',
      x1: line.x1 - ux * extensionLen,
      y1: line.y1 - uy * extensionLen,
      x2: line.x2,
      y2: line.y2,
    };
  } else {
    // Extend from end point forwards
    extendedLine = {
      ...line,
      id: '__extend_temp__',
      x1: line.x1,
      y1: line.y1,
      x2: line.x2 + ux * extensionLen,
      y2: line.y2 + uy * extensionLen,
    };
  }

  // Find intersections of the extended line with all boundary entities
  const intersections = findAllIntersections(extendedLine, boundaries);
  if (intersections.length === 0) return null;

  // Find the closest intersection to the endpoint being extended
  const endPt = end === 'start'
    ? { x: line.x1, y: line.y1 }
    : { x: line.x2, y: line.y2 };

  // Filter to only intersections beyond the current endpoint
  const validIntersections = intersections.filter(ix => {
    if (end === 'start') {
      // Must be before the start point (in the extension direction)
      const toIx = (ix.point.x - line.x1) * (-ux) + (ix.point.y - line.y1) * (-uy);
      return toIx > 0.001; // beyond start point
    } else {
      // Must be beyond the end point
      const toIx = (ix.point.x - line.x2) * ux + (ix.point.y - line.y2) * uy;
      return toIx > 0.001;
    }
  });

  if (validIntersections.length === 0) return null;

  // Pick the nearest valid intersection
  let closest = validIntersections[0];
  let closestDist = Math.sqrt(
    (closest.point.x - endPt.x) ** 2 + (closest.point.y - endPt.y) ** 2,
  );
  for (let i = 1; i < validIntersections.length; i++) {
    const d = Math.sqrt(
      (validIntersections[i].point.x - endPt.x) ** 2 +
      (validIntersections[i].point.y - endPt.y) ** 2,
    );
    if (d < closestDist) {
      closestDist = d;
      closest = validIntersections[i];
    }
  }

  return closest.point;
}

export function useExtendTool() {
  const { entities, setEntities, pushLog } = useCADStore();

  const onMouseClick = useCallback(
    (_snap: SnapPoint | null, wx: number, wy: number) => {
      const threshold = 0.2;
      const clickPt = { x: wx, y: wy };

      // Find nearest extendable entity
      const hitEntity = findNearestExtendable(entities, clickPt, threshold);
      if (!hitEntity) {
        pushLog('EXTEND: No extendable entity found at click point.');
        return;
      }

      const boundaries = entities.filter(e => e.id !== hitEntity.id);
      if (boundaries.length === 0) {
        pushLog('EXTEND: No boundary entities to extend to.');
        return;
      }

      if (hitEntity.type === 'line') {
        const line = hitEntity as LineEntity;
        const end = closerEnd(wx, wy, line.x1, line.y1, line.x2, line.y2);
        const newPt = extendLineToIntersection(line, end, boundaries);

        if (!newPt) {
          pushLog('EXTEND: No boundary found in extension direction.');
          return;
        }

        const newEntities = entities.map(e => {
          if (e.id !== line.id) return e;
          if (end === 'start') {
            return { ...line, x1: newPt.x, y1: newPt.y } as CADEntity;
          } else {
            return { ...line, x2: newPt.x, y2: newPt.y } as CADEntity;
          }
        });
        setEntities(newEntities);
        pushLog('EXTEND: Line extended to boundary.');
      } else if (hitEntity.type === 'polyline') {
        const poly = hitEntity as PolylineEntity;
        if (poly.points.length < 2) {
          pushLog('EXTEND: Polyline too short.');
          return;
        }

        // Determine which end to extend
        const first = poly.points[0];
        const last = poly.points[poly.points.length - 1];
        const dFirst = Math.sqrt((wx - first.x) ** 2 + (wy - first.y) ** 2);
        const dLast = Math.sqrt((wx - last.x) ** 2 + (wy - last.y) ** 2);

        // Create a temporary line from the first/last segment
        if (dFirst <= dLast) {
          // Extend first segment backward
          const seg: LineEntity = {
            id: '__temp__', type: 'line', layerId: poly.layerId,
            x1: poly.points[1].x, y1: poly.points[1].y,
            x2: poly.points[0].x, y2: poly.points[0].y,
          };
          const newPt = extendLineToIntersection(seg, 'end', boundaries);
          if (!newPt) {
            pushLog('EXTEND: No boundary found.');
            return;
          }
          const newPoints = [{ x: newPt.x, y: newPt.y }, ...poly.points.slice(1)];
          const newEntities = entities.map(e =>
            e.id === poly.id ? { ...poly, points: newPoints } as CADEntity : e,
          );
          setEntities(newEntities);
          pushLog('EXTEND: Polyline first segment extended.');
        } else {
          // Extend last segment forward
          const n = poly.points.length;
          const seg: LineEntity = {
            id: '__temp__', type: 'line', layerId: poly.layerId,
            x1: poly.points[n - 2].x, y1: poly.points[n - 2].y,
            x2: poly.points[n - 1].x, y2: poly.points[n - 1].y,
          };
          const newPt = extendLineToIntersection(seg, 'end', boundaries);
          if (!newPt) {
            pushLog('EXTEND: No boundary found.');
            return;
          }
          const newPoints = [...poly.points.slice(0, -1), { x: newPt.x, y: newPt.y }];
          const newEntities = entities.map(e =>
            e.id === poly.id ? { ...poly, points: newPoints } as CADEntity : e,
          );
          setEntities(newEntities);
          pushLog('EXTEND: Polyline last segment extended.');
        }
      } else if (hitEntity.type === 'arc') {
        // Arc extension: try extending startAngle or endAngle
        const arc = hitEntity as ArcEntity;
        const sx = arc.cx + arc.radius * Math.cos(arc.startAngle);
        const sy = arc.cy + arc.radius * Math.sin(arc.startAngle);
        const ex = arc.cx + arc.radius * Math.cos(arc.endAngle);
        const ey = arc.cy + arc.radius * Math.sin(arc.endAngle);

        const dStart = Math.sqrt((wx - sx) ** 2 + (wy - sy) ** 2);
        const dEnd = Math.sqrt((wx - ex) ** 2 + (wy - ey) ** 2);

        // Find the intersection of the circle with boundary entities
        const tempCircle: CADEntity = {
          id: '__temp_circle__',
          type: 'circle',
          layerId: arc.layerId,
          cx: arc.cx,
          cy: arc.cy,
          radius: arc.radius,
        };
        const intersections = findAllIntersections(tempCircle, boundaries);
        if (intersections.length === 0) {
          pushLog('EXTEND: No boundary found for arc extension.');
          return;
        }

        // Find the nearest intersection angle
        if (dStart <= dEnd) {
          // Extend start angle backwards
          let bestAngle = arc.startAngle;
          let bestDist = Infinity;
          for (const ix of intersections) {
            const angle = Math.atan2(ix.point.y - arc.cy, ix.point.x - arc.cx);
            // Must be before startAngle
            let diff = arc.startAngle - angle;
            if (diff < 0) diff += Math.PI * 2;
            if (diff > 0.001 && diff < bestDist) {
              bestDist = diff;
              bestAngle = angle;
            }
          }
          if (bestAngle === arc.startAngle) {
            pushLog('EXTEND: No valid boundary for arc start.');
            return;
          }
          const newEntities = entities.map(e =>
            e.id === arc.id ? { ...arc, startAngle: bestAngle } as CADEntity : e,
          );
          setEntities(newEntities);
          pushLog('EXTEND: Arc start extended.');
        } else {
          // Extend end angle forwards
          let bestAngle = arc.endAngle;
          let bestDist = Infinity;
          for (const ix of intersections) {
            const angle = Math.atan2(ix.point.y - arc.cy, ix.point.x - arc.cx);
            let diff = angle - arc.endAngle;
            if (diff < 0) diff += Math.PI * 2;
            if (diff > 0.001 && diff < bestDist) {
              bestDist = diff;
              bestAngle = angle;
            }
          }
          if (bestAngle === arc.endAngle) {
            pushLog('EXTEND: No valid boundary for arc end.');
            return;
          }
          const newEntities = entities.map(e =>
            e.id === arc.id ? { ...arc, endAngle: bestAngle } as CADEntity : e,
          );
          setEntities(newEntities);
          pushLog('EXTEND: Arc end extended.');
        }
      } else {
        pushLog('EXTEND: Entity type not supported for extend.');
        return;
      }

      useCADStore.getState().setActiveTool('select');
    },
    [entities, setEntities, pushLog],
  );

  const cancel = useCallback(() => {
    useCADStore.getState().setActiveTool('select');
  }, []);

  return { onMouseClick, cancel };
}
