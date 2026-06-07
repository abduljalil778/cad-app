import { useState, useCallback } from "react";
import { useCADStore } from "../store/useCADStore";
import { LineEntity } from "../engine/entities";
import { SnapPoint } from "../engine/snap";

let idCounter = 0;
const genId = () => `line_${Date.now()}_${idCounter++}`;

export interface PreviewLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

function computeLineEndpoint(
  start: { x: number; y: number },
  direction: { x: number; y: number },
  length: number,
) {
  const dx = direction.x - start.x;
  const dy = direction.y - start.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 0.0001) {
    return { x: start.x + length, y: start.y };
  }
  const scale = length / dist;
  return { x: start.x + dx * scale, y: start.y + dy * scale };
}

export function useLineTool() {
  const { addEntity, activeLayerId, layers } = useCADStore();
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [preview, setPreview] = useState<PreviewLine | null>(null);
  const [cursorPoint, setCursorPoint] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [lengthValue, setLengthValue] = useState<string>("");
  const [targetLength, setTargetLength] = useState<number | null>(null);

  const activeLayer = layers.find((l) => l.id === activeLayerId);
  const layerColor = activeLayer?.color ?? "#ffffff";

  const buildPreview = useCallback(
    (end: { x: number; y: number }) => {
      if (!startPoint) return null;
      const point =
        targetLength != null
          ? computeLineEndpoint(startPoint, end, targetLength)
          : end;
      return {
        x1: startPoint.x,
        y1: startPoint.y,
        x2: point.x,
        y2: point.y,
      };
    },
    [startPoint, targetLength],
  );

  const onMouseMove = useCallback(
    (snapPoint: SnapPoint | null, worldX: number, worldY: number) => {
      if (!startPoint) return;
      const end = snapPoint ?? { x: worldX, y: worldY };
      setCursorPoint(end);
      setPreview(buildPreview(end));
    },
    [startPoint, buildPreview],
  );

  const onMouseClick = useCallback(
    (snapPoint: SnapPoint | null, worldX: number, worldY: number) => {
      const point = snapPoint ?? { x: worldX, y: worldY };

      if (!startPoint) {
        setStartPoint(point);
        setPreview(null);
      } else {
        const finalPoint =
          targetLength != null
            ? computeLineEndpoint(startPoint, point, targetLength)
            : point;
        const entity: LineEntity = {
          id: genId(),
          type: "line",
          layerId: activeLayerId,
          color: layerColor,
          x1: startPoint.x,
          y1: startPoint.y,
          x2: finalPoint.x,
          y2: finalPoint.y,
        };
        addEntity(entity);
        setStartPoint(finalPoint);
        setPreview(null);
        setCursorPoint(null);
        setLengthValue("");
        setTargetLength(null);
      }
    },
    [startPoint, activeLayerId, layerColor, addEntity, targetLength],
  );

  const onLengthChange = useCallback(
    (value: string) => {
      setLengthValue(value);
      const parsed = Number(value);
      const newLength = !Number.isNaN(parsed) && parsed > 0 ? parsed : null;
      setTargetLength(newLength);
      if (startPoint && cursorPoint) {
        setPreview(buildPreview(cursorPoint));
      }
    },
    [startPoint, cursorPoint, buildPreview],
  );

  const finish = useCallback(() => {
    if (!startPoint || !preview) return;
    const entity: LineEntity = {
      id: genId(),
      type: "line",
      layerId: activeLayerId,
      color: layerColor,
      x1: startPoint.x,
      y1: startPoint.y,
      x2: preview.x2,
      y2: preview.y2,
    };
    addEntity(entity);
    setStartPoint(null);
    setPreview(null);
    setCursorPoint(null);
    setLengthValue("");
    setTargetLength(null);
    useCADStore.getState().setActiveTool("select");
  }, [startPoint, preview, activeLayerId, layerColor, addEntity]);

  const cancel = useCallback(() => {
    setStartPoint(null);
    setPreview(null);
    setCursorPoint(null);
    setLengthValue("");
    setTargetLength(null);
  }, []);

  return {
    startPoint,
    preview,
    lengthValue,
    setLengthValue: onLengthChange,
    targetLength,
    onMouseMove,
    onMouseClick,
    cancel,
    finish,
  };
}
