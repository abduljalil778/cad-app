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
  const geo = calcDimGeometry(entity);
  const scale = zoom * gridPixel;
  const sw = 0.8 / scale;
  const stroke = isSelected ? "#4fc3f7" : (entity.color ?? "#00ffff");
  const fontSize = 12 / scale;

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
        strokeWidth={sw}
        listening={false}
      />

      {/* Extension lines */}
      <Line
        points={[geo.ext1.x1, geo.ext1.y1, geo.ext1.x2, geo.ext1.y2]}
        stroke={stroke}
        strokeWidth={sw}
        listening={false}
      />
      <Line
        points={[geo.ext2.x1, geo.ext2.y1, geo.ext2.x2, geo.ext2.y2]}
        stroke={stroke}
        strokeWidth={sw}
        listening={false}
      />

      {/* Arrowheads */}
      <Line
        points={arrowPoints(geo.arrow1.x, geo.arrow1.y, geo.arrow1.angle)}
        stroke={stroke}
        strokeWidth={sw}
        closed
        fill={stroke}
        listening={false}
      />
      <Line
        points={arrowPoints(geo.arrow2.x, geo.arrow2.y, geo.arrow2.angle)}
        stroke={stroke}
        strokeWidth={sw}
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
