import { useState, useCallback } from "react";
import { useCADStore } from "../store/useCADStore";
import { PolylineEntity } from "../engine/entities";
import { SnapPoint } from "../engine/snap";

let idCounter = 0;
const genId = () => `pline_${Date.now()}_${idCounter++}`;

export function usePolylineTool() {
  const { addEntity, activeLayerId, layers } = useCADStore();
  const [points, setPoints] = useState<{ x: number; y: number }[]>([]);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);

  const activeLayer = layers.find((l) => l.id === activeLayerId);
  const layerColor = activeLayer?.color ?? "#ffffff";

  const onMouseMove = useCallback(
    (snap: SnapPoint | null, wx: number, wy: number) => {
      setCursor(snap ?? { x: wx, y: wy });
    },
    [],
  );

  const onMouseClick = useCallback(
    (snap: SnapPoint | null, wx: number, wy: number) => {
      const pt = snap ?? { x: wx, y: wy };
      setPoints((prev) => [...prev, pt]);
    },
    [],
  );

  /** Enter → finish open polyline */
  const finish = useCallback(() => {
    if (points.length < 2) {
      cancel();
      return;
    }
    const entity: PolylineEntity = {
      id: genId(),
      type: "polyline",
      layerId: activeLayerId,
      color: layerColor,
      points,
      closed: false,
    };
    addEntity(entity);
    setPoints([]);
    setCursor(null);
  }, [points, activeLayerId, layerColor, addEntity]);

  /** C → close polyline (sambung balik ke titik pertama) */
  const close = useCallback(() => {
    if (points.length < 2) {
      cancel();
      return;
    }
    const entity: PolylineEntity = {
      id: genId(),
      type: "polyline",
      layerId: activeLayerId,
      color: layerColor,
      points,
      closed: true,
    };
    addEntity(entity);
    setPoints([]);
    setCursor(null);
  }, [points, activeLayerId, layerColor, addEntity]);

  /** Backspace → undo last point */
  const undoLastPoint = useCallback(() => {
    setPoints((prev) => {
      if (prev.length <= 1) {
        // If only 1 or 0 points, cancel entirely
        setCursor(null);
        return [];
      }
      return prev.slice(0, -1);
    });
  }, []);

  const cancel = useCallback(() => {
    setPoints([]);
    setCursor(null);
  }, []);

  return { points, cursor, onMouseMove, onMouseClick, finish, close, cancel, undoLastPoint };
}
