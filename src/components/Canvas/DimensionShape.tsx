import { Line, Text } from "react-konva";
import { DimensionEntity } from "../../engine/entities";
import { calcDimGeometry } from "../../engine/dimensionRenderer";

interface Props {
  entity: DimensionEntity;
  zoom: number;
  gridPixel: number;
  isSelected: boolean;
}

export default function DimensionShape({
  entity,
  zoom,
  gridPixel,
  isSelected,
}: Props) {
  const scale = zoom * gridPixel;
  const sw0 = 0.8 / scale;
  const stroke = isSelected ? "#4fc3f7" : (entity.color ?? "#00ffff");
  const fontSize = 12 / scale;

  // ── Angular dimension ──
  if (entity.dimType === "angular") {
    const vx = entity.x3 ?? entity.x1;
    const vy = entity.y3 ?? entity.y1;
    const label = entity.text ?? "0°";
    return (
      <>
        {/* Ray lines from vertex to points */}
        <Line
          points={[vx, vy, entity.x1, entity.y1]}
          stroke={stroke}
          strokeWidth={sw0}
          dash={[sw0 * 4, sw0 * 4]}
          listening={false}
        />
        <Line
          points={[vx, vy, entity.x2, entity.y2]}
          stroke={stroke}
          strokeWidth={sw0}
          dash={[sw0 * 4, sw0 * 4]}
          listening={false}
        />
        {/* Angle label at vertex offset */}
        <Text
          x={vx + fontSize * 0.5}
          y={vy - fontSize * 1.2}
          text={label}
          fontSize={fontSize}
          fill={stroke}
          listening={false}
        />
      </>
    );
  }

  // ── Area dimension ──
  if (entity.dimType === "area") {
    const pts = entity.areaPoints ?? [];
    const label = entity.text ?? `A=${entity.areaValue?.toFixed(2) ?? "?"}`;
    return (
      <>
        {/* Polygon outline */}
        {pts.length >= 3 && (
          <Line
            points={[...pts.flatMap(p => [p.x, p.y]), pts[0].x, pts[0].y]}
            stroke={stroke}
            strokeWidth={sw0}
            dash={[sw0 * 6, sw0 * 3]}
            listening={false}
          />
        )}
        {/* Area label at centroid */}
        <Text
          x={entity.x1}
          y={entity.y1}
          text={label}
          fontSize={fontSize}
          fill={stroke}
          offsetX={label.length * fontSize * 0.25}
          offsetY={fontSize * 0.5}
          listening={false}
        />
      </>
    );
  }

  // ── Radial dimension ──
  if (entity.dimType === "radial") {
    const label = entity.text ?? `R=${Math.sqrt((entity.x2-entity.x1)**2+(entity.y2-entity.y1)**2).toFixed(2)}`;
    return (
      <>
        <Line
          points={[entity.x1, entity.y1, entity.x2, entity.y2]}
          stroke={stroke}
          strokeWidth={sw0}
          listening={false}
        />
        <Text
          x={(entity.x1 + entity.x2) / 2}
          y={(entity.y1 + entity.y2) / 2 - fontSize}
          text={label}
          fontSize={fontSize}
          fill={stroke}
          offsetX={label.length * fontSize * 0.25}
          listening={false}
        />
      </>
    );
  }

  // ── Linear / Aligned dimension (default) ──
  const geo = calcDimGeometry(entity);
  const arrowSize = 0.12;

  function arrowPoints(x: number, y: number, angleDeg: number) {
    const a = (angleDeg * Math.PI) / 180;
    const tip = { x, y };
    const back1 = {
      x: x + arrowSize * Math.cos(a + Math.PI + 0.35),
      y: y + arrowSize * Math.sin(a + Math.PI + 0.35),
    };
    const back2 = {
      x: x + arrowSize * Math.cos(a + Math.PI - 0.35),
      y: y + arrowSize * Math.sin(a + Math.PI - 0.35),
    };
    return [back1.x, back1.y, tip.x, tip.y, back2.x, back2.y];
  }

  return (
    <>
      {/* Dimension line */}
      <Line
        points={[
          geo.dimLine.x1,
          geo.dimLine.y1,
          geo.dimLine.x2,
          geo.dimLine.y2,
        ]}
        stroke={stroke}
        strokeWidth={sw0}
        listening={false}
      />

      {/* Extension lines */}
      <Line
        points={[geo.ext1.x1, geo.ext1.y1, geo.ext1.x2, geo.ext1.y2]}
        stroke={stroke}
        strokeWidth={sw0}
        listening={false}
      />
      <Line
        points={[geo.ext2.x1, geo.ext2.y1, geo.ext2.x2, geo.ext2.y2]}
        stroke={stroke}
        strokeWidth={sw0}
        listening={false}
      />

      {/* Arrowheads */}
      <Line
        points={arrowPoints(geo.arrow1.x, geo.arrow1.y, geo.arrow1.angle)}
        stroke={stroke}
        strokeWidth={sw0}
        closed
        fill={stroke}
        listening={false}
      />
      <Line
        points={arrowPoints(geo.arrow2.x, geo.arrow2.y, geo.arrow2.angle)}
        stroke={stroke}
        strokeWidth={sw0}
        closed
        fill={stroke}
        listening={false}
      />

      {/* Dimension text */}
      <Text
        x={geo.textX}
        y={geo.textY}
        text={geo.textValue}
        fontSize={fontSize}
        fill={stroke}
        rotation={geo.textAngle}
        offsetX={geo.textValue.length * fontSize * 0.3}
        offsetY={fontSize * 0.5}
        listening={false}
      />
    </>
  );
}
