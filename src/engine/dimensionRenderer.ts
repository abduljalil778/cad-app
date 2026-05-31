import { DimensionEntity } from "./entities";

export interface DimGeometry {
  // Garis dimensi (garis utama dengan arrow)
  dimLine: { x1: number; y1: number; x2: number; y2: number };
  // Extension lines (garis bantu dari objek ke garis dimensi)
  ext1: { x1: number; y1: number; x2: number; y2: number };
  ext2: { x1: number; y1: number; x2: number; y2: number };
  // Posisi teks
  textX: number;
  textY: number;
  textAngle: number; // derajat, 0 = horizontal
  textValue: string;
  // Posisi arrow heads
  arrow1: { x: number; y: number; angle: number };
  arrow2: { x: number; y: number; angle: number };
}

const EXT_OFFSET = 0.05; // gap antara objek dan extension line
const EXT_OVERSHOOT = 0.1; // extension line lewat garis dimensi

export function calcDimGeometry(dim: DimensionEntity): DimGeometry {
  const { x1, y1, x2, y2, dx, dy, dimType } = dim;

  if (dimType === "linear") {
    // Tentukan apakah horizontal atau vertikal berdasarkan dx/dy
    const isHorizontal = Math.abs(dy) > Math.abs(dx);

    if (isHorizontal) {
      // Dimensi horizontal — garis dimensi sejajar sumbu X
      const dimY = y1 + dy;
      const length = Math.abs(x2 - x1);
      const minX = Math.min(x1, x2);
      const maxX = Math.max(x1, x2);

      return {
        dimLine: { x1: minX, y1: dimY, x2: maxX, y2: dimY },
        ext1: {
          x1: x1,
          y1: y1 + (dy > 0 ? EXT_OFFSET : -EXT_OFFSET),
          x2: x1,
          y2: dimY + (dy > 0 ? EXT_OVERSHOOT : -EXT_OVERSHOOT),
        },
        ext2: {
          x1: x2,
          y1: y2 + (dy > 0 ? EXT_OFFSET : -EXT_OFFSET),
          x2: x2,
          y2: dimY + (dy > 0 ? EXT_OVERSHOOT : -EXT_OVERSHOOT),
        },
        textX: (minX + maxX) / 2,
        textY: dimY - (dy > 0 ? 0.15 : -0.15),
        textAngle: 0,
        textValue: dim.text ?? length.toFixed(2),
        arrow1: { x: minX, y: dimY, angle: 180 },
        arrow2: { x: maxX, y: dimY, angle: 0 },
      };
    } else {
      // Dimensi vertikal — garis dimensi sejajar sumbu Y
      const dimX = x1 + dx;
      const length = Math.abs(y2 - y1);
      const minY = Math.min(y1, y2);
      const maxY = Math.max(y1, y2);

      return {
        dimLine: { x1: dimX, y1: minY, x2: dimX, y2: maxY },
        ext1: {
          x1: x1 + (dx > 0 ? EXT_OFFSET : -EXT_OFFSET),
          y1: y1,
          x2: dimX + (dx > 0 ? EXT_OVERSHOOT : -EXT_OVERSHOOT),
          y2: y1,
        },
        ext2: {
          x1: x2 + (dx > 0 ? EXT_OFFSET : -EXT_OFFSET),
          y1: y2,
          x2: dimX + (dx > 0 ? EXT_OVERSHOOT : -EXT_OVERSHOOT),
          y2: y2,
        },
        textX: dimX - (dx > 0 ? 0.15 : -0.15),
        textY: (minY + maxY) / 2,
        textAngle: -90,
        textValue: dim.text ?? length.toFixed(2),
        arrow1: { x: dimX, y: minY, angle: 270 },
        arrow2: { x: dimX, y: maxY, angle: 90 },
      };
    }
  }

  // ALIGNED — garis dimensi sejajar dengan garis antara dua titik
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const length = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  const perpAngle = angle + Math.PI / 2;
  const offset =
    Math.sqrt(dx * dx + dy * dy) *
    Math.sign(dx * Math.cos(perpAngle) + dy * Math.sin(perpAngle));

  const d1x = x1 + offset * Math.cos(perpAngle);
  const d1y = y1 + offset * Math.sin(perpAngle);
  const d2x = x2 + offset * Math.cos(perpAngle);
  const d2y = y2 + offset * Math.sin(perpAngle);

  const midX = (d1x + d2x) / 2;
  const midY = (d1y + d2y) / 2;

  return {
    dimLine: { x1: d1x, y1: d1y, x2: d2x, y2: d2y },
    ext1: {
      x1: x1 + EXT_OFFSET * Math.cos(perpAngle),
      y1: y1 + EXT_OFFSET * Math.sin(perpAngle),
      x2: d1x + EXT_OVERSHOOT * Math.cos(perpAngle),
      y2: d1y + EXT_OVERSHOOT * Math.sin(perpAngle),
    },
    ext2: {
      x1: x2 + EXT_OFFSET * Math.cos(perpAngle),
      y1: y2 + EXT_OFFSET * Math.sin(perpAngle),
      x2: d2x + EXT_OVERSHOOT * Math.cos(perpAngle),
      y2: d2y + EXT_OVERSHOOT * Math.sin(perpAngle),
    },
    textX: midX - 0.15 * Math.sin(angle),
    textY: midY + 0.15 * Math.cos(angle),
    textAngle: (angle * 180) / Math.PI,
    textValue: dim.text ?? length.toFixed(2),
    arrow1: { x: d1x, y: d1y, angle: (angle * 180) / Math.PI + 180 },
    arrow2: { x: d2x, y: d2y, angle: (angle * 180) / Math.PI },
  };
}
