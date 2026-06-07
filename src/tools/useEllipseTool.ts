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
  const [cursorPoint, setCursorPoint] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [rxValue, setRxValue] = useState<string>("");
  const [ryValue, setRyValue] = useState<string>("");
  const [targetRx, setTargetRx] = useState<number | null>(null);
  const [targetRy, setTargetRy] = useState<number | null>(null);

  const activeLayer = layers.find((l) => l.id === activeLayerId);
  const layerColor = activeLayer?.color ?? "#ffffff";

  const buildPreview = useCallback(
    (pt: { x: number; y: number }) => {
      if (!center) return null;
      const rx = targetRx != null ? targetRx : Math.abs(pt.x - center.x);
      const ry = targetRy != null ? targetRy : Math.abs(pt.y - center.y);
      return {
        cx: center.x,
        cy: center.y,
        rx: Math.max(rx, 0.001),
        ry: Math.max(ry, 0.001),
      };
    },
    [center, targetRx, targetRy],
  );

  const onMouseMove = useCallback(
    (snap: SnapPoint | null, wx: number, wy: number) => {
      if (!center) return;
      const pt = snap ?? { x: wx, y: wy };
      setCursorPoint(pt);
      setPreview(buildPreview(pt));
    },
    [center, buildPreview],
  );

  const onMouseClick = useCallback(
    (snap: SnapPoint | null, wx: number, wy: number) => {
      const pt = snap ?? { x: wx, y: wy };

      if (!center) {
        setCenter(pt);
        setPreview(null);
      } else {
        const rx = targetRx != null ? targetRx : Math.abs(pt.x - center.x);
        const ry = targetRy != null ? targetRy : Math.abs(pt.y - center.y);

        if (rx < 0.001 && ry < 0.001) {
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
        pushLog(
          `ELLIPSE center=(${center.x.toFixed(2)}, ${(-center.y).toFixed(2)}) rx=${rx.toFixed(2)} ry=${ry.toFixed(2)}`,
        );
        setCenter(null);
        setPreview(null);
        setCursorPoint(null);
        setRxValue("");
        setRyValue("");
        setTargetRx(null);
        setTargetRy(null);
        useCADStore.getState().setActiveTool("select");
      }
    },
    [center, activeLayerId, layerColor, addEntity, pushLog, targetRx, targetRy],
  );

  const onRxChange = useCallback(
    (value: string) => {
      setRxValue(value);
      const parsed = Number(value);
      const nextRx = !Number.isNaN(parsed) && parsed > 0 ? parsed : null;
      setTargetRx(nextRx);
      if (center && cursorPoint) {
        setPreview(buildPreview(cursorPoint));
      }
    },
    [center, cursorPoint, buildPreview],
  );

  const onRyChange = useCallback(
    (value: string) => {
      setRyValue(value);
      const parsed = Number(value);
      const nextRy = !Number.isNaN(parsed) && parsed > 0 ? parsed : null;
      setTargetRy(nextRy);
      if (center && cursorPoint) {
        setPreview(buildPreview(cursorPoint));
      }
    },
    [center, cursorPoint, buildPreview],
  );

  const cancel = useCallback(() => {
    setCenter(null);
    setPreview(null);
    setCursorPoint(null);
    setRxValue("");
    setRyValue("");
    setTargetRx(null);
    setTargetRy(null);
  }, []);

  return {
    center,
    preview,
    rxValue,
    ryValue,
    setRxValue: onRxChange,
    setRyValue: onRyChange,
    targetRx,
    targetRy,
    onMouseMove,
    onMouseClick,
    cancel,
  };
}
