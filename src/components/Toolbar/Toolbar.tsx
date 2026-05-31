import { useCADStore, ActiveTool } from "../../store/useCADStore";
import "./Toolbar.css";

const tools: { id: ActiveTool; label: string; icon: string; group: string; shortcut?: string }[] = [
  { id: "select", label: "Select", icon: "↖", group: "select", shortcut: "Esc" },
  { id: "line", label: "Line", icon: "╱", group: "draw", shortcut: "L" },
  { id: "polyline", label: "Polyline", icon: "⌒", group: "draw", shortcut: "PL" },
  { id: "rectangle", label: "Rect", icon: "▭", group: "draw", shortcut: "REC" },
  { id: "circle", label: "Circle", icon: "○", group: "draw", shortcut: "C" },
  { id: "arc", label: "Arc", icon: "◜", group: "draw", shortcut: "A" },
  { id: "ellipse", label: "Ellipse", icon: "⬭", group: "draw", shortcut: "EL" },
  { id: "text", label: "Text", icon: "T", group: "annotate" },
  { id: "dimension", label: "Dim", icon: "↔", group: "annotate", shortcut: "DIM" },
  { id: "move", label: "Move", icon: "✥", group: "modify", shortcut: "M" },
  { id: "copy", label: "Copy", icon: "⧉", group: "modify", shortcut: "CO" },
  { id: "rotate", label: "Rotate", icon: "↻", group: "modify", shortcut: "RO" },
  { id: "mirror", label: "Mirror", icon: "⏛", group: "modify", shortcut: "MI" },
  { id: "offset", label: "Offset", icon: "◫", group: "modify", shortcut: "O" },
  { id: "trim", label: "Trim", icon: "✂", group: "modify", shortcut: "TR" },
  { id: "extend", label: "Extend", icon: "↦", group: "modify", shortcut: "EX" },
  { id: "fillet", label: "Fillet", icon: "◠", group: "modify", shortcut: "F" },
  { id: "scale", label: "Scale", icon: "⤡", group: "modify", shortcut: "SC" },
];

export default function Toolbar() {
  const { activeTool, setActiveTool, showGrid, toggleGrid, snapEnabled, toggleSnap, orthoMode, toggleOrtho } = useCADStore();

  // Group tools by their group
  const groups = tools.reduce<Record<string, typeof tools>>((acc, tool) => {
    (acc[tool.group] = acc[tool.group] || []).push(tool);
    return acc;
  }, {});

  const groupOrder = ["select", "draw", "annotate", "modify"];

  return (
    <div className="toolbar">
      <div className="toolbar-logo">moCAD</div>

      {groupOrder.map((group, gi) => (
        <div key={group}>
          {gi > 0 && <div className="toolbar-divider" />}
          <div className="toolbar-section">
            {groups[group]?.map((tool) => (
              <button
                key={tool.id}
                className={`tool-btn ${activeTool === tool.id ? "active" : ""}`}
                onClick={() => setActiveTool(tool.id)}
                title={`${tool.label}${tool.shortcut ? ` (${tool.shortcut})` : ''}`}
              >
                <span className="tool-icon">{tool.icon}</span>
                <span className="tool-label">{tool.label}</span>
              </button>
            ))}
          </div>
        </div>
      ))}

      <div className="toolbar-divider" />

      <div className="toolbar-section">
        <button className={`tool-btn ${showGrid ? "active" : ""}`} onClick={toggleGrid} title="Toggle Grid (F7)">
          <span className="tool-icon">#</span>
          <span className="tool-label">Grid</span>
        </button>
        <button className={`tool-btn ${snapEnabled ? "active" : ""}`} onClick={toggleSnap} title="Toggle Snap (F3)">
          <span className="tool-icon">⊕</span>
          <span className="tool-label">Snap</span>
        </button>
        <button className={`tool-btn ${orthoMode ? "active" : ""}`} onClick={toggleOrtho} title="Toggle Ortho (F8)">
          <span className="tool-icon">⊞</span>
          <span className="tool-label">Ortho</span>
        </button>
      </div>
    </div>
  );
}
