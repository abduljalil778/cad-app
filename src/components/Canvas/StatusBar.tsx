import "./StatusBar.css";
import { useCADStore } from "../../store/useCADStore";
import { SnapPoint } from "../../engine/snap";

interface StatusBarProps {
  snapPoint: SnapPoint | null;
  worldCursor: { x: number; y: number };
}

const SNAP_COLORS: Record<string, string> = {
  endpoint: "#ffff00",
  midpoint: "#00ff88",
  center: "#ffff00",
  quadrant: "#00bcd4",
  intersection: "#ff4444",
  grid: "#555",
};

export default function StatusBar({ snapPoint, worldCursor }: StatusBarProps) {
  const {
    activeTool,
    zoom,
    snapEnabled,
    toggleSnap,
    drawingUnit,
    setDrawingUnit,
    orthoMode,
    toggleOrtho,
  } = useCADStore();

  const snapColor = snapPoint ? (SNAP_COLORS[snapPoint.type] ?? "#555") : "#555";

  return (
    <div className="status-bar">
      <span className="status-tool">{activeTool.toUpperCase()}</span>
      &nbsp;&nbsp;
      {snapPoint ? (
        <span style={{ color: snapColor }}>
          ⊕ {snapPoint.type}
        </span>
      ) : (
        <span style={{ color: "#555" }}>○ free</span>
      )}
      &nbsp;&nbsp; X: {worldCursor.x.toFixed(4)} &nbsp; Y:{" "}
      {(-worldCursor.y).toFixed(4)}
      &nbsp;&nbsp;|&nbsp;&nbsp; Zoom: {(zoom * 100).toFixed(0)}%
      &nbsp;&nbsp;|&nbsp;&nbsp;
      <span
        className="status-toggle"
        style={{ color: snapEnabled ? "#4fc3f7" : "#555" }}
        onClick={toggleSnap}
      >
        SNAP {snapEnabled ? "ON" : "OFF"} (F3)
      </span>
      &nbsp;&nbsp;|&nbsp;&nbsp;
      <span
        className="status-toggle"
        style={{ color: orthoMode ? "#4fc3f7" : "#555" }}
        onClick={toggleOrtho}
      >
        ORTHO {orthoMode ? "ON" : "OFF"}
      </span>
      &nbsp;&nbsp;|&nbsp;&nbsp;
      <button
        className="unit-toggle"
        onClick={() => setDrawingUnit(drawingUnit === "m" ? "mm" : "m")}
        title="Click to switch unit"
      >
        unit: {drawingUnit}
      </button>
    </div>
  );
}
