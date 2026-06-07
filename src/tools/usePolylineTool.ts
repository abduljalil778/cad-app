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
  const [lengthValue, setLengthValue] = useState<string>("");
  const [targetLength, setTargetLength] = useState<number | null>(null);

  const activeLayer = layers.find((l) => l.id === activeLayerId);
  const layerColor = activeLayer?.color ?? "#ffffff";

  const computeSegmentEndpoint = (
    start: { x: number; y: number },
    direction: { x: number; y: number },
    length: number,
  ) => {
    const dx = direction.x - start.x;
    const dy = direction.y - start.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 0.0001) {
      return { x: start.x + length, y: start.y };
    }
    const scale = length / dist;
    return { x: start.x + dx * scale, y: start.y + dy * scale };
  };

  const onMouseMove = useCallback(
    (snap: SnapPoint | null, wx: number, wy: number) => {
      const pt = snap ?? { x: wx, y: wy };
      if (points.length === 0) {
        setCursor(pt);
      } else if (targetLength != null) {
        const lastPoint = points[points.length - 1];
        setCursor(computeSegmentEndpoint(lastPoint, pt, targetLength));
      } else {
        setCursor(pt);
      }
    },
    [points, targetLength],
  );

  const onMouseClick = useCallback(
    (snap: SnapPoint | null, wx: number, wy: number) => {
      const pt = snap ?? { x: wx, y: wy };
      const nextPoint =
        points.length > 0 && targetLength != null
          ? computeSegmentEndpoint(points[points.length - 1], pt, targetLength)
          : pt;
      setPoints((prev) => [...prev, nextPoint]);
    },
    [points, targetLength],
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
    useCADStore.getState().setActiveTool("select");
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
    useCADStore.getState().setActiveTool("select");
  }, [points, activeLayerId, layerColor, addEntity]);

  /** Backspace → undo last point */
  const onLengthChange = useCallback(
    (value: string) => {
      setLengthValue(value);
      const parsed = Number(value);
      const nextLength = !Number.isNaN(parsed) && parsed > 0 ? parsed : null;
      setTargetLength(nextLength);
      if (points.length > 0 && cursor) {
        if (nextLength != null) {
          setCursor(
            computeSegmentEndpoint(
              points[points.length - 1],
              cursor,
              nextLength,
            ),
          );
        } else {
          setCursor(cursor);
        }
      }
    },
    [points, cursor],
  );

  const undoLastPoint = useCallback(() => {
    setPoints((prev) => {
      if (prev.length <= 1) {
        setCursor(null);
        return [];
      }
      return prev.slice(0, -1);
    });
  }, []);

  const cancel = useCallback(() => {
    setPoints([]);
    setCursor(null);
    setLengthValue("");
    setTargetLength(null);
  }, []);

  return {
    points,
    cursor,
    lengthValue,
    setLengthValue: onLengthChange,
    targetLength,
    onMouseMove,
    onMouseClick,
    finish,
    close,
    cancel,
    undoLastPoint,
  };
}
