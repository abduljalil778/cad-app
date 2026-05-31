import React from "react";
import { Rect, Circle, Line } from "react-konva";
import { SnapPoint } from "../../engine/snap";

interface SnapIndicatorProps {
  snapPoint: SnapPoint | null;
  panOffset: { x: number; y: number };
  zoom: number;
  gridPixel: number;
}

export default React.memo(function SnapIndicator({
  snapPoint,
  panOffset,
  zoom,
  gridPixel,
}: SnapIndicatorProps) {
  if (!snapPoint) return null;

  const sx = snapPoint.x * gridPixel * zoom + panOffset.x;
  const sy = snapPoint.y * gridPixel * zoom + panOffset.y;
  const size = 8;
  const sw = 2;

  switch (snapPoint.type) {
    case "endpoint":
      return (
        <Rect
          x={sx - size / 2}
          y={sy - size / 2}
          width={size}
          height={size}
          stroke="#ffff00"
          strokeWidth={sw}
          fill="transparent"
          listening={false}
        />
      );

    case "midpoint":
      return (
        <Rect
          x={sx - size / 2}
          y={sy - size / 2}
          width={size}
          height={size}
          stroke="#00ff88"
          strokeWidth={sw}
          fill="transparent"
          rotation={45}
          offsetX={0}
          offsetY={0}
          listening={false}
        />
      );

    case "center":
      return (
        <Circle
          x={sx}
          y={sy}
          radius={size / 2}
          stroke="#ffff00"
          strokeWidth={sw}
          fill="transparent"
          listening={false}
        />
      );

    case "quadrant":
      return (
        <Rect
          x={sx - size / 2}
          y={sy - size / 2}
          width={size}
          height={size}
          stroke="#00bcd4"
          strokeWidth={sw}
          fill="transparent"
          rotation={45}
          offsetX={0}
          offsetY={0}
          listening={false}
        />
      );

    case "intersection":
      return (
        <>
          <Line
            points={[sx - size / 2, sy - size / 2, sx + size / 2, sy + size / 2]}
            stroke="#ff4444"
            strokeWidth={sw}
            listening={false}
          />
          <Line
            points={[sx + size / 2, sy - size / 2, sx - size / 2, sy + size / 2]}
            stroke="#ff4444"
            strokeWidth={sw}
            listening={false}
          />
        </>
      );

    case "grid":
      return (
        <Circle
          x={sx}
          y={sy}
          radius={4}
          stroke="#555"
          strokeWidth={1}
          fill="transparent"
          listening={false}
        />
      );

    default:
      return null;
  }
});
