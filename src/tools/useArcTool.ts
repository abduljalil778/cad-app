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
  const [cursorPoint, setCursorPoint] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [radiusValue, setRadiusValue] = useState<string>("");
  const [targetRadius, setTargetRadius] = useState<number | null>(null);

  const activeLayer = layers.find((l) => l.id === activeLayerId);
  const layerColor = activeLayer?.color ?? "#ffffff";

  const normalizeAngle = useCallback((angle: number) => {
    let value = angle % (Math.PI * 2);
    if (value < 0) value += Math.PI * 2;
    return value;
  }, []);

  const isAngleBetweenCCW = useCallback(
    (start: number, end: number, angle: number) => {
      const aStart = normalizeAngle(start);
      let aEnd = normalizeAngle(end);
      let aAngle = normalizeAngle(angle);
      if (aEnd < aStart) aEnd += Math.PI * 2;
      if (aAngle < aStart) aAngle += Math.PI * 2;
      return aAngle > aStart && aAngle < aEnd;
    },
    [normalizeAngle],
  );

  const circleCentersFromTwoPoints = useCallback(
    (
      a: { x: number; y: number },
      b: { x: number; y: number },
      radius: number,
    ) => {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < 1e-12) return null;
      const d = Math.sqrt(d2);
      if (d > 2 * radius + 1e-9) return null;
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const h = Math.sqrt(Math.max(0, radius * radius - (d / 2) ** 2));
      const ux = -dy / d;
      const uy = dx / d;
      return [
        { x: mx + ux * h, y: my + uy * h },
        { x: mx - ux * h, y: my - uy * h },
      ];
    },
    [],
  );

  const projectToCircle = useCallback(
    (
      center: { x: number; y: number },
      pt: { x: number; y: number },
      radius: number,
    ) => {
      const angle = Math.atan2(pt.y - center.y, pt.x - center.x);
      return {
        x: center.x + radius * Math.cos(angle),
        y: center.y + radius * Math.sin(angle),
        angle,
      };
    },
    [],
  );

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

  const buildRadiusConstrainedPreview = useCallback(
    (
      start: { x: number; y: number },
      mid: { x: number; y: number },
      point: { x: number; y: number },
      radius: number,
    ): PreviewArc | null => {
      const centers = circleCentersFromTwoPoints(start, mid, radius);
      if (!centers) return null;

      type Candidate = {
        center: { x: number; y: number };
        startAngle: number;
        endAngle: number;
        matches: boolean;
        distance: number;
      };

      const candidates: Candidate[] = centers.map((center) => {
        const projection = projectToCircle(center, point, radius);
        const startAngle = Math.atan2(start.y - center.y, start.x - center.x);
        const midAngle = Math.atan2(mid.y - center.y, mid.x - center.x);
        const endAngle = projection.angle;
        const matches = isAngleBetweenCCW(startAngle, endAngle, midAngle);
        const distance = Math.hypot(
          projection.x - point.x,
          projection.y - point.y,
        );
        return { center, startAngle, endAngle, matches, distance };
      });

      const matched = candidates.filter((candidate) => candidate.matches);
      const chosen = matched.length > 0 ? matched[0] : candidates[0];
      return {
        cx: chosen.center.x,
        cy: chosen.center.y,
        radius,
        startAngle: chosen.startAngle,
        endAngle: chosen.endAngle,
      };
    },
    [circleCentersFromTwoPoints, isAngleBetweenCCW, projectToCircle],
  );

  const onMouseMove = useCallback(
    (snap: SnapPoint | null, wx: number, wy: number) => {
      const pt = snap ?? { x: wx, y: wy };
      if (step === "mid" && p1) {
        setPreview({ cx: 0, cy: 0, radius: 0, startAngle: 0, endAngle: 0 });
      }
      if (step === "end" && p1 && p2) {
        setCursorPoint(pt);
        const prev =
          targetRadius != null
            ? buildRadiusConstrainedPreview(p1, p2, pt, targetRadius)
            : buildPreview(p1, p2, pt);
        setPreview(prev);
      }
    },
    [step, p1, p2, targetRadius, buildPreview, buildRadiusConstrainedPreview],
  );

  const cancel = useCallback(() => {
    setStep("start");
    setP1(null);
    setP2(null);
    setPreview(null);
    setCursorPoint(null);
    setRadiusValue("");
    setTargetRadius(null);
  }, []);

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
        let circle = circleFrom3Points(p1, p2, pt);
        let startAngle: number;
        let endAngle: number;
        let radius = circle?.radius ?? 0;
        let cx = circle?.cx ?? 0;
        let cy = circle?.cy ?? 0;

        if (targetRadius != null) {
          const previewArc = buildRadiusConstrainedPreview(
            p1,
            p2,
            pt,
            targetRadius,
          );
          if (!previewArc) {
            cancel();
            return;
          }
          radius = previewArc.radius;
          cx = previewArc.cx;
          cy = previewArc.cy;
          startAngle = previewArc.startAngle;
          endAngle = previewArc.endAngle;
        } else if (circle) {
          startAngle = Math.atan2(p1.y - circle.cy, p1.x - circle.cx);
          endAngle = Math.atan2(pt.y - circle.cy, pt.x - circle.cx);
        } else {
          cancel();
          return;
        }

        const entity: ArcEntity = {
          id: genId(),
          type: "arc",
          layerId: activeLayerId,
          color: layerColor,
          cx,
          cy,
          radius,
          startAngle,
          endAngle,
        };
        addEntity(entity);
        cancel();
        useCADStore.getState().setActiveTool("select");
      }
    },
    [
      step,
      p1,
      p2,
      targetRadius,
      activeLayerId,
      layerColor,
      addEntity,
      cancel,
      buildRadiusConstrainedPreview,
    ],
  );

  const onRadiusChange = useCallback(
    (value: string) => {
      setRadiusValue(value);
      const parsed = Number(value);
      const nextRadius = !Number.isNaN(parsed) && parsed > 0 ? parsed : null;
      setTargetRadius(nextRadius);
      if (step === "end" && p1 && p2 && cursorPoint) {
        setPreview(
          nextRadius != null
            ? buildRadiusConstrainedPreview(p1, p2, cursorPoint, nextRadius)
            : buildPreview(p1, p2, cursorPoint),
        );
      }
    },
    [step, p1, p2, cursorPoint, buildPreview, buildRadiusConstrainedPreview],
  );

  return {
    step,
    p1,
    p2,
    preview,
    radiusValue,
    setRadiusValue: onRadiusChange,
    targetRadius,
    onMouseMove,
    onMouseClick,
    cancel,
  };
}
