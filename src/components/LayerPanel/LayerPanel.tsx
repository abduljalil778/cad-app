import { useState } from "react";
import { useCADStore } from "../../store/useCADStore";
import "./LayerPanel.css";

const PRESET_COLORS = [
  "#ffffff",
  "#ff4444",
  "#ffff00",
  "#44aaff",
  "#44ff88",
  "#ff8844",
  "#cc44ff",
  "#44ffee",
];

export default function LayerPanel() {
  const {
    layers,
    activeLayerId,
    setActiveLayer,
    toggleLayerVisibility,
    toggleLayerLock,
    addLayer,
    renameLayer,
    deleteLayer,
  } = useCADStore();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#ffffff");

  const commitRename = (id: string) => {
    if (editingName.trim()) renameLayer(id, editingName.trim());
    setEditingId(null);
  };

  const commitAdd = () => {
    if (newName.trim()) {
      addLayer(newName.trim(), newColor);
      setNewName("");
      setNewColor("#ffffff");
      setShowAdd(false);
    }
  };

  return (
    <div className="layer-panel">
      <div className="panel-header">
        <span>Layers</span>
        <button
          className="icon-btn"
          title="Add layer"
          onClick={() => setShowAdd((v) => !v)}
        >
          ＋
        </button>
      </div>

      {showAdd && (
        <div className="add-layer-form">
          <input
            className="layer-name-input"
            placeholder="Layer name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && commitAdd()}
            autoFocus
          />
          <div className="color-row">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                className={`color-dot ${newColor === c ? "selected" : ""}`}
                style={{ background: c }}
                onClick={() => setNewColor(c)}
              />
            ))}
          </div>
          <button className="add-btn" onClick={commitAdd}>
            Add
          </button>
        </div>
      )}

      <div className="layer-list">
        {layers.map((layer) => (
          <div
            key={layer.id}
            className={`layer-row ${activeLayerId === layer.id ? "active" : ""} ${!layer.visible ? "dimmed" : ""}`}
            onClick={() => setActiveLayer(layer.id)}
          >
            {/* Color swatch */}
            <span className="layer-color" style={{ background: layer.color }} />

            {/* Name — double click to rename */}
            {editingId === layer.id ? (
              <input
                className="layer-name-input inline"
                value={editingName}
                autoFocus
                onChange={(e) => setEditingName(e.target.value)}
                onBlur={() => commitRename(layer.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitRename(layer.id);
                  if (e.key === "Escape") setEditingId(null);
                }}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span
                className="layer-name"
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setEditingId(layer.id);
                  setEditingName(layer.name);
                }}
              >
                {layer.name}
              </span>
            )}

            <div className="layer-actions">
              {/* Visibility */}
              <button
                className={`icon-btn ${!layer.visible ? "off" : ""}`}
                title={layer.visible ? "Hide layer" : "Show layer"}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleLayerVisibility(layer.id);
                }}
              >
                {layer.visible ? "👁" : "◌"}
              </button>
              {/* Lock */}
              <button
                className={`icon-btn ${layer.locked ? "locked" : ""}`}
                title={layer.locked ? "Unlock layer" : "Lock layer"}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleLayerLock(layer.id);
                }}
              >
                {layer.locked ? "🔒" : "🔓"}
              </button>
              {/* Delete (except layer 0) */}
              {layer.id !== "0" && (
                <button
                  className="icon-btn"
                  title="Delete layer"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`Delete layer "${layer.name}"? Entities will be moved to Layer 0.`)) {
                      deleteLayer(layer.id);
                    }
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Mini properties */}
      <div
        className="panel-header"
        style={{ marginTop: "auto", borderTop: "1px solid #3e3e42" }}
      >
        <span>Properties</span>
      </div>
      <div className="properties-area">
        <PropertiesContent />
      </div>
    </div>
  );
}

