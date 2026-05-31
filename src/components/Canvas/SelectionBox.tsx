import React from "react";
import { Rect } from "react-konva";

export type SelectionMode = "window" | "crossing";

interface SelectionBoxProps {
  startPoint: { x: number; y: number };
  endPoint: { x: number; y: number };
  selectionMode: SelectionMode;
}

export default React.memo(function SelectionBox({
  startPoint,
  endPoint,
  selectionMode,
}: SelectionBoxProps) {
  const x = Math.min(startPoint.x, endPoint.x);
  const y = Math.min(startPoint.y, endPoint.y);
  const width = Math.abs(endPoint.x - startPoint.x);
  const height = Math.abs(endPoint.y - startPoint.y);

  const isWindow = selectionMode === "window";

  return (
    <Rect
      x={x}
      y={y}
      width={width}
      height={height}
      stroke={isWindow ? "#4488ff" : "#44ff88"}
      strokeWidth={1}
      fill={isWindow ? "rgba(68,136,255,0.08)" : "rgba(68,255,136,0.08)"}
      dash={isWindow ? undefined : [6, 4]}
      listening={false}
    />
  );
});
