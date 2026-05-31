import { Line, Circle, Rect, Path } from "react-konva";
import { useLineTool } from "../../tools/useLineTool";
import { useRectangleTool } from "../../tools/useRectangleTool";
import { useCircleTool } from "../../tools/useCircleTool";
import { usePolylineTool } from "../../tools/usePolylineTool";
import { useArcTool } from "../../tools/useArcTool";
import { useDimensionTool } from "../../tools/useDimensionTool";
import { DimensionEntity } from "../../engine/entities";
import { arcToPath } from "../../engine/arcPath";
import DimensionShape from "./DimensionShape";
import { ActiveTool } from "../../store/useCADStore";

const PREVIEW_COLOR = "#00bcd4";

interface ToolPreviewRendererProps {
  activeTool: ActiveTool;
  lineTool: ReturnType<typeof useLineTool>;
  rectangleTool: ReturnType<typeof useRectangleTool>;
  circleTool: ReturnType<typeof useCircleTool>;
  polylineTool: ReturnType<typeof usePolylineTool>;
  arcTool: ReturnType<typeof useArcTool>;
  dimensionTool: ReturnType<typeof useDimensionTool>;
  zoom: number;
  gridPixel: number;
}

export default function ToolPreviewRenderer({
  activeTool,
  lineTool,
  rectangleTool,
  circleTool,
  polylineTool,
  arcTool,
  dimensionTool,
  zoom,
  gridPixel,
}: ToolPreviewRendererProps) {
  const scale = zoom * gridPixel;
  const sw = (n: number) => n / scale;

  // ── Dimension preview entity ──
  const dimPreview: DimensionEntity | null =
    activeTool === "dimension" &&
    dimensionTool.p1 &&
    dimensionTool.p2 &&
    dimensionTool.cursor &&
    dimensionTool.step === "offset"
      ? {
          id: "__preview__",
          type: "dimension",
          layerId: "0",
          color: PREVIEW_COLOR,
          dimType: "linear",
          x1: dimensionTool.p1.x,
          y1: dimensionTool.p1.y,
          x2: dimensionTool.p2.x,
          y2: dimensionTool.p2.y,
          dx: dimensionTool.cursor.x - dimensionTool.p1.x,
          dy: dimensionTool.cursor.y - dimensionTool.p1.y,
        }
      : null;

  return (
    <>
      {/* ── Line preview ── */}
      {lineTool.preview && (
        <Line
          points={[
            lineTool.preview.x1,
            lineTool.preview.y1,
            lineTool.preview.x2,
            lineTool.preview.y2,
          ]}
          stroke={PREVIEW_COLOR}
          strokeWidth={sw(1)}
          dash={[sw(6), sw(4)]}
          listening={false}
        />
      )}
      {lineTool.startPoint && (
        <Circle
          x={lineTool.startPoint.x}
          y={lineTool.startPoint.y}
          radius={sw(3)}
          fill={PREVIEW_COLOR}
          listening={false}
        />
      )}

      {/* ── Rectangle preview ── */}
      {rectangleTool.preview && (
        <Rect
          x={rectangleTool.preview.x}
          y={rectangleTool.preview.y}
          width={rectangleTool.preview.width}
          height={rectangleTool.preview.height}
          stroke={PREVIEW_COLOR}
          strokeWidth={sw(1)}
          fill="rgba(0,188,212,0.05)"
          dash={[sw(6), sw(4)]}
          listening={false}
        />
      )}
      {rectangleTool.startPoint && (
        <Circle
          x={rectangleTool.startPoint.x}
          y={rectangleTool.startPoint.y}
          radius={sw(3)}
          fill={PREVIEW_COLOR}
          listening={false}
        />
      )}

      {/* ── Circle preview ── */}
      {circleTool.preview && (
        <>
          <Circle
            x={circleTool.preview.cx}
            y={circleTool.preview.cy}
            radius={circleTool.preview.radius}
            stroke={PREVIEW_COLOR}
            strokeWidth={sw(1)}
            fill="rgba(0,188,212,0.05)"
            dash={[sw(6), sw(4)]}
            listening={false}
          />
          <Line
            points={[
              circleTool.preview.cx,
              circleTool.preview.cy,
              circleTool.preview.cx + circleTool.preview.radius,
              circleTool.preview.cy,
            ]}
            stroke={PREVIEW_COLOR}
            strokeWidth={sw(0.5)}
            dash={[sw(3), sw(3)]}
            listening={false}
          />
        </>
      )}
      {circleTool.center && (
        <Circle
          x={circleTool.center.x}
          y={circleTool.center.y}
          radius={sw(3)}
          fill={PREVIEW_COLOR}
          listening={false}
        />
      )}

      {/* ── Polyline preview ── */}
      {polylineTool.points.length > 0 && (
        <>
          {polylineTool.points.map((pt, i) => (
            <Circle
              key={i}
              x={pt.x}
              y={pt.y}
              radius={sw(3)}
              fill={PREVIEW_COLOR}
              listening={false}
            />
          ))}
          {polylineTool.cursor && (
            <Line
              points={[...polylineTool.points, polylineTool.cursor].flatMap(
                (p) => [p.x, p.y],
              )}
              stroke={PREVIEW_COLOR}
              strokeWidth={sw(1)}
              dash={[sw(6), sw(4)]}
              listening={false}
            />
          )}
        </>
      )}

      {/* ── Arc preview ── */}
      {arcTool.p1 && (
        <Circle
          x={arcTool.p1.x}
          y={arcTool.p1.y}
          radius={sw(3)}
          fill={PREVIEW_COLOR}
          listening={false}
        />
      )}
      {arcTool.p2 && (
        <Circle
          x={arcTool.p2.x}
          y={arcTool.p2.y}
          radius={sw(3)}
          fill="#ffaa44"
          listening={false}
        />
      )}
      {arcTool.preview && arcTool.preview.radius > 0 && (
        <Path
          data={arcToPath(
            arcTool.preview.cx,
            arcTool.preview.cy,
            arcTool.preview.radius,
            arcTool.preview.startAngle,
            arcTool.preview.endAngle,
          )}
          stroke={PREVIEW_COLOR}
          strokeWidth={sw(1)}
          fill="transparent"
          dash={[sw(6), sw(4)]}
          listening={false}
        />
      )}

      {/* ── Dimension preview ── */}
      {activeTool === "dimension" && dimensionTool.p1 && (
        <Circle
          x={dimensionTool.p1.x}
          y={dimensionTool.p1.y}
          radius={sw(3)}
          fill={PREVIEW_COLOR}
          listening={false}
        />
      )}
      {activeTool === "dimension" && dimensionTool.p2 && (
        <Circle
          x={dimensionTool.p2.x}
          y={dimensionTool.p2.y}
          radius={sw(3)}
          fill={PREVIEW_COLOR}
          listening={false}
        />
      )}
      {dimPreview && (
        <DimensionShape
          entity={dimPreview}
          zoom={zoom}
          gridPixel={gridPixel}
          isSelected={false}
        />
      )}
    </>
  );
}
