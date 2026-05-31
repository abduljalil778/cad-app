import { useState, useCallback } from "react";
import { useCADStore } from "../store/useCADStore";
import { EllipseEntity } from "../engine/entities";
import { SnapPoint } from "../engine/snap";

let idCounter = 0;
const genId = () => `ellipse_${Date.now()}_${idCounter++}`;

export interface PreviewEllipse {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

export function useEllipseTool() {
  const { addEntity, activeLayerId, layers, pushLog } = useCADStore();
  const [center, setCenter] = useState<{ x: number; y: number } | null>(null);
  const [preview, setPreview] = useState<PreviewEllipse | null>(null);

  const activeLayer = layers.find((l) => l.id === activeLayerId);
  const layerColor = activeLayer?.color ?? "#ffffff";

  const onMouseMove = useCallback(
    (_snap: SnapPoint | null, wx: number, wy: number) => {
      if (!center) return;
      const rx = Math.abs(wx - center.x);
      const ry = Math.abs(wy - center.y);
      setPreview({ cx: center.x, cy: center.y, rx: Math.max(rx, 0.001), ry: Math.max(ry, 0.001) });
    },
    [center],
  );

  const onMouseClick = useCallback(
    (snap: SnapPoint | null, wx: number, wy: number) => {
      const pt = snap ?? { x: wx, y: wy };

      if (!center) {
        // Click 1: set center
        setCenter(pt);
        setPreview(null);
      } else {
        // Click 2: commit ellipse
        const rx = Math.abs(pt.x - center.x);
        const ry = Math.abs(pt.y - center.y);

        if (rx < 0.001 && ry < 0.001) {
          // Too small, ignore
          return;
        }

        const entity: EllipseEntity = {
          id: genId(),
          type: "ellipse",
          layerId: activeLayerId,
          color: layerColor,
          cx: center.x,
          cy: center.y,
          rx: Math.max(rx, 0.01),
          ry: Math.max(ry, 0.01),
          rotation: 0,
        };
        addEntity(entity);
        pushLog(`ELLIPSE center=(${center.x.toFixed(2)}, ${(-center.y).toFixed(2)}) rx=${rx.toFixed(2)} ry=${ry.toFixed(2)}`);
        setCenter(null);
        setPreview(null);
      }
    },
    [center, activeLayerId, layerColor, addEntity, pushLog],
  );

  const cancel = useCallback(() => {
    setCenter(null);
    setPreview(null);
  }, []);

  return { center, preview, onMouseMove, onMouseClick, cancel };
}
