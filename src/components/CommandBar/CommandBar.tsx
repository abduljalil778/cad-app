import { useState, useRef, useEffect } from "react";
import { useCADStore, ActiveTool } from "../../store/useCADStore";
import "./CommandBar.css";

const COMMANDS: Record<
  string,
  { tool?: ActiveTool; action?: string; desc: string }
> = {
  L: { tool: "line", desc: "LINE — draw lines" },
  LINE: { tool: "line", desc: "LINE — draw lines" },
  REC: { tool: "rectangle", desc: "RECTANGLE — draw rectangles" },
  RECT: { tool: "rectangle", desc: "RECTANGLE — draw rectangles" },
  C: { tool: "circle", desc: "CIRCLE — draw circles" },
  CIRCLE: { tool: "circle", desc: "CIRCLE — draw circles" },
  SEL: { tool: "select", desc: "SELECT — selection mode" },
  A: { tool: "arc", desc: "ARC — 3-point arc" },
  ARC: { tool: "arc", desc: "ARC — 3-point arc" },
  PL: { tool: "polyline", desc: "POLYLINE — draw connected lines" },
  PLINE: { tool: "polyline", desc: "POLYLINE — draw connected lines" },
  POLYLINE: { tool: "polyline", desc: "POLYLINE — draw connected lines" },
  EL: { tool: "ellipse", desc: "ELLIPSE — draw ellipses" },
  ELLIPSE: { tool: "ellipse", desc: "ELLIPSE — draw ellipses" },
  P: { tool: "pan", desc: "PAN — move view" },
  PAN: { tool: "pan", desc: "PAN — move view" },
  T: { tool: "text", desc: "TEXT — place text" },
  TEXT: { tool: "text", desc: "TEXT — place text" },
  DIM: { tool: "dimension", desc: "DIMENSION — linear dimension" },
  DIMLINEAR: { tool: "dimension", desc: "DIMENSION — linear dimension" },
  OFFSET: { tool: "offset", desc: "OFFSET — offset entity by distance" },
  O: { tool: "offset", desc: "OFFSET — offset entity by distance" },
  M: { tool: "move", desc: "MOVE — move entities" },
  MOVE: { tool: "move", desc: "MOVE — move entities" },
  CO: { tool: "copy", desc: "COPY — copy entities" },
  COPY: { tool: "copy", desc: "COPY — copy entities" },
  RO: { tool: "rotate", desc: "ROTATE — rotate entities" },
  ROTATE: { tool: "rotate", desc: "ROTATE — rotate entities" },
  MI: { tool: "mirror", desc: "MIRROR — mirror entities" },
  MIRROR: { tool: "mirror", desc: "MIRROR — mirror entities" },
  SC: { tool: "scale", desc: "SCALE — scale entities" },
  SCALE: { tool: "scale", desc: "SCALE — scale entities" },
  TR: { tool: "trim", desc: "TRIM — trim entities" },
  TRIM: { tool: "trim", desc: "TRIM — trim entities" },
  EX: { tool: "extend", desc: "EXTEND — extend entities" },
  EXTEND: { tool: "extend", desc: "EXTEND — extend entities" },
  F: { tool: "fillet", desc: "FILLET — fillet corners" },
  FILLET: { tool: "fillet", desc: "FILLET — fillet corners" },
  DIST: { tool: "measure_dist", desc: "DISTANCE — measure distance" },
  DISTANCE: { tool: "measure_dist", desc: "DISTANCE — measure distance" },
  ANG: { tool: "measure_angle", desc: "ANGLE — measure angle" },
  ANGLE: { tool: "measure_angle", desc: "ANGLE — measure angle" },
  AREA: { tool: "measure_area", desc: "AREA — measure area & perimeter" },
  ESC: { action: "cancel", desc: "Cancel current command" },
  GRID: { action: "grid", desc: "Toggle grid on/off" },
  SNAP: { action: "snap", desc: "Toggle snap on/off" },
  ORTHO: { action: "ortho", desc: "Toggle ortho mode on/off" },
  UNDO: { action: "undo", desc: "Undo last action" },
  REDO: { action: "redo", desc: "Redo last undone action" },
  CLEAR: { action: "clear", desc: "Clear all entities" },
  ZOOM: { action: "zoom1", desc: "Reset zoom to 1:1" },
  "?": { action: "help", desc: "Show all commands" },
  HELP: { action: "help", desc: "Show all commands" },
  UNIT: { action: "unit", desc: "Toggle unit: m ↔ mm" },
  UNITS: { action: "unit", desc: "Toggle unit: m ↔ mm" },
  "ZOOM E": { action: "zoome", desc: "Zoom extents — fit all entities" },
  ZE: { action: "zoome", desc: "Zoom extents — fit all entities" },
  DEL: { action: "delete", desc: "Delete selected entities" },
  DELETE: { action: "delete", desc: "Delete selected entities" },
  ERASE: { action: "delete", desc: "Delete selected entities" },
  B: { tool: "block", desc: "BLOCK — create block from selection" },
  BLOCK: { tool: "block", desc: "BLOCK — create block from selection" },
  I: { tool: "insert", desc: "INSERT — insert block reference" },
  INSERT: { tool: "insert", desc: "INSERT — insert block reference" },
  X: { action: "explode", desc: "EXPLODE — explode block to entities" },
  EXPLODE: { action: "explode", desc: "EXPLODE — explode block to entities" },
  BEDIT: { action: "bedit", desc: "BEDIT — edit selected block definition" },
  BCLOSE: { action: "bclose", desc: "BCLOSE — close block editor (save)" },
};