function PropertiesContent() {
  const { selectedIds, entities, layers } = useCADStore();
  if (selectedIds.length === 0)
    return <p className="props-empty">No selection</p>;

  const entity = entities.find((e) => e.id === selectedIds[0]);
  if (!entity) return null;
  const layer = layers.find((l) => l.id === entity.layerId);

  return (
    <table className="props-table">
      <tbody>
        <tr>
          <td>Type</td>
          <td>{entity.type}</td>
        </tr>
        <tr>
          <td>Layer</td>
          <td>{layer?.name ?? entity.layerId}</td>
        </tr>
        <tr>
          <td>Color</td>
          <td>
            <span
              className="layer-color"
              style={{ background: entity.color ?? "#fff" }}
            />
            {entity.color ?? "ByLayer"}
          </td>
        </tr>
        {entity.type === "line" && (
          <>
            <tr>
              <td>X1</td>
              <td>{entity.x1.toFixed(3)}</td>
            </tr>
            <tr>
              <td>Y1</td>
              <td>{(-entity.y1).toFixed(3)}</td>
            </tr>
            <tr>
              <td>X2</td>
              <td>{entity.x2.toFixed(3)}</td>
            </tr>
            <tr>
              <td>Y2</td>
              <td>{(-entity.y2).toFixed(3)}</td>
            </tr>
            <tr>
              <td>Length</td>
              <td>
                {Math.sqrt(
                  (entity.x2 - entity.x1) ** 2 + (entity.y2 - entity.y1) ** 2,
                ).toFixed(3)}
              </td>
            </tr>
          </>
        )}
        {entity.type === "rectangle" && (
          <>
            <tr>
              <td>X</td>
              <td>{entity.x.toFixed(3)}</td>
            </tr>
            <tr>
              <td>Y</td>
              <td>{(-entity.y).toFixed(3)}</td>
            </tr>
            <tr>
              <td>Width</td>
              <td>{entity.width.toFixed(3)}</td>
            </tr>
            <tr>
              <td>Height</td>
              <td>{entity.height.toFixed(3)}</td>
            </tr>
          </>
        )}
        {entity.type === "circle" && (
          <>
            <tr>
              <td>CX</td>
              <td>{entity.cx.toFixed(3)}</td>
            </tr>
            <tr>
              <td>CY</td>
              <td>{(-entity.cy).toFixed(3)}</td>
            </tr>
            <tr>
              <td>Radius</td>
              <td>{entity.radius.toFixed(3)}</td>
            </tr>
            <tr>
              <td>Diameter</td>
              <td>{(entity.radius * 2).toFixed(3)}</td>
            </tr>
          </>
        )}
        {entity.type === "arc" && (
          <>
            <tr>
              <td>CX</td>
              <td>{(entity as any).cx.toFixed(3)}</td>
            </tr>
            <tr>
              <td>CY</td>
              <td>{(-(entity as any).cy).toFixed(3)}</td>
            </tr>
            <tr>
              <td>Radius</td>
              <td>{(entity as any).radius.toFixed(3)}</td>
            </tr>
            <tr>
              <td>Start°</td>
              <td>{((entity as any).startAngle * 180 / Math.PI).toFixed(1)}</td>
            </tr>
            <tr>
              <td>End°</td>
              <td>{((entity as any).endAngle * 180 / Math.PI).toFixed(1)}</td>
            </tr>
          </>
        )}
        {entity.type === "ellipse" && (
          <>
            <tr>
              <td>CX</td>
              <td>{(entity as any).cx.toFixed(3)}</td>
            </tr>
            <tr>
              <td>CY</td>
              <td>{(-(entity as any).cy).toFixed(3)}</td>
            </tr>
            <tr>
              <td>RX</td>
              <td>{(entity as any).rx.toFixed(3)}</td>
            </tr>
            <tr>
              <td>RY</td>
              <td>{(entity as any).ry.toFixed(3)}</td>
            </tr>
          </>
        )}
        {entity.type === "polyline" && (
          <>
            <tr>
              <td>Points</td>
              <td>{(entity as any).points.length}</td>
            </tr>
            <tr>
              <td>Closed</td>
              <td>{(entity as any).closed ? "Yes" : "No"}</td>
            </tr>
          </>
        )}
        {entity.type === "text" && (
          <>
            <tr>
              <td>X</td>
              <td>{(entity as any).x.toFixed(3)}</td>
            </tr>
            <tr>
              <td>Y</td>
              <td>{(-(entity as any).y).toFixed(3)}</td>
            </tr>
            <tr>
              <td>Text</td>
              <td>{(entity as any).text}</td>
            </tr>
            <tr>
              <td>Size</td>
              <td>{(entity as any).fontSize ?? 1}</td>
            </tr>
          </>
        )}
        {entity.type === "dimension" && (
          <>
            <tr>
              <td>X1</td>
              <td>{(entity as any).x1.toFixed(3)}</td>
            </tr>
            <tr>
              <td>Y1</td>
              <td>{(-(entity as any).y1).toFixed(3)}</td>
            </tr>
            <tr>
              <td>X2</td>
              <td>{(entity as any).x2.toFixed(3)}</td>
            </tr>
            <tr>
              <td>Y2</td>
              <td>{(-(entity as any).y2).toFixed(3)}</td>
            </tr>
            <tr>
              <td>Value</td>
              <td>
                {Math.sqrt(
                  ((entity as any).x2 - (entity as any).x1) ** 2 +
                  ((entity as any).y2 - (entity as any).y1) ** 2,
                ).toFixed(3)}
              </td>
            </tr>
          </>
        )}
      </tbody>
    </table>
  );
}
