import { useState, useCallback } from "react";
import { useCADStore } from "../store/useCADStore";
import { ArcEntity } from "../engine/entities";
import { SnapPoint } from "../engine/snap";

let idCounter = 0;
const genId = () => `arc_${Date.now()}_${idCounter++}`;

export type ArcStep = "start" | "mid" | "end";

export interface PreviewArc {
  cx: number;
  cy: number;
  radius: number;
  startAngle: number;
  endAngle: number;
}

/**
 * Hitung lingkaran yang melalui 3 titik
 */
function circleFrom3Points(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
): { cx: number; cy: number; radius: number } | null {
  const ax = p1.x,
    ay = p1.y;
  const bx = p2.x,
    by = p2.y;
  const cx = p3.x,
    cy = p3.y;

  const D = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  if (Math.abs(D) < 1e-10) return null; // titik collinear

  const ux =
    ((ax * ax + ay * ay) * (by - cy) +
      (bx * bx + by * by) * (cy - ay) +
      (cx * cx + cy * cy) * (ay - by)) /
    D;
  const uy =
    ((ax * ax + ay * ay) * (cx - bx) +
      (bx * bx + by * by) * (ax - cx) +
      (cx * cx + cy * cy) * (bx - ax)) /
    D;

  const radius = Math.sqrt((ax - ux) ** 2 + (ay - uy) ** 2);
  return { cx: ux, cy: uy, radius };
}

export function useArcTool() {
  const { addEntity, activeLayerId, layers } = useCADStore();
  const [step, setStep] = useState<ArcStep>("start");
  const [p1, setP1] = useState<{ x: number; y: number } | null>(null);
  const [p2, setP2] = useState<{ x: number; y: number } | null>(null);
  const [preview, setPreview] = useState<PreviewArc | null>(null);

  const activeLayer = layers.find((l) => l.id === activeLayerId);
  const layerColor = activeLayer?.color ?? "#ffffff";

  const buildPreview = useCallback(
    (
      start: { x: number; y: number },
      mid: { x: number; y: number },
      end: { x: number; y: number },
    ): PreviewArc | null => {
      const circle = circleFrom3Points(start, mid, end);
      if (!circle) return null;
      const startAngle = Math.atan2(start.y - circle.cy, start.x - circle.cx);
      const endAngle = Math.atan2(end.y - circle.cy, end.x - circle.cx);
      return { ...circle, startAngle, endAngle };
    },
    [],
  );

  const onMouseMove = useCallback(
    (snap: SnapPoint | null, wx: number, wy: number) => {
      const pt = snap ?? { x: wx, y: wy };
      if (step === "mid" && p1) {
        // preview garis dari p1 ke cursor
        setPreview({ cx: 0, cy: 0, radius: 0, startAngle: 0, endAngle: 0 });
      }
      if (step === "end" && p1 && p2) {
        const prev = buildPreview(p1, p2, pt);
        setPreview(prev);
      }
    },
    [step, p1, p2, buildPreview],
  );

  const onMouseClick = useCallback(
    (snap: SnapPoint | null, wx: number, wy: number) => {
      const pt = snap ?? { x: wx, y: wy };

      if (step === "start") {
        setP1(pt);
        setStep("mid");
      } else if (step === "mid") {
        setP2(pt);
        setStep("end");
      } else if (step === "end" && p1 && p2) {
        const circle = circleFrom3Points(p1, p2, pt);
        if (!circle) {
          cancel();
          return;
        }

        const startAngle = Math.atan2(p1.y - circle.cy, p1.x - circle.cx);
        const endAngle = Math.atan2(pt.y - circle.cy, pt.x - circle.cx);

        const entity: ArcEntity = {
          id: genId(),
          type: "arc",
          layerId: activeLayerId,
          color: layerColor,
          cx: circle.cx,
          cy: circle.cy,
          radius: circle.radius,
          startAngle,
          endAngle,
        };
        addEntity(entity);
        cancel();
      }
    },
    [step, p1, p2, activeLayerId, layerColor, addEntity],
  );

  const cancel = useCallback(() => {
    setStep("start");
    setP1(null);
    setP2(null);
    setPreview(null);
  }, []);

  return { step, p1, p2, preview, onMouseMove, onMouseClick, cancel };
}
