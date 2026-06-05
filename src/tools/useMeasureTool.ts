import { useState, useCallback } from 'react';
import { useCADStore } from '../store/useCADStore';
import { DimensionEntity } from '../engine/entities';
import { SnapPoint } from '../engine/snap';

type MeasureMode = 'dist' | 'angle' | 'area';

export function useMeasureTool() {
  const { activeTool, addEntity, activeLayerId, layers, pushLog } = useCADStore();
  const [points, setPoints] = useState<{ x: number; y: number }[]>([]);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);

  const mode: MeasureMode | null =
    activeTool === 'measure_dist' ? 'dist' :
    activeTool === 'measure_angle' ? 'angle' :
    activeTool === 'measure_area' ? 'area' : null;

  const activeLayer = layers.find(l => l.id === activeLayerId);
  const layerColor = activeLayer?.color ?? '#ffffff';

  const onMouseMove = useCallback(
    (_snap: SnapPoint | null, wx: number, wy: number) => {
      setCursor({ x: wx, y: wy });
    },
    [],
  );

  const onMouseClick = useCallback(
    (snap: SnapPoint | null, wx: number, wy: number) => {
      const pt = snap ?? { x: wx, y: wy };

      if (mode === 'dist') {
        const newPts = [...points, pt];
        setPoints(newPts);
        if (newPts.length === 2) {
          // Create linear dimension entity
          const [p1, p2] = newPts;
          const dist = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
          const entity: DimensionEntity = {
            id: `dim_dist_${Date.now()}`,
            type: 'dimension',
            dimType: 'linear',
            layerId: activeLayerId,
            color: layerColor,
            x1: p1.x, y1: p1.y,
            x2: p2.x, y2: p2.y,
            dx: 0, dy: -0.5, // offset above
          };
          addEntity(entity);
          pushLog(`MEASURE: Distance = ${dist.toFixed(4)}`);
          setPoints([]);
          useCADStore.getState().setActiveTool('select');
        }
      }

      if (mode === 'angle') {
        const newPts = [...points, pt];
        setPoints(newPts);
        if (newPts.length === 3) {
          // 3 points: ray1 (p1), vertex (p2), ray2 (p3)
          const [p1, vertex, p3] = newPts;
          const angle1 = Math.atan2(p1.y - vertex.y, p1.x - vertex.x);
          const angle2 = Math.atan2(p3.y - vertex.y, p3.x - vertex.x);
          let angleDiff = angle2 - angle1;
          if (angleDiff < 0) angleDiff += Math.PI * 2;
          const degrees = (angleDiff * 180) / Math.PI;

          const entity: DimensionEntity = {
            id: `dim_angle_${Date.now()}`,
            type: 'dimension',
            dimType: 'angular',
            layerId: activeLayerId,
            color: layerColor,
            x1: p1.x, y1: p1.y,
            x2: p3.x, y2: p3.y,
            x3: vertex.x, y3: vertex.y,
            dx: 0, dy: 0,
            text: `${degrees.toFixed(1)}°`,
          };
          addEntity(entity);
          pushLog(`MEASURE: Angle = ${degrees.toFixed(1)}°`);
          setPoints([]);
          useCADStore.getState().setActiveTool('select');
        }
      }

      if (mode === 'area') {
        setPoints(prev => [...prev, pt]);
      }
    },
    [mode, points, activeLayerId, layerColor, addEntity, pushLog],
  );

  // For area: Enter to finish polygon
  const finishArea = useCallback(() => {
    if (mode !== 'area' || points.length < 3) {
      pushLog('MEASURE: Need at least 3 points for area.');
      return;
    }

    // Shoelace formula for area
    let area = 0;
    let perimeter = 0;
    const n = points.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += points[i].x * points[j].y;
      area -= points[j].x * points[i].y;
      perimeter += Math.sqrt(
        (points[j].x - points[i].x) ** 2 + (points[j].y - points[i].y) ** 2,
      );
    }
    area = Math.abs(area) / 2;

    // Find centroid for label placement
    const cx = points.reduce((s, p) => s + p.x, 0) / n;
    const cy = points.reduce((s, p) => s + p.y, 0) / n;

    const entity: DimensionEntity = {
      id: `dim_area_${Date.now()}`,
      type: 'dimension',
      dimType: 'area',
      layerId: activeLayerId,
      color: layerColor,
      x1: cx, y1: cy, // centroid
      x2: cx, y2: cy,
      dx: 0, dy: 0,
      text: `A=${area.toFixed(4)}  P=${perimeter.toFixed(4)}`,
      areaPoints: [...points],
      areaValue: area,
      perimeterValue: perimeter,
    };
    addEntity(entity);
    pushLog(`MEASURE: Area = ${area.toFixed(4)}, Perimeter = ${perimeter.toFixed(4)}`);
    setPoints([]);
    useCADStore.getState().setActiveTool('select');
  }, [mode, points, activeLayerId, layerColor, addEntity, pushLog]);

  const cancel = useCallback(() => {
    setPoints([]);
    setCursor(null);
    useCADStore.getState().setActiveTool('select');
  }, []);

  // Hint text
  const getHintText = useCallback((): string | null => {
    if (mode === 'dist') {
      return points.length === 0 ? 'DIST: Click first point' : 'DIST: Click second point';
    }
    if (mode === 'angle') {
      if (points.length === 0) return 'ANGLE: Click first ray point';
      if (points.length === 1) return 'ANGLE: Click vertex point';
      return 'ANGLE: Click second ray point';
    }
    if (mode === 'area') {
      return `AREA: Click points (${points.length} so far). Enter = finish`;
    }
    return null;
  }, [mode, points]);

  return { mode, points, cursor, onMouseMove, onMouseClick, finishArea, cancel, getHintText };
}
