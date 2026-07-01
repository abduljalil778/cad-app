import { useRef, useCallback } from 'react';
import { useCADStore } from '../../store/useCADStore';
import './BlockPanel.css';

export default function BlockPanel() {
  const blockDefinitions = useCADStore((s) => s.blockDefinitions);
  const pushLog = useCADStore((s) => s.pushLog);
  const deleteBlockDefinition = useCADStore((s) => s.deleteBlockDefinition);
  const setActiveTool = useCADStore((s) => s.setActiveTool);

  const dragData = useRef<string | null>(null);

  const handleDragStart = useCallback(
    (e: React.DragEvent, defId: string) => {
      dragData.current = defId;
      e.dataTransfer.setData('application/cad-block', defId);
      e.dataTransfer.setData('text/plain', defId);
      e.dataTransfer.effectAllowed = 'copy';
    },
    [],
  );

  const handleInsert = useCallback(
    (_defId: string) => {
      // Set insert tool with pre-selected block
      setActiveTool('insert');
      pushLog('INSERT: Click canvas to place block.');
    },
    [setActiveTool, pushLog],
  );

  const handleDelete = useCallback(
    (defId: string, defName: string) => {
      if (confirm(`Delete block "${defName}"? All instances will be removed.`)) {
        deleteBlockDefinition(defId);
        pushLog(`Deleted block "${defName}".`);
      }
    },
    [deleteBlockDefinition, pushLog],
  );

  return (
    <div className="block-panel">
      <div className="panel-header">
        <span>Blocks</span>
        <span className="block-count">{blockDefinitions.length}</span>
      </div>
      <div className="block-list">
        {blockDefinitions.length === 0 ? (
          <div className="block-empty">No blocks defined.<br />Select entities and use <strong>BLOCK</strong> command.</div>
        ) : (
          blockDefinitions.map((def) => (
            <div
              key={def.id}
              className="block-item"
              draggable
              onDragStart={(e) => handleDragStart(e, def.id)}
              title={`Drag to canvas to insert\n${def.entities.length} entities`}
            >
              <div className="block-item-icon">▣</div>
              <div className="block-item-info">
                <div className="block-item-name">{def.name}</div>
                <div className="block-item-meta">{def.entities.length} entities</div>
              </div>
              <div className="block-item-actions">
                <button
                  className="block-item-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleInsert(def.id);
                  }}
                  title="Insert"
                >
                  ⊞
                </button>
                <button
                  className="block-item-btn delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(def.id, def.name);
                  }}
                  title="Delete"
                >
                  ✕
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
