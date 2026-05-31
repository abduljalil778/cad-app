import React from "react";
import { Line } from "react-konva";
import { JSX } from "react/jsx-dev-runtime";

interface GridRendererProps {
  zoom: number;
  panOffset: { x: number; y: number };
  stageWidth: number;
  stageHeight: number;
  gridPixel: number;
}

export default React.memo(function GridRenderer({
  zoom,
  panOffset,
  stageWidth,
  stageHeight,
  gridPixel,
}: GridRendererProps) {
  const lines: JSX.Element[] = [];
  const step = gridPixel * zoom;
  if (step < 6) return <>{lines}</>;

  const sx = ((-panOffset.x % step) + step) % step;
  const sy = ((-panOffset.y % step) + step) % step;

  for (let x = sx; x < stageWidth; x += step) {
    lines.push(
      <Line
        key={`v${x}`}
        points={[x, 0, x, stageHeight]}
        stroke="#2a2a2a"
        strokeWidth={0.5}
        listening={false}
      />,
    );
  }

  for (let y = sy; y < stageHeight; y += step) {
    lines.push(
      <Line
        key={`h${y}`}
        points={[0, y, stageWidth, y]}
        stroke="#2a2a2a"
        strokeWidth={0.5}
        listening={false}
      />,
    );
  }

  return <>{lines}</>;
});
