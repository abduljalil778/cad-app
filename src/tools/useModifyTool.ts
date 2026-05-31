import { useState, useCallback, useEffect, useRef } from "react";
import { useCADStore, ActiveTool } from "../store/useCADStore";
import { CADEntity } from "../engine/entities";
import { SnapPoint } from "../engine/snap";
import {
  translateEntity,
  rotateEntity,
  mirrorEntity,
  scaleEntity,
  cloneEntity,
} from "../engine/transform";

export type ModifyMode = "move" | "copy" | "rotate" | "mirror" | "scale";
export type ModifyStep =
  | "selecting"     // user is picking entities
  | "basePoint"     // waiting for base/center/mirror-p1 point
  | "action"        // waiting for destination/angle/mirror-p2
  | "scaleInput"    // waiting for scale factor keyboard input
  | "confirmDelete"; // mirror: "Delete source objects? Y/N"

const MODIFY_TOOLS: ActiveTool[] = ["move", "copy", "rotate", "mirror", "scale"];

function toolToMode(tool: ActiveTool): ModifyMode | null {
  if (MODIFY_TOOLS.includes(tool)) return tool as ModifyMode;
  return null;
}

export function useModifyTool() {
  const {
    activeTool,
    entities,
    selectedIds,
    setSelectedIds,
    setEntities,
    addEntity,
    deleteEntities,
    pushLog,
  } = useCADStore();

  const [step, setStep] = useState<ModifyStep>("selecting");
  const [basePoint, setBasePoint] = useState<{ x: number; y: number } | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [previewEntities, setPreviewEntities] = useState<CADEntity[]>([]);
  const [mirrorP2, setMirrorP2] = useState<{ x: number; y: number } | null>(null);
  const [scaleFactorInput, setScaleFactorInput] = useState("");

  // Track which entities were selected when entering the tool
  const workingIds = useRef<string[]>([]);
  const prevTool = useRef<ActiveTool>(activeTool);

  const mode = toolToMode(activeTool);

  // Reset when tool changes
  useEffect(() => {
    if (prevTool.current !== activeTool) {
      prevTool.current = activeTool;
      setBasePoint(null);
      setCursor(null);
      setPreviewEntities([]);
      setMirrorP2(null);
      setScaleFactorInput("");
      workingIds.current = [];

      if (mode) {
        // If entities already selected, skip to basePoint step
        if (selectedIds.length > 0) {
          workingIds.current = [...selectedIds];
          setStep("basePoint");
          pushLog(`${activeTool.toUpperCase()}: ${selectedIds.length} objects selected. Pick base point.`);
        } else {
          setStep("selecting");
          pushLog(`${activeTool.toUpperCase()}: Select objects, then press Enter.`);
        }
      } else {
        setStep("selecting");
      }
    }
  }, [activeTool, mode, selectedIds, pushLog]);

  /** Get the selected entities for transformation */
  const getWorkingEntities = useCallback((): CADEntity[] => {
    const idSet = new Set(workingIds.current);
    return entities.filter(e => idSet.has(e.id));
  }, [entities]);

  /** Compute preview entities based on current cursor position */
  const computePreview = useCallback(
    (wx: number, wy: number) => {
      if (!basePoint || !mode) return [];
      const working = getWorkingEntities();
      if (working.length === 0) return [];

      switch (mode) {
        case "move":
        case "copy": {
          const dx = wx - basePoint.x;
          const dy = wy - basePoint.y;
          return working.map(e => translateEntity(e, dx, dy));
        }
        case "rotate": {
          const angle = Math.atan2(wy - basePoint.y, wx - basePoint.x);
          return working.map(e => rotateEntity(e, basePoint, angle));
        }
        case "mirror": {
          return working.map(e => mirrorEntity(e, basePoint, { x: wx, y: wy }));
        }
        default:
          return [];
      }
    },
    [basePoint, mode, getWorkingEntities],
  );

  const onMouseMove = useCallback(
    (_snap: SnapPoint | null, wx: number, wy: number) => {
      setCursor({ x: wx, y: wy });
      if (step === "action" && mode !== "scale") {
        setPreviewEntities(computePreview(wx, wy));
      }
    },
    [step, mode, computePreview],
  );

  const onMouseClick = useCallback(
    (snap: SnapPoint | null, wx: number, wy: number) => {
      const pt = snap ?? { x: wx, y: wy };

      if (!mode) return;

      // In selecting step, click does entity selection (handled by CADCanvas)
      if (step === "selecting") return;

      if (step === "basePoint") {
        setBasePoint(pt);
        if (mode === "scale") {
          setStep("scaleInput");
          pushLog("SCALE: Enter scale factor.");
        } else {
          setStep("action");
          const actionHint: Record<string, string> = {
            move: "Pick destination point.",
            copy: "Pick destination point (repeat, Enter/Escape to finish).",
            rotate: "Pick angle point (click to set rotation).",
            mirror: "Pick second point of mirror line.",
          };
          pushLog(`${mode.toUpperCase()}: ${actionHint[mode] ?? ""}`);
        }
        return;
      }

      if (step === "action") {
        const working = getWorkingEntities();
        if (working.length === 0) return;

        switch (mode) {
          case "move": {
            const dx = pt.x - basePoint!.x;
            const dy = pt.y - basePoint!.y;
            const newEntities = entities.map(e =>
              workingIds.current.includes(e.id) ? translateEntity(e, dx, dy) : e
            );
            setEntities(newEntities);
            pushLog(`MOVE: ${working.length} objects moved.`);
            // Reset tool
            setStep("selecting");
            setBasePoint(null);
            setPreviewEntities([]);
            workingIds.current = [];
            setSelectedIds([]);
            break;
          }
          case "copy": {
            const dx = pt.x - basePoint!.x;
            const dy = pt.y - basePoint!.y;
            const copies = working.map(e => {
              const translated = translateEntity(e, dx, dy);
              return cloneEntity(translated);
            });
            copies.forEach(c => addEntity(c));
            pushLog(`COPY: ${copies.length} objects copied. Click again or Escape to finish.`);
            // Stay in action step for multiple copies
            setPreviewEntities([]);
            break;
          }
          case "rotate": {
            const angle = Math.atan2(pt.y - basePoint!.y, pt.x - basePoint!.x);
            const newEntities = entities.map(e =>
              workingIds.current.includes(e.id) ? rotateEntity(e, basePoint!, angle) : e
            );
            setEntities(newEntities);
            const degrees = ((angle * 180) / Math.PI).toFixed(1);
            pushLog(`ROTATE: ${working.length} objects rotated by ${degrees}°.`);
            setStep("selecting");
            setBasePoint(null);
            setPreviewEntities([]);
            workingIds.current = [];
            setSelectedIds([]);
            break;
          }
          case "mirror": {
            setMirrorP2(pt);
            // Create mirrored copies
            const copies = working.map(e => {
              const mirrored = mirrorEntity(e, basePoint!, pt);
              return cloneEntity(mirrored);
            });
            copies.forEach(c => addEntity(c));
            setStep("confirmDelete");
            pushLog("MIRROR: Delete source objects? [Y/N]");
            setPreviewEntities([]);
            break;
          }
        }
      }
    },
    [step, mode, basePoint, entities, getWorkingEntities, setEntities, addEntity, pushLog, setSelectedIds],
  );

  /** Enter key: confirm selection, or finish copy mode */
  const confirmSelection = useCallback(() => {
    if (!mode) return;

    if (step === "selecting") {
      if (selectedIds.length === 0) {
        pushLog("No objects selected.");
        return;
      }
      workingIds.current = [...selectedIds];
      setStep("basePoint");
      pushLog(`${mode.toUpperCase()}: ${selectedIds.length} objects. Pick base point.`);
      return;
    }

    if (step === "action" && mode === "copy") {
      // Finish copy mode
      pushLog("COPY: Done.");
      setStep("selecting");
      setBasePoint(null);
      setPreviewEntities([]);
      workingIds.current = [];
      setSelectedIds([]);
    }
  }, [step, mode, selectedIds, pushLog, setSelectedIds]);

  /** Answer Y/N for mirror delete source */
  const answerDeleteSource = useCallback(
    (deleteSource: boolean) => {
      if (step !== "confirmDelete" || mode !== "mirror") return;
      if (deleteSource) {
        deleteEntities(workingIds.current);
        pushLog("MIRROR: Source objects deleted.");
      } else {
        pushLog("MIRROR: Source objects kept.");
      }
      setStep("selecting");
      setBasePoint(null);
      setMirrorP2(null);
      setPreviewEntities([]);
      workingIds.current = [];
      setSelectedIds([]);
    },
    [step, mode, deleteEntities, pushLog, setSelectedIds],
  );

  /** Apply scale factor from keyboard input */
  const applyScale = useCallback(
    (factor: number) => {
      if (step !== "scaleInput" || !basePoint || mode !== "scale") return;
      const working = getWorkingEntities();
      if (working.length === 0) return;

      const newEntities = entities.map(e =>
        workingIds.current.includes(e.id) ? scaleEntity(e, basePoint, factor) : e
      );
      setEntities(newEntities);
      pushLog(`SCALE: ${working.length} objects scaled by factor ${factor}.`);
      setStep("selecting");
      setBasePoint(null);
      setPreviewEntities([]);
      workingIds.current = [];
      setSelectedIds([]);
    },
    [step, mode, basePoint, entities, getWorkingEntities, setEntities, pushLog, setSelectedIds],
  );

  const cancel = useCallback(() => {
    setStep("selecting");
    setBasePoint(null);
    setCursor(null);
    setPreviewEntities([]);
    setMirrorP2(null);
    setScaleFactorInput("");
    workingIds.current = [];
  }, []);

  /** Get hint text for current step */
  const getHintText = useCallback((): string | null => {
    if (!mode) return null;
    switch (step) {
      case "selecting":
        return `${mode.toUpperCase()}: Select objects, then press Enter`;
      case "basePoint":
        if (mode === "mirror") return "MIRROR: Pick first point of mirror line";
        return `${mode.toUpperCase()}: Pick base point`;
      case "action":
        if (mode === "move") return "MOVE: Pick destination point";
        if (mode === "copy") return "COPY: Pick destination (Enter/Esc to finish)";
        if (mode === "rotate") return "ROTATE: Pick angle point";
        if (mode === "mirror") return "MIRROR: Pick second point of mirror line";
        return null;
      case "scaleInput":
        return "SCALE: Enter scale factor";
      case "confirmDelete":
        return "MIRROR: Delete source objects? (Y / N)";
      default:
        return null;
    }
  }, [mode, step]);

  const isActive = mode !== null;

  return {
    isActive,
    mode,
    step,
    basePoint,
    cursor,
    mirrorP2,
    previewEntities,
    scaleFactorInput,
    setScaleFactorInput,
    onMouseMove,
    onMouseClick,
    confirmSelection,
    answerDeleteSource,
    applyScale,
    cancel,
    getHintText,
  };
}
