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

function buildRect(
  ax: number,
  ay: number,
  bx: number,
  by: number,
): PreviewRect {
  return {
    x: Math.min(ax, bx),
    y: Math.min(ay, by),
    width: Math.abs(bx - ax),
    height: Math.abs(by - ay),
  };
}

function sign(value: number) {
  if (value === 0) return 1;
  return value > 0 ? 1 : -1;
}

export function useRectangleTool() {
  const { addEntity, activeLayerId, layers } = useCADStore();
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [preview, setPreview] = useState<PreviewRect | null>(null);
  const [cursorPoint, setCursorPoint] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [widthValue, setWidthValue] = useState<string>("");
  const [heightValue, setHeightValue] = useState<string>("");
  const [targetWidth, setTargetWidth] = useState<number | null>(null);
  const [targetHeight, setTargetHeight] = useState<number | null>(null);

  const activeLayer = layers.find((l) => l.id === activeLayerId);
  const layerColor = activeLayer?.color ?? "#ffffff";

  const buildPreviewFromTarget = useCallback(
    (direction: { x: number; y: number }) => {
      if (!startPoint) return null;
      const dx = direction.x - startPoint.x;
      const dy = direction.y - startPoint.y;
      const signX = sign(dx);
      const signY = sign(dy);
      const width = targetWidth != null ? targetWidth : Math.abs(dx);
      const height = targetHeight != null ? targetHeight : Math.abs(dy);
      return {
        x: signX === 1 ? startPoint.x : startPoint.x - width,
        y: signY === 1 ? startPoint.y : startPoint.y - height,
        width,
        height,
      };
    },
    [startPoint, targetWidth, targetHeight],
  );

  const onMouseMove = useCallback(
    (snapPoint: SnapPoint | null, worldX: number, worldY: number) => {
      if (!startPoint) return;
      const end = snapPoint ?? { x: worldX, y: worldY };
      setCursorPoint(end);
      const nextPreview =
        targetWidth != null || targetHeight != null
          ? buildPreviewFromTarget(end)
          : buildRect(startPoint.x, startPoint.y, end.x, end.y);
      setPreview(nextPreview);
    },
    [startPoint, targetWidth, targetHeight, buildPreviewFromTarget],
  );

  const onMouseClick = useCallback(
    (snapPoint: SnapPoint | null, worldX: number, worldY: number) => {
      const point = snapPoint ?? { x: worldX, y: worldY };

      if (!startPoint) {
        setStartPoint(point);
        setPreview(null);
      } else {
        const rect =
          targetWidth != null || targetHeight != null
            ? buildPreviewFromTarget(point)
            : buildRect(startPoint.x, startPoint.y, point.x, point.y);

        if (!rect || rect.width < 0.001 || rect.height < 0.001) return;

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
        setWidthValue("");
        setHeightValue("");
        setTargetWidth(null);
        setTargetHeight(null);
        useCADStore.getState().setActiveTool("select");
      }
    },
    [
      startPoint,
      activeLayerId,
      layerColor,
      addEntity,
      targetWidth,
      targetHeight,
      buildPreviewFromTarget,
    ],
  );

  const onWidthChange = useCallback(
    (value: string) => {
      setWidthValue(value);
      const parsed = Number(value);
      const nextWidth = !Number.isNaN(parsed) && parsed > 0 ? parsed : null;
      setTargetWidth(nextWidth);
      if (startPoint && cursorPoint) {
        setPreview(buildPreviewFromTarget(cursorPoint));
      }
    },
    [startPoint, cursorPoint, buildPreviewFromTarget],
  );

  const onHeightChange = useCallback(
    (value: string) => {
      setHeightValue(value);
      const parsed = Number(value);
      const nextHeight = !Number.isNaN(parsed) && parsed > 0 ? parsed : null;
      setTargetHeight(nextHeight);
      if (startPoint && cursorPoint) {
        setPreview(buildPreviewFromTarget(cursorPoint));
      }
    },
    [startPoint, cursorPoint, buildPreviewFromTarget],
  );

  const cancel = useCallback(() => {
    setStartPoint(null);
    setPreview(null);
    setWidthValue("");
    setHeightValue("");
    setTargetWidth(null);
    setTargetHeight(null);
  }, []);

  return {
    startPoint,
    preview,
    widthValue,
    heightValue,
    setWidthValue: onWidthChange,
    setHeightValue: onHeightChange,
    targetWidth,
    targetHeight,
    onMouseMove,
    onMouseClick,
    cancel,
  };
}
