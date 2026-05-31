import React from "react";
import { Line, Circle, Rect, Path, Text as KonvaText, Ellipse } from "react-konva";
import {
  CADEntity,
  LineEntity,
  RectangleEntity,
  CircleEntity,
  PolylineEntity,
  ArcEntity,
  DimensionEntity,
} from "../../engine/entities";
import { arcToPath } from "../../engine/arcPath";
import DimensionShape from "./DimensionShape";
import { Layer } from "../../store/useCADStore";

interface EntityRendererProps {
  entities: CADEntity[];
  selectedIds: string[];
  layers: Layer[];
  zoom: number;
  gridPixel: number;
}

export default React.memo(function EntityRenderer({
  entities,
  selectedIds,
  layers,
  zoom,
  gridPixel,
}: EntityRendererProps) {
  const scale = zoom * gridPixel;
  const sw = (n: number) => n / scale;

  const layerMap = new Map(layers.map((l) => [l.id, l]));

  return (
    <>
      {entities.map((entity) => {
        // Enforce layer visibility
        const layer = layerMap.get(entity.layerId);
        if (layer && !layer.visible) return null;

        const sel = selectedIds.includes(entity.id);
        const stroke = sel ? "#4fc3f7" : (entity.color ?? "#ffffff");
        const strokeWidth = sw((entity.lineWidth ?? 0.8) * (sel ? 2.5 : 1));

        if (entity.type === "line") {
          const l = entity as LineEntity;
          return (
            <Line
              key={l.id}
              points={[l.x1, l.y1, l.x2, l.y2]}
              stroke={stroke}
              strokeWidth={strokeWidth}
              dash={sel ? [sw(6), sw(3)] : undefined}
              listening={false}
            />
          );
        }

        if (entity.type === "rectangle") {
          const r = entity as RectangleEntity;
          return (
            <Rect
              key={r.id}
              x={r.x}
              y={r.y}
              width={r.width}
              height={r.height}
              stroke={stroke}
              strokeWidth={strokeWidth}
              fill={sel ? "rgba(79,195,247,0.07)" : "transparent"}
              listening={false}
            />
          );
        }

        if (entity.type === "circle") {
          const c = entity as CircleEntity;
          return (
            <Circle
              key={c.id}
              x={c.cx}
              y={c.cy}
              radius={c.radius}
              stroke={stroke}
              strokeWidth={strokeWidth}
              fill={sel ? "rgba(79,195,247,0.07)" : "transparent"}
              listening={false}
            />
          );
        }

        if (entity.type === "polyline") {
          const p = entity as PolylineEntity;
          const pts = p.points.flatMap((pt) => [pt.x, pt.y]);
          if (p.closed) pts.push(p.points[0].x, p.points[0].y);
          return (
            <Line
              key={p.id}
              points={pts}
              stroke={stroke}
              strokeWidth={strokeWidth}
              listening={false}
            />
          );
        }

        if (entity.type === "arc") {
          const a = entity as ArcEntity;
          return (
            <Path
              key={a.id}
              data={arcToPath(a.cx, a.cy, a.radius, a.startAngle, a.endAngle)}
              stroke={stroke}
              strokeWidth={strokeWidth}
              fill="transparent"
              listening={false}
            />
          );
        }

        if (entity.type === "dimension") {
          return (
            <DimensionShape
              key={entity.id}
              entity={entity as DimensionEntity}
              zoom={zoom}
              gridPixel={gridPixel}
              isSelected={sel}
            />
          );
        }

        if (entity.type === "text") {
          const t = entity as any;
          return (
            <KonvaText
              key={t.id}
              x={t.x}
              y={t.y}
              text={t.text}
              fontSize={t.fontSize / scale}
              fontFamily={t.fontFamily ?? "sans-serif"}
              fontStyle={`${t.bold ? "bold" : ""} ${t.italic ? "italic" : ""}`.trim() || "normal"}
              fill={stroke}
              rotation={t.rotation ?? 0}
              align={t.alignment ?? "left"}
              lineHeight={t.lineHeight ?? 1.2}
              listening={false}
            />
          );
        }

        if (entity.type === "ellipse") {
          const e = entity as any;
          return (
            <Ellipse
              key={e.id}
              x={e.cx}
              y={e.cy}
              radiusX={e.rx}
              radiusY={e.ry}
              rotation={(e.rotation ?? 0) * (180 / Math.PI)}
              stroke={stroke}
              strokeWidth={strokeWidth}
              fill={sel ? "rgba(79,195,247,0.07)" : "transparent"}
              listening={false}
            />
          );
        }

        return null;
      })}
    </>
  );
});
