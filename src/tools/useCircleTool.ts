import { useState, useCallback } from "react";
import { useCADStore } from "../store/useCADStore";
import { CircleEntity } from "../engine/entities";
import { SnapPoint } from "../engine/snap";

let idCounter = 0;
const genId = () => `circle_${Date.now()}_${idCounter++}`;

export interface PreviewCircle {
  cx: number;
  cy: number;
  radius: number;
}

export function useCircleTool() {
  const { addEntity, activeLayerId, layers } = useCADStore();
  const [center, setCenter] = useState<{ x: number; y: number } | null>(null);
  const [preview, setPreview] = useState<PreviewCircle | null>(null);
  const [cursorPoint, setCursorPoint] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [radiusValue, setRadiusValue] = useState<string>("");
  const [targetRadius, setTargetRadius] = useState<number | null>(null);

  const activeLayer = layers.find((l) => l.id === activeLayerId);
  const layerColor = activeLayer?.color ?? "#ffffff";

  const getRadius = (cx: number, cy: number, px: number, py: number) =>
    Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);

  const buildPreview = useCallback(
    (pt: { x: number; y: number }) => {
      if (!center) return null;
      const radius =
        targetRadius != null
          ? targetRadius
          : getRadius(center.x, center.y, pt.x, pt.y);
      return { cx: center.x, cy: center.y, radius };
    },
    [center, targetRadius],
  );

  const onMouseMove = useCallback(
    (snapPoint: SnapPoint | null, worldX: number, worldY: number) => {
      if (!center) return;
      const pt = snapPoint ?? { x: worldX, y: worldY };
      setCursorPoint(pt);
      setPreview(buildPreview(pt));
    },
    [center, buildPreview],
  );

  const onMouseClick = useCallback(
    (snapPoint: SnapPoint | null, worldX: number, worldY: number) => {
      const point = snapPoint ?? { x: worldX, y: worldY };

      if (!center) {
        setCenter(point);
        setPreview(null);
      } else {
        const radius =
          targetRadius != null
            ? targetRadius
            : getRadius(center.x, center.y, point.x, point.y);
        if (radius < 0.001) return;

        const entity: CircleEntity = {
          id: genId(),
          type: "circle",
          layerId: activeLayerId,
          color: layerColor,
          cx: center.x,
          cy: center.y,
          radius,
        };
        addEntity(entity);
        setCenter(null);
        setPreview(null);
        setCursorPoint(null);
        setRadiusValue("");
        setTargetRadius(null);
        useCADStore.getState().setActiveTool("select");
      }
    },
    [center, activeLayerId, layerColor, addEntity, targetRadius],
  );

  const onRadiusChange = useCallback(
    (value: string) => {
      setRadiusValue(value);
      const parsed = Number(value);
      const nextRadius = !Number.isNaN(parsed) && parsed > 0 ? parsed : null;
      setTargetRadius(nextRadius);
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
    setRadiusValue("");
    setTargetRadius(null);
  }, []);

  return {
    center,
    preview,
    radiusValue,
    setRadiusValue: onRadiusChange,
    targetRadius,
    onMouseMove,
    onMouseClick,
    cancel,
  };
}
