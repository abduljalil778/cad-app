import { useState, useCallback } from "react";
import { useCADStore } from "../store/useCADStore";
import { TextEntity } from "../engine/entities";
import { SnapPoint } from "../engine/snap";

let idCounter = 0;
const genId = () => `text_${Date.now()}_${idCounter++}`;

export interface TextToolOptions {
  fontSize?: number;
  fontFamily?: string;
  bold?: boolean;
  italic?: boolean;
  alignment?: "left" | "center" | "right";
  lineHeight?: number;
}

export function useTextTool() {
  const { addEntity, activeLayerId, layers, pushLog } = useCADStore();
  const [insertPoint, setInsertPoint] = useState<{ x: number; y: number } | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);

  const activeLayer = layers.find((l) => l.id === activeLayerId);
  const layerColor = activeLayer?.color ?? "#ffffff";

  const onMouseMove = useCallback(
    (_snap: SnapPoint | null, wx: number, wy: number) => {
      setCursor({ x: wx, y: wy });
    },
    [],
  );

  const onMouseClick = useCallback(
    (snap: SnapPoint | null, wx: number, wy: number) => {
      const pt = snap ?? { x: wx, y: wy };
      setInsertPoint(pt);
    },
    [],
  );

  const commit = useCallback(
    (text: string, options?: TextToolOptions) => {
      if (!insertPoint || !text.trim()) {
        cancel();
        return;
      }

      const entity: TextEntity = {
        id: genId(),
        type: "text",
        layerId: activeLayerId,
        color: layerColor,
        x: insertPoint.x,
        y: insertPoint.y,
        text: text,
        fontSize: options?.fontSize ?? 0.3,
        fontFamily: options?.fontFamily ?? "Arial",
        rotation: 0,
        bold: options?.bold ?? false,
        italic: options?.italic ?? false,
        alignment: options?.alignment ?? "left",
        lineHeight: options?.lineHeight ?? 1.5,
      };
      addEntity(entity);
      pushLog(`TEXT placed at (${insertPoint.x.toFixed(2)}, ${(-insertPoint.y).toFixed(2)})`);
      setInsertPoint(null);
      useCADStore.getState().setActiveTool('select');
    },
    [insertPoint, activeLayerId, layerColor, addEntity, pushLog],
  );

  const cancel = useCallback(() => {
    setInsertPoint(null);
    setCursor(null);
  }, []);

  return { insertPoint, cursor, onMouseMove, onMouseClick, commit, cancel };
}
