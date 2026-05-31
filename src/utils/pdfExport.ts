import {
  CADEntity,
  LineEntity,
  RectangleEntity,
  CircleEntity,
} from "../engine/entities";
import { Layer } from "../store/useCADStore";

interface ExportOptions {
  scale: number; // misal 0.01 = 1:100
  pageWidth: number; // mm, A3 = 420
  pageHeight: number; // mm, A3 = 297
  margin: number; // mm
  title: string;
}



/**
 * Buat PDF menggunakan canvas + jsPDF
 * Return blob URL untuk download
 */
export async function exportPDF(
  entities: CADEntity[],
  layers: Layer[],
  options: ExportOptions,
): Promise<string> {
  // Dynamic import agar tidak bloat bundle
  const { jsPDF } = await import("jspdf");

  const { scale, pageWidth, pageHeight, margin, title } = options;
  const orientation = pageWidth > pageHeight ? "landscape" : "portrait";

  const doc = new jsPDF({
    orientation,
    unit: "mm",
    format: [pageWidth, pageHeight],
  });

  // Area gambar dalam mm
  const drawW = pageWidth - margin * 2;
  const drawH = pageHeight - margin * 2;

  // Bounding box semua entity → auto fit
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const e of entities) {
    if (e.type === "line") {
      const l = e as LineEntity;
      minX = Math.min(minX, l.x1, l.x2);
      maxX = Math.max(maxX, l.x1, l.x2);
      minY = Math.min(minY, l.y1, l.y2);
      maxY = Math.max(maxY, l.y1, l.y2);
    }
    if (e.type === "circle") {
      const c = e as CircleEntity;
      minX = Math.min(minX, c.cx - c.radius);
      maxX = Math.max(maxX, c.cx + c.radius);
      minY = Math.min(minY, c.cy - c.radius);
      maxY = Math.max(maxY, c.cy + c.radius);
    }
    if (e.type === "rectangle") {
      const r = e as RectangleEntity;
      minX = Math.min(minX, r.x);
      maxX = Math.max(maxX, r.x + r.width);
      minY = Math.min(minY, r.y);
      maxY = Math.max(maxY, r.y + r.height);
    }
  }

  if (!isFinite(minX)) return ""; // tidak ada entity

  const contentW = (maxX - minX) * scale * 1000; // world unit → mm
  const contentH = (maxY - minY) * scale * 1000;

  const fitScaleX = drawW / contentW;
  const fitScaleY = drawH / contentH;
  const fitScale = Math.min(fitScaleX, fitScaleY, 1);

  // Transform: world → mm pada halaman
  const toMM = (wx: number, wy: number): [number, number] => {
    const x = margin + (wx - minX) * scale * 1000 * fitScale;
    const y = margin + (wy - minY) * scale * 1000 * fitScale;
    return [x, y];
  };

  // Background putih
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageWidth, pageHeight, "F");

  // Border drawing area
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.1);
  doc.rect(margin, margin, drawW, drawH);

  // Title block
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text(title, margin, margin - 2);
  doc.text(
    `Scale 1:${Math.round(1 / scale)}  |  ${new Date().toLocaleDateString("id-ID")}`,
    pageWidth - margin,
    margin - 2,
    { align: "right" },
  );

  // Render entities
  for (const entity of entities) {
    const layer = layers.find((l) => l.id === entity.layerId);
    if (layer && !layer.visible) continue;

    const hex = entity.color ?? layer?.color ?? "#ffffff";
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    // Gelap-kan warna terang agar terlihat di kertas putih
    const dr = Math.min(r, 180),
      dg = Math.min(g, 180),
      db = Math.min(b, 180);
    doc.setDrawColor(dr, dg, db);
    doc.setLineWidth(0.2);

    if (entity.type === "line") {
      const l = entity as LineEntity;
      const [x1, y1] = toMM(l.x1, l.y1);
      const [x2, y2] = toMM(l.x2, l.y2);
      doc.line(x1, y1, x2, y2);
    }

    if (entity.type === "rectangle") {
      const rect = entity as RectangleEntity;
      const [rx, ry] = toMM(rect.x, rect.y);
      doc.rect(
        rx,
        ry,
        rect.width * scale * 1000 * fitScale,
        rect.height * scale * 1000 * fitScale,
      );
    }

    if (entity.type === "circle") {
      const c = entity as CircleEntity;
      const [cx, cy] = toMM(c.cx, c.cy);
      doc.circle(cx, cy, c.radius * scale * 1000 * fitScale);
    }
  }

  return doc.output("bloburl") as unknown as string;
}
