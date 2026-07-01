import { useState, useCallback } from "react";
import { useCADStore } from "../store/useCADStore";
import { DimensionEntity } from "../engine/entities";
import { SnapPoint, getNearestPointOnEntities } from "../engine/snap";

let idCounter = 0;
const genId = () => `dim_${Date.now()}_${idCounter++}`;

export type DimStep = "p1" | "p2" | "offset";
export type DimMode = "linear" | "aligned";

export function useDimensionTool(mode: DimMode = "linear") {
  const { addEntity, activeLayerId, entities } = useCADStore();
  const [step, setStep] = useState<DimStep>("p1");
  const [p1, setP1] = useState<{ x: number; y: number } | null>(null);
  const [p2, setP2] = useState<{ x: number; y: number } | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);

  const onMouseMove = useCallback(
    (snap: SnapPoint | null, wx: number, wy: number) => {
      setCursor(snap ?? { x: wx, y: wy });
    },
    [],
  );

  const onMouseClick = useCallback(
    (snap: SnapPoint | null, wx: number, wy: number) => {
      // If no precise snap (endpoint, midpoint, etc.), allow picking
      // the nearest point on any entity so the user can click anywhere.
      const picked = snap ?? getNearestPointOnEntities(wx, wy, entities);
      const pt = picked ?? { x: wx, y: wy };

      if (step === "p1") {
        setP1(pt);
        setStep("p2");
      } else if (step === "p2") {
        setP2(pt);
        setStep("offset");
      } else if (step === "offset" && p1 && p2) {
        const entity: DimensionEntity = {
          id: genId(),
          type: "dimension",
          layerId: activeLayerId,
          color: "#00ffff",
          dimType: mode,
          x1: p1.x,
          y1: p1.y,
          x2: p2.x,
          y2: p2.y,
          dx: pt.x - p1.x,
          dy: pt.y - p1.y,
        };
        addEntity(entity);
        setP1(null);
        setP2(null);
        setStep("p1");
        useCADStore.getState().setActiveTool("select");
      }
    },
    [step, p1, p2, mode, activeLayerId, addEntity],
  );

  const cancel = useCallback(() => {
    setStep("p1");
    setP1(null);
    setP2(null);
    setCursor(null);
  }, []);

  return { step, p1, p2, cursor, onMouseMove, onMouseClick, cancel };
}
