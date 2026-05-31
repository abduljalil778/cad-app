import { useState, useCallback } from "react";
import { useCADStore } from "../store/useCADStore";
import { RectangleEntity } from "../engine/entities";
import { SnapPoint } from "../engine/snap";

let idCounter = 0;
const genId = () => `rect_${Date.now()}_${idCounter++}`;

export interface PreviewRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function useRectangleTool() {
  const { addEntity, activeLayerId, layers } = useCADStore();
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [preview, setPreview] = useState<PreviewRect | null>(null);

  const activeLayer = layers.find((l) => l.id === activeLayerId);
  const layerColor = activeLayer?.color ?? "#ffffff";

  const buildRect = (
    ax: number,
    ay: number,
    bx: number,
    by: number,
  ): PreviewRect => ({
    x: Math.min(ax, bx),
    y: Math.min(ay, by),
    width: Math.abs(bx - ax),
    height: Math.abs(by - ay),
  });

  const onMouseMove = useCallback(
    (snapPoint: SnapPoint | null, worldX: number, worldY: number) => {
      if (!startPoint) return;
      const end = snapPoint ?? { x: worldX, y: worldY };
      setPreview(buildRect(startPoint.x, startPoint.y, end.x, end.y));
    },
    [startPoint],
  );

  const onMouseClick = useCallback(
    (snapPoint: SnapPoint | null, worldX: number, worldY: number) => {
      const point = snapPoint ?? { x: worldX, y: worldY };

      if (!startPoint) {
        setStartPoint(point);
        setPreview(null);
      } else {
        const rect = buildRect(startPoint.x, startPoint.y, point.x, point.y);
        if (rect.width < 0.001 || rect.height < 0.001) return; // ignore zero-size

        const entity: RectangleEntity = {
          id: genId(),
          type: "rectangle",
          layerId: activeLayerId,
          color: layerColor,
          ...rect,
        };
        addEntity(entity);
        setStartPoint(null);
        setPreview(null);
      }
    },
    [startPoint, activeLayerId, layerColor, addEntity],
  );

  const cancel = useCallback(() => {
    setStartPoint(null);
    setPreview(null);
  }, []);

  return { startPoint, preview, onMouseMove, onMouseClick, cancel };
}
