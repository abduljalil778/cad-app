import { useState, useEffect } from "react";
import { save, open } from "@tauri-apps/plugin-dialog";
import { writeTextFile, readTextFile } from "@tauri-apps/plugin-fs";
import { useCADStore } from "../../store/useCADStore";
import { exportDXF } from "../../utils/dxfExport";
import { importDXF } from "../../utils/dxfImport";
import { exportPDF } from "../../utils/pdfExport";
import "./MenuBar.css";

export default function MenuBar() {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [showPDFDialog, setShowPDFDialog] = useState(false);

  const {
    entities,
    layers,
    addEntity,
    clearEntities,
    pushLog,
    setZoom,
    setPanOffset,
  } = useCADStore();

  // ─── Global keyboard shortcuts ────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      switch (e.key.toLowerCase()) {
        case "o":
          e.preventDefault();
          handleImportDXF();
          break;
        case "s":
          e.preventDefault();
          handleExportDXF();
          break;
        case "p":
          e.preventDefault();
          setShowPDFDialog(true);
          break;
        case "0":
          e.preventDefault();
          setZoom(1);
          setPanOffset({ x: 0, y: 0 });
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggle = (menu: string) =>
    setOpenMenu((prev) => (prev === menu ? null : menu));

  const close = () => setOpenMenu(null);

  // ─── DXF Export ───────────────────────────────────────
  const handleExportDXF = async () => {
    close();
    try {
      const path = await save({
        filters: [{ name: "DXF File", extensions: ["dxf"] }],
        defaultPath: "drawing.dxf",
      });
      if (!path) return;
      const { drawingUnit } = useCADStore.getState();
      const content = exportDXF(entities, layers, drawingUnit);
      await writeTextFile(path, content);
      pushLog(`DXF exported (unit: ${drawingUnit}) → ${path}`);
    } catch (e) {
      pushLog(`Export failed: ${e}`);
    }
  };

  // ─── DXF Import ───────────────────────────────────────
  const handleImportDXF = async () => {
    close();
    try {
      const path = await open({
        filters: [{ name: "DXF File", extensions: ["dxf"] }],
        multiple: false,
      });
      if (!path || typeof path !== "string") return;

      const content = await readTextFile(path);

      // ambil ukuran viewport saat ini
      const vw = window.innerWidth - 64 - 220; // minus toolbar & layer panel
      const vh = window.innerHeight - 32 - 110; // minus menubar & commandbar

      const result = importDXF(content, vw, vh, 50);

      if (result.entities.length === 0) {
        pushLog("No supported entities found in DXF file.");
        return;
      }

      clearEntities();
      result.entities.forEach((e) => addEntity(e));
      setZoom(result.suggestedZoom);
      setPanOffset(result.suggestedPan);

      pushLog(
        `DXF imported: ${result.entities.length} entities — zoom auto-fit to drawing`,
      );
    } catch (e) {
      pushLog(`Import failed: ${e}`);
    }
  };

  // ─── PDF Export ───────────────────────────────────────
  const handleExportPDF = async (scale: number, size: string) => {
    setShowPDFDialog(false);
    const sizes: Record<string, [number, number]> = {
      A4: [297, 210],
      A3: [420, 297],
      A2: [594, 420],
      A1: [841, 594],
    };
    const [pw, ph] = sizes[size] ?? [420, 297];
    try {
      const url = await exportPDF(entities, layers, {
        scale,
        pageWidth: pw,
        pageHeight: ph,
        margin: 15,
        title: "Drawing",
      });
      if (!url) {
        pushLog("No entities to export.");
        return;
      }
      // Buka PDF di browser default
      const a = document.createElement("a");
      a.href = url;
      a.download = `drawing_1-${Math.round(1 / scale)}.pdf`;
      a.click();
      pushLog(`PDF exported — scale 1:${Math.round(1 / scale)}, ${size}`);
    } catch (e) {
      pushLog(`PDF export failed: ${e}`);
    }
  };

  return (
    <>
      <div className="menubar" onClick={(e) => e.stopPropagation()}>
        {/* File menu */}
        <div className="menu-item" onClick={() => toggle("file")}>
          File
          {openMenu === "file" && (
            <div className="dropdown">
              <button onClick={handleImportDXF}>
                <span>📂</span> Open DXF…
                <kbd>⌘O</kbd>
              </button>
              <div className="divider" />
              <button onClick={handleExportDXF}>
                <span>💾</span> Export DXF…
                <kbd>⌘S</kbd>
              </button>
              <button
                onClick={() => {
                  close();
                  setShowPDFDialog(true);
                }}
              >
                <span>🖨</span> Export PDF…
                <kbd>⌘P</kbd>
              </button>
              <div className="divider" />
              <button
                onClick={() => {
                  close();
                  if (!window.confirm("Clear all entities? This cannot be undone.")) return;
                  useCADStore.getState().clearEntities();
                  pushLog("Canvas cleared.");
                }}
              >
                <span>🗑</span> New / Clear
              </button>
            </div>
          )}
        </div>

        {/* Edit menu */}
        <div className="menu-item" onClick={() => toggle("edit")}>
          Edit
          {openMenu === "edit" && (
            <div className="dropdown">
              <button
                onClick={() => {
                  close();
                  useCADStore.getState().undo();
                }}
              >
                <span>↩</span> Undo <kbd>⌘Z</kbd>
              </button>
              <button
                onClick={() => {
                  close();
                  useCADStore.getState().redo();
                }}
              >
                <span>↪</span> Redo <kbd>⌘⇧Z</kbd>
              </button>
            </div>
          )}
        </div>

        {/* View menu */}
        <div className="menu-item" onClick={() => toggle("view")}>
          View
          {openMenu === "view" && (
            <div className="dropdown">
              <button
                onClick={() => {
                  close();
                  useCADStore.getState().toggleGrid();
                }}
              >
                <span>#</span> Toggle Grid <kbd>F7</kbd>
              </button>
              <button
                onClick={() => {
                  close();
                  useCADStore.getState().toggleSnap();
                }}
              >
                <span>⊕</span> Toggle Snap <kbd>F3</kbd>
              </button>
              <div className="divider" />
              <button
                onClick={() => {
                  close();
                  setZoom(1);
                  setPanOffset({ x: 0, y: 0 });
                }}
              >
                <span>⌖</span> Reset View <kbd>⌘0</kbd>
              </button>
            </div>
          )}
        </div>

        <div className="menubar-title">moCAD</div>
      </div>

      {/* Klik luar tutup menu */}
      {openMenu && <div className="menu-overlay" onClick={close} />}

      {/* PDF Export Dialog */}
      {showPDFDialog && (
        <PDFDialog
          onConfirm={handleExportPDF}
          onClose={() => setShowPDFDialog(false)}
        />
      )}
    </>
  );
}

function PDFDialog({
  onConfirm,
  onClose,
}: {
  onConfirm: (scale: number, size: string) => void;
  onClose: () => void;
}) {
  const [scale, setScale] = useState("100");
  const [size, setSize] = useState("A3");

  return (
    <div className="dialog-backdrop">
      <div className="dialog">
        <h3>Export PDF</h3>

        <label>Paper Size</label>
        <select value={size} onChange={(e) => setSize(e.target.value)}>
          <option>A4</option>
          <option>A3</option>
          <option>A2</option>
          <option>A1</option>
        </select>

        <label>Scale 1 : </label>
        <select value={scale} onChange={(e) => setScale(e.target.value)}>
          <option value="1">1</option>
          <option value="5">5</option>
          <option value="10">10</option>
          <option value="20">20</option>
          <option value="50">50</option>
          <option value="100">100</option>
          <option value="200">200</option>
          <option value="500">500</option>
        </select>

        <div className="dialog-actions">
          <button className="btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-confirm"
            onClick={() => onConfirm(1 / Number(scale), size)}
          >
            Export
          </button>
        </div>
      </div>
    </div>
  );
}
