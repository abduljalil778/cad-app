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
        }
        // Viewport size: window minus toolbar (64px) and layer panel (220px) width,
        // minus menubar (32px) and command bar (110px) height.
        const vw = window.innerWidth - 64 - 220;
        const vh = window.innerHeight - 32 - 110;
        const GRID_PIXEL = 50;
        const zx = (vw * 0.85) / ((maxX - minX) * GRID_PIXEL);
        const zy = (vh * 0.85) / ((maxY - minY) * GRID_PIXEL);
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
              if (e.key === "Enter") execute(input);
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