export default function CommandBar() {
  const [input, setInput] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const {
    setActiveTool,
    toggleGrid,
    toggleSnap,
    orthoMode,
    toggleOrtho,
    undo,
    redo,
    clearEntities,
    setZoom,
    commandLog,
    pushLog,
    deleteEntities,
    selectedIds,
  } = useCADStore();

  // Auto scroll log
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [commandLog]);

  // Only show last 3 command log entries in the compact command bar
  const visibleLog = commandLog.slice(-3);

  const handleInput = (val: string) => {
    setInput(val);
    setHistoryIndex(-1);
    const upper = val.toUpperCase();
    if (!upper) {
      setSuggestion("");
      return;
    }
    const match = Object.keys(COMMANDS).find(
      (k) => k.startsWith(upper) && k !== upper,
    );
    setSuggestion(match ? COMMANDS[match].desc : "");
  };

  const execute = (raw: string) => {
    const cmd = raw.trim().toUpperCase();
    if (!cmd) return;
    setInput("");
    setSuggestion("");
    setCmdHistory((prev) => [cmd, ...prev].slice(0, 50));
    setHistoryIndex(-1);

    const entry = COMMANDS[cmd];
    if (!entry) {
      pushLog(`Unknown command: ${cmd}. Type ? for help.`);
      return;
    }

    if (entry.tool) {
      setActiveTool(entry.tool);
      pushLog(`Command: ${entry.desc}`);
      return;
    }

    switch (entry.action) {
      case "cancel":
        setActiveTool("select");
        pushLog("Cancelled.");
        break;
      case "grid":
        toggleGrid();
        pushLog("Grid toggled.");
        break;
      case "snap":
        toggleSnap();
        pushLog("Snap toggled.");
        break;
      case "ortho":
        toggleOrtho();
        pushLog(`Ortho ${orthoMode ? "OFF" : "ON"}.`);
        break;
      case "undo":
        undo();
        pushLog("Undo.");
        break;
      case "redo":
        redo();
        pushLog("Redo.");
        break;
      case "zoom1":
        setZoom(1);
        pushLog("Zoom reset to 1:1");
        break;
      case "clear":
        clearEntities();
        pushLog("All entities cleared.");
        break;
      case "delete":
        if (selectedIds.length === 0) {
          pushLog("No entities selected.");
        } else {
          deleteEntities(selectedIds);
          pushLog(`Deleted ${selectedIds.length} entity(s).`);
        }
        break;
      case "help":
        pushLog("Commands: " + Object.keys(COMMANDS).join("  "));
        break;
      case "unit": {
        const { drawingUnit, setDrawingUnit } = useCADStore.getState();
        const next = drawingUnit === "m" ? "mm" : "m";
        setDrawingUnit(next);
        pushLog(`Unit set to ${next}. 1 grid = 1 ${next}`);
        break;
      }
      case "zoome": {
        // Zoom extents — fit all entities to viewport
        const { entities } = useCADStore.getState();
        if (entities.length === 0) {
          pushLog("No entities.");
          break;
        }
        let minX = Infinity,
          minY = Infinity,
          maxX = -Infinity,
          maxY = -Infinity;
        for (const e of entities) {
          if (e.type === "line") {
            const l = e as any;
            minX = Math.min(minX, l.x1, l.x2);
            maxX = Math.max(maxX, l.x1, l.x2);
            minY = Math.min(minY, l.y1, l.y2);
            maxY = Math.max(maxY, l.y1, l.y2);
          }
          if (e.type === "circle") {
            const c = e as any;
            minX = Math.min(minX, c.cx - c.radius);
            maxX = Math.max(maxX, c.cx + c.radius);
            minY = Math.min(minY, c.cy - c.radius);
            maxY = Math.max(maxY, c.cy + c.radius);
          }
          if (e.type === "rectangle") {
            const r = e as any;
            minX = Math.min(minX, r.x);
            maxX = Math.max(maxX, r.x + r.width);
            minY = Math.min(minY, r.y);
            maxY = Math.max(maxY, r.y + r.height);
          }
          if (e.type === "arc") {
            const a = e as any;
            minX = Math.min(minX, a.cx - a.radius);
            maxX = Math.max(maxX, a.cx + a.radius);
            minY = Math.min(minY, a.cy - a.radius);
            maxY = Math.max(maxY, a.cy + a.radius);
          }
          if (e.type === "ellipse") {
            const el = e as any;
            minX = Math.min(minX, el.cx - el.rx);
            maxX = Math.max(maxX, el.cx + el.rx);
            minY = Math.min(minY, el.cy - el.ry);
            maxY = Math.max(maxY, el.cy + el.ry);
          }
          if (e.type === "polyline") {
            const p = e as any;
            for (const pt of p.points) {
              minX = Math.min(minX, pt.x);
              maxX = Math.max(maxX, pt.x);
              minY = Math.min(minY, pt.y);
              maxY = Math.max(maxY, pt.y);
            }
          }
          if (e.type === "text") {
            const t = e as any;
            minX = Math.min(minX, t.x);
            maxX = Math.max(maxX, t.x);
            minY = Math.min(minY, t.y);
            maxY = Math.max(maxY, t.y);
          }
          if (e.type === "dimension") {
            const d = e as any;
            minX = Math.min(minX, d.x1, d.x2);
            maxX = Math.max(maxX, d.x1, d.x2);
            minY = Math.min(minY, d.y1, d.y2);
            maxY = Math.max(maxY, d.y1, d.y2);
          }
          if (e.type === "block_ref") {
            const br = e as any;
            // Use insertion point as minimum bounds
            minX = Math.min(minX, br.insertX);
            maxX = Math.max(maxX, br.insertX);
            minY = Math.min(minY, br.insertY);
            maxY = Math.max(maxY, br.insertY);
            // Try to use block definition for better bounds
            const { blockDefinitions } = useCADStore.getState();
            const bDef = blockDefinitions.find((d: any) => d.id === br.blockDefId);
            if (bDef) {
              for (const be of bDef.entities) {
                if (be.type === "line") {
                  const bl = be as any;
                  const pts = [
                    { x: bl.x1 - bDef.basePoint.x, y: bl.y1 - bDef.basePoint.y },
                    { x: bl.x2 - bDef.basePoint.x, y: bl.y2 - bDef.basePoint.y },
                  ];
                  for (const p of pts) {
                    minX = Math.min(minX, br.insertX + p.x * (br.scaleX ?? 1));
                    maxX = Math.max(maxX, br.insertX + p.x * (br.scaleX ?? 1));
                    minY = Math.min(minY, br.insertY + p.y * (br.scaleX ?? 1));
                    maxY = Math.max(maxY, br.insertY + p.y * (br.scaleX ?? 1));
                  }
                } else if (be.type === "circle") {
                  const bc = be as any;
                  const cx = br.insertX + (bc.cx - bDef.basePoint.x) * (br.scaleX ?? 1);
                  const cy = br.insertY + (bc.cy - bDef.basePoint.y) * (br.scaleX ?? 1);
                  const r = bc.radius * Math.abs(br.scaleX ?? 1);
                  minX = Math.min(minX, cx - r);
                  maxX = Math.max(maxX, cx + r);
                  minY = Math.min(minY, cy - r);
                  maxY = Math.max(maxY, cy + r);
                } else if (be.type === "rectangle") {
                  const br2 = be as any;
                  const rx = br.insertX + (br2.x - bDef.basePoint.x) * (br.scaleX ?? 1);
                  const ry = br.insertY + (br2.y - bDef.basePoint.y) * (br.scaleX ?? 1);
                  minX = Math.min(minX, rx, rx + br2.width * (br.scaleX ?? 1));
                  maxX = Math.max(maxX, rx, rx + br2.width * (br.scaleX ?? 1));
                  minY = Math.min(minY, ry, ry + br2.height * (br.scaleX ?? 1));
                  maxY = Math.max(maxY, ry, ry + br2.height * (br.scaleX ?? 1));
                }
              }
            }
          }
        }
        // Guard against invalid bounds (e.g., all entities have NaN coords)
        if (!isFinite(minX) || !isFinite(maxX) || !isFinite(minY) || !isFinite(maxY) ||
            maxX - minX < 0.001 && maxY - minY < 0.001) {
          pushLog("Cannot compute extents.");
          break;
        }
        // Viewport size: window minus toolbar (64px) and layer panel (220px) width,
        // minus menubar (32px) and command bar (110px) height.
        const vw = window.innerWidth - 64 - 220;
        const vh = window.innerHeight - 32 - 110;
        const GRID_PIXEL = 50;
        const rangeX = Math.max(maxX - minX, 0.1);
        const rangeY = Math.max(maxY - minY, 0.1);
        const zx = (vw * 0.85) / (rangeX * GRID_PIXEL);
        const zy = (vh * 0.85) / (rangeY * GRID_PIXEL);
        const z = Math.min(zx, zy, 10);
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;
        useCADStore.getState().setZoom(z);
        useCADStore.getState().setPanOffset({
          x: vw / 2 - cx * z * GRID_PIXEL,
          y: vh / 2 - cy * z * GRID_PIXEL,
        });
        pushLog(`Zoom extents — showing ${entities.length} entities`);
        break;
      }
      case "explode": {
        const st = useCADStore.getState();
        const blockRefs = st.selectedIds.filter(id => {
          const e = st.entities.find(ent => ent.id === id);
          return e && e.type === 'block_ref';
        });
        if (blockRefs.length === 0) {
          pushLog('EXPLODE: Select a block reference first.');
        } else {
          for (const refId of blockRefs) {
            useCADStore.getState().explodeBlockRef(refId);
          }
          pushLog(`EXPLODE: Exploded ${blockRefs.length} block reference(s).`);
        }
        break;
      }
      case "bedit": {
        const st2 = useCADStore.getState();
        const ref = st2.entities.find(
          e => st2.selectedIds.includes(e.id) && e.type === 'block_ref'
        );
        if (!ref) {
          pushLog('BEDIT: Select a block reference first.');
        } else {
          useCADStore.getState().enterBlockEditor((ref as any).blockDefId);
          pushLog('BEDIT: Entered block editor. Use BCLOSE to save and exit.');
        }
        break;
      }
      case "bclose": {
        const st3 = useCADStore.getState();
        if (!st3.blockEditorDefId) {
          pushLog('BCLOSE: Not in block editor.');
        } else {
          useCADStore.getState().exitBlockEditor(true);
          pushLog('BCLOSE: Saved and closed block editor.');
        }
        break;
      }
    }
  };

  // Global keypress → focus command bar (unless in another input)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="command-bar">
      <div className="command-log" ref={logRef}>
        {visibleLog.map((msg, i) => (
          <div
            key={`${commandLog.length - visibleLog.length + i}-${i}`}
            className="log-line"
          >
            {msg}
          </div>
        ))}
      </div>
      <div className="command-input-row">
        <span className="prompt">Command:</span>
        <div className="input-wrap">
          <input
            ref={inputRef}
            className="command-input"
            value={input}
            placeholder="type L, REC, C, SNAP, GRID, UNDO… or ? for help"
            onChange={(e) => handleInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                execute(input);
              }
              if (e.key === "Escape") {
                setInput("");
                setSuggestion("");
                setActiveTool("select");
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                const nextIdx = Math.min(
                  historyIndex + 1,
                  cmdHistory.length - 1,
                );
                if (nextIdx >= 0 && cmdHistory[nextIdx]) {
                  setHistoryIndex(nextIdx);
                  setInput(cmdHistory[nextIdx]);
                }
              }
              if (e.key === "ArrowDown") {
                e.preventDefault();
                const nextIdx = historyIndex - 1;
                if (nextIdx < 0) {
                  setHistoryIndex(-1);
                  setInput("");
                } else {
                  setHistoryIndex(nextIdx);
                  setInput(cmdHistory[nextIdx]);
                }
              }
              if (e.key === "Tab" && suggestion) {
                e.preventDefault();
                const full = Object.keys(COMMANDS).find(
                  (k) =>
                    k.startsWith(input.toUpperCase()) &&
                    k !== input.toUpperCase(),
                );
                if (full) setInput(full);
              }
            }}
          />
          {suggestion && <span className="suggestion">{suggestion}</span>}
        </div>
      </div>
    </div>
  );
}
