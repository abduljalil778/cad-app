import { useState, useCallback } from "react";
import { useCADStore } from "../store/useCADStore";
import { CADEntity, LineEntity } from "../engine/entities";
import { SnapPoint } from "../engine/snap";

let idCounter = 0;
const genId = (t: string) => `${t}_off_${Date.now()}_${idCounter++}`;

export type OffsetStep = "select" | "distance" | "side";

export function useOffsetTool() {
  const { entities, addEntity, setSelectedIds } = useCADStore();
  const [step, setStep] = useState<OffsetStep>("select");
  const [distance, setDistance] = useState<number>(0.5);
  const [sourceId, setSourceId] = useState<string | null>(null);

  const onMouseClick = useCallback(
    (_snap: SnapPoint | null, wx: number, wy: number) => {
      if (step === "select") {
        // Cari entity terdekat
        const threshold = 0.2;
        const hit = [...entities].reverse().find((e) => {
          if (e.type === "line") {
            const l = e as LineEntity;
            const dx = l.x2 - l.x1,
              dy = l.y2 - l.y1;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len === 0) return false;
            const t = Math.max(
              0,
              Math.min(1, ((wx - l.x1) * dx + (wy - l.y1) * dy) / (len * len)),
            );
            return (
              Math.sqrt((l.x1 + t * dx - wx) ** 2 + (l.y1 + t * dy - wy) ** 2) <
              threshold
            );
          }
          return false;
        });
        if (hit) {
          setSourceId(hit.id);
          setSelectedIds([hit.id]);
          setStep("side");
        }
        return;
      }

      if (step === "side" && sourceId) {
        const source = entities.find((e) => e.id === sourceId);
        if (!source) return;

        let newEntity: CADEntity | null = null;

        if (source.type === "line") {
          const l = source as LineEntity;
          // Hitung normal ke garis
          const dx = l.x2 - l.x1,
            dy = l.y2 - l.y1;
          const len = Math.sqrt(dx * dx + dy * dy);
          const nx = -dy / len,
            ny = dx / len;

          // Tentukan arah offset berdasarkan posisi klik
          const side = (wx - l.x1) * nx + (wy - l.y1) * ny > 0 ? 1 : -1;

          newEntity = {
            id: genId("line"),
            type: "line",
            layerId: l.layerId,
            color: l.color,
            x1: l.x1 + nx * distance * side,
            y1: l.y1 + ny * distance * side,
            x2: l.x2 + nx * distance * side,
            y2: l.y2 + ny * distance * side,
          } as LineEntity;
        }

        if (newEntity) {
          addEntity(newEntity);
          setSelectedIds([]);
          setStep("select");
          setSourceId(null);
          useCADStore.getState().setActiveTool('select');
        }
      }
    },
    [step, sourceId, entities, distance, addEntity, setSelectedIds],
  );

  const setOffsetDistance = useCallback((d: number) => {
    setDistance(d);
    setStep("side");
  }, []);

  const cancel = useCallback(() => {
    setStep("select");
    setSourceId(null);
    setSelectedIds([]);
  }, [setSelectedIds]);

  return { step, distance, sourceId, onMouseClick, setOffsetDistance, cancel };
}
