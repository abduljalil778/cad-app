import DxfWriter from "dxf-writer";
import {
  CADEntity,
  LineEntity,
  RectangleEntity,
  CircleEntity,
  PolylineEntity,
  ArcEntity,
} from "../engine/entities";
import { Layer } from "../store/useCADStore";
import { calcDimGeometry } from "../engine/dimensionRenderer";
import { DimensionEntity } from "../engine/entities";

function hexToACI(hex: string): number {
  const map: Record<string, number> = {
    "#ffffff": 7,
    "#ff0000": 1,
    "#ffff00": 2,
    "#00ff00": 3,
    "#00ffff": 4,
    "#0000ff": 5,
    "#ff00ff": 6,
    "#ff4444": 1,
    "#44aaff": 4,
    "#44ff88": 3,
    "#ffaa44": 30,
    "#cc44ff": 6,
  };
  return map[hex.toLowerCase()] ?? 7;
}

/**
 * Inject $INSUNITS dan $MEASUREMENT ke section HEADER yang sudah ada.
 * dxf-writer membuat section HEADER minimal — kita sisipkan variable
 * unit setelah $ACADVER agar AutoCAD membaca satuan dengan benar.
 *
 * $INSUNITS:
 *   4 = Millimeters
 *   6 = Meters
 *
 * $MEASUREMENT:
 *   0 = English, 1 = Metric
 */
function injectUnitHeader(dxfString: string, unit: "mm" | "m"): string {
  const insunits = unit === "mm" ? 4 : 6;

  const unitBlock = [
    "  9",
    "$INSUNITS",
    " 70",
    String(insunits),
    "  9",
    "$MEASUREMENT",
    " 70",
    "1",
    "  9",
    "$LUNITS",
    " 70",
    "2",
    "  9",
    "$LUPREC",
    " 70",
    "4",
  ].join("\n");

  // Sisipkan tepat setelah baris $ACADVER value (baris ke-4 di HEADER section)
  // Pattern: cari "  1\nAC1015\n" lalu sisipkan unit block setelahnya
  const marker = /(\s*1\s*\nAC\d+\s*\n)/;
  if (marker.test(dxfString)) {
    return dxfString.replace(marker, `$1${unitBlock}\n`);
  }

  // Fallback: sisipkan setelah "SECTION\n  2\nHEADER\n"
  const headerMarker = /(SECTION\s*\n\s*2\s*\nHEADER\s*\n)/;
  if (headerMarker.test(dxfString)) {
    return dxfString.replace(headerMarker, `$1${unitBlock}\n`);
  }

  // Jika tidak ada HEADER section sama sekali, tambahkan di awal
  const headerSection = [
    "  0",
    "SECTION",
    "  2",
    "HEADER",
    unitBlock,
    "  0",
    "ENDSEC",
    "",
  ].join("\n");

  return headerSection + dxfString;
}

export function exportDXF(
  entities: CADEntity[],
  layers: Layer[],
  unit: "mm" | "m" = "m",
): string {
  const d = new DxfWriter();

  // Register semua layer
  for (const layer of layers) {
    d.addLayer(layer.name, hexToACI(layer.color), "CONTINUOUS");
  }

  for (const entity of entities) {
    const layer = layers.find((l) => l.id === entity.layerId);
    const layerName = layer?.name ?? "0";
    d.setActiveLayer(layerName);

    if (entity.type === "line") {
      const l = entity as LineEntity;
      d.drawLine(l.x1, -l.y1, l.x2, -l.y2);
    }

    if (entity.type === "circle") {
      const c = entity as CircleEntity;
      d.drawCircle(c.cx, -c.cy, c.radius);
    }

    if (entity.type === "rectangle") {
      const r = entity as RectangleEntity;
      const x1 = r.x,
        y1 = -r.y;
      const x2 = r.x + r.width,
        y2 = -(r.y + r.height);
      d.drawLine(x1, y1, x2, y1);
      d.drawLine(x2, y1, x2, y2);
      d.drawLine(x2, y2, x1, y2);
      d.drawLine(x1, y2, x1, y1);
    }

    if (entity.type === "polyline") {
      const p = entity as PolylineEntity;
      // Gambar sebagai rangkaian LINE di DXF
      for (let i = 0; i < p.points.length - 1; i++) {
        d.setActiveLayer(layerName);
        d.drawLine(
          p.points[i].x,
          -p.points[i].y,
          p.points[i + 1].x,
          -p.points[i + 1].y,
        );
      }
      if (p.closed && p.points.length > 1) {
        const last = p.points[p.points.length - 1];
        const first = p.points[0];
        d.drawLine(last.x, -last.y, first.x, -first.y);
      }
    }

    if (entity.type === "arc") {
      const a = entity as ArcEntity;
      // DXF ARC: sudut dalam derajat, CCW dari East
      const startDeg = ((a.startAngle * 180) / Math.PI + 360) % 360;
      const endDeg = ((a.endAngle * 180) / Math.PI + 360) % 360;
      d.drawArc(a.cx, -a.cy, a.radius, startDeg, endDeg);
    }

    if (entity.type === "dimension") {
      const dim = entity as DimensionEntity;
      // Export sebagai LINE entities (extension lines + dim line)
      // Teks dimensi sebagai TEXT entity
      const geo = calcDimGeometry(dim);

      // Dim line
      d.drawLine(
        geo.dimLine.x1,
        -geo.dimLine.y1,
        geo.dimLine.x2,
        -geo.dimLine.y2,
      );
      // Extension line 1
      d.drawLine(geo.ext1.x1, -geo.ext1.y1, geo.ext1.x2, -geo.ext1.y2);
      // Extension line 2
      d.drawLine(geo.ext2.x1, -geo.ext2.y1, geo.ext2.x2, -geo.ext2.y2);
    }
  }

  // Generate DXF lalu inject unit header
  const raw = d.toDxfString();
  return injectUnitHeader(raw, unit);
}
