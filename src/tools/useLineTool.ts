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

export function useLineTool() {
  const { addEntity, activeLayerId, layers } = useCADStore();
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [preview, setPreview] = useState<PreviewLine | null>(null);

  const activeLayer = layers.find((l) => l.id === activeLayerId);
  const layerColor = activeLayer?.color ?? "#ffffff";

  const onMouseMove = useCallback(
    (snapPoint: SnapPoint | null, worldX: number, worldY: number) => {
      if (!startPoint) return;
      const end = snapPoint ?? { x: worldX, y: worldY };
      setPreview({ x1: startPoint.x, y1: startPoint.y, x2: end.x, y2: end.y });
    },
    [startPoint],
  );

  const onMouseClick = useCallback(
    (snapPoint: SnapPoint | null, worldX: number, worldY: number) => {
      const point = snapPoint ?? { x: worldX, y: worldY };

      if (!startPoint) {
        // klik pertama — set titik awal
        setStartPoint(point);
        setPreview(null);
      } else {
        // klik kedua — commit line ke store
        const entity: LineEntity = {
          id: genId(),
          type: "line",
          layerId: activeLayerId,
          color: layerColor,
          x1: startPoint.x,
          y1: startPoint.y,
          x2: point.x,
          y2: point.y,
        };
        addEntity(entity);

        // AutoCAD behavior: titik akhir jadi titik awal berikutnya
        setStartPoint(point);
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
