import { useState, useCallback, useRef } from 'react';
import { useCADStore } from '../store/useCADStore';
import { LineEntity, ArcEntity } from '../engine/entities';
import { computeFillet, FilletResult } from '../engine/fillet';
import { SnapPoint } from '../engine/snap';

/**
 * Find the nearest LineEntity to (wx, wy) within a zoom-dependent threshold.
 * Returns the entity and the distance, or null if nothing is close enough.
 */
function findNearestLine(
  entities: ReturnType<typeof useCADStore.getState>['entities'],
  wx: number,
  wy: number,
  zoom: number,
  excludeId?: string,
): LineEntity | null {
  const threshold = 0.15 / (zoom * 0.5 + 0.5); // matches select tool scaling
  let best: LineEntity | null = null;
  let bestDist = Infinity;

  for (const e of entities) {
    if (e.type !== 'line') continue;
    if (excludeId && e.id === excludeId) continue;
    const l = e as LineEntity;
    const dx = l.x2 - l.x1, dy = l.y2 - l.y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) continue;
    const t = Math.max(0, Math.min(1, ((wx - l.x1) * dx + (wy - l.y1) * dy) / (len * len)));
    const dist = Math.sqrt((l.x1 + t * dx - wx) ** 2 + (l.y1 + t * dy - wy) ** 2);
    if (dist < threshold && dist < bestDist) {
      best = l;
      bestDist = dist;
    }
  }

  return best;
}

export function useFilletTool() {
  const { entities, setEntities, pushLog, zoom } = useCADStore();
  const [firstLine, setFirstLine] = useState<LineEntity | null>(null);
  const [radius, setRadius] = useState(0.5);
  const [step, setStep] = useState<'first' | 'second'>('first');
  const [previewResult, setPreviewResult] = useState<FilletResult | null>(null);

  // Keep a ref to radius so onMouseMove always sees the current value
  const radiusRef = useRef(radius);
  radiusRef.current = radius;

  const onMouseMove = useCallback(
    (_snap: SnapPoint | null, wx: number, wy: number) => {
      if (step !== 'second' || !firstLine) {
        setPreviewResult(null);
        return;
      }

      const hit = findNearestLine(entities, wx, wy, zoom, firstLine.id);
      if (!hit) {
        setPreviewResult(null);
        return;
      }

      const result = computeFillet(firstLine, hit, radiusRef.current);
      setPreviewResult(result);
    },
    [entities, zoom, step, firstLine],
  );

  const onMouseClick = useCallback(
    (_snap: SnapPoint | null, wx: number, wy: number) => {
      const hit = findNearestLine(
        entities,
        wx,
        wy,
        zoom,
        step === 'second' ? firstLine?.id : undefined,
      );

      if (!hit) {
        pushLog('FILLET: No line found. Click a line.');
        return;
      }

      if (step === 'first') {
        setFirstLine(hit);
        setStep('second');
        setPreviewResult(null);
        pushLog('FILLET: Click second line.');
      } else if (step === 'second' && firstLine) {
        if (hit.id === firstLine.id) {
          pushLog('FILLET: Cannot fillet a line with itself.');
          return;
        }

        const result = computeFillet(firstLine, hit, radius);
        if (!result) {
          pushLog('FILLET: Lines are parallel or radius too large.');
          setStep('first');
          setFirstLine(null);
          setPreviewResult(null);
          return;
        }

        // Replace original lines with trimmed lines + arc
        const newEntities = entities.filter(e => e.id !== firstLine.id && e.id !== hit.id);

        // Trimmed line 1
        newEntities.push({
          ...firstLine,
          id: `${firstLine.id}_trimmed`,
          x1: result.line1.x1, y1: result.line1.y1,
          x2: result.line1.x2, y2: result.line1.y2,
        });

        // Trimmed line 2
        newEntities.push({
          ...hit,
          id: `${hit.id}_trimmed`,
          x1: result.line2.x1, y1: result.line2.y1,
          x2: result.line2.x2, y2: result.line2.y2,
        });

        // Fillet arc
        const arcEntity: ArcEntity = {
          id: `fillet_${Date.now()}`,
          type: 'arc',
          layerId: firstLine.layerId,
          color: firstLine.color,
          cx: result.arc.cx,
          cy: result.arc.cy,
          radius: result.arc.radius,
          startAngle: result.arc.startAngle,
          endAngle: result.arc.endAngle,
        };
        newEntities.push(arcEntity);

        setEntities(newEntities);
        pushLog(`FILLET: Applied fillet with radius ${radius}.`);

        setStep('first');
        setFirstLine(null);
        setPreviewResult(null);
        useCADStore.getState().setActiveTool('select');
      }
    },
    [entities, setEntities, pushLog, step, firstLine, radius, zoom],
  );

  const setFilletRadius = useCallback((r: number) => {
    setRadius(r);
  }, []);

  const cancel = useCallback(() => {
    setStep('first');
    setFirstLine(null);
    setPreviewResult(null);
    useCADStore.getState().setActiveTool('select');
  }, []);

  return { step, firstLine, radius, previewResult, onMouseClick, onMouseMove, setFilletRadius, cancel };
}
