import { create } from "zustand";
import type {
  CADEntity,
  LineEntity,
  CircleEntity,
  ArcEntity,
  RectangleEntity,
  PolylineEntity,
  TextEntity,
  DimensionEntity,
  EllipseEntity,
} from "../engine/entities";

const MAX_HISTORY = 50;

export type ActiveTool =
  | "select"
  | "line"
  | "rectangle"
  | "circle"
  | "arc"
  | "polyline"
  | "text"
  | "dimension"
  | "offset"
  | "ellipse"
  | "move"
  | "copy"
  | "rotate"
  | "mirror"
  | "scale"
  | "trim"
  | "extend"
  | "fillet"
  | "measure_dist"
  | "measure_angle"
  | "measure_area";

export interface Layer {
  id: string;
  name: string;
  color: string;
  visible: boolean;
  locked: boolean;
}

interface CADStore {
  activeTool: ActiveTool;
  setActiveTool: (tool: ActiveTool) => void;
  drawingUnit: "mm" | "m";
  setDrawingUnit: (unit: "mm" | "m") => void;

  zoom: number;
  setZoom: (zoom: number) => void;

  panOffset: { x: number; y: number };
  setPanOffset: (offset: { x: number; y: number }) => void;

  layers: Layer[];
  activeLayerId: string;
  layerCounter: number;
  setActiveLayer: (id: string) => void;
  toggleLayerVisibility: (id: string) => void;
  toggleLayerLock: (id: string) => void;
  addLayer: (name: string, color: string) => void;
  renameLayer: (id: string, name: string) => void;
  deleteLayer: (id: string) => void;

  showGrid: boolean;
  toggleGrid: () => void;

  snapEnabled: boolean;
  toggleSnap: () => void;

  orthoMode: boolean;
  toggleOrtho: () => void;

  selectedIds: string[];
  setSelectedIds: (ids: string[]) => void;

  entities: CADEntity[];
  history: CADEntity[][];
  future: CADEntity[][];
  addEntity: (entity: CADEntity) => void;
  deleteEntities: (ids: string[]) => void;
  updateEntity: (id: string, changes: Partial<CADEntity>) => void;
  updateEntities: (
    updates: Array<{ id: string; changes: Partial<CADEntity> }>,
  ) => void;
  moveEntities: (ids: string[], dx: number, dy: number) => void;
  copyEntities: (ids: string[]) => void;
  setEntities: (entities: CADEntity[]) => void;
  undo: () => void;
  redo: () => void;
  clearEntities: () => void;

  commandLog: string[];
  pushLog: (msg: string) => void;
}

/**
 * Push current entities onto the history stack (capped at MAX_HISTORY)
 * and clear the future stack.
 */
function pushHistory(
  history: CADEntity[][],
  currentEntities: CADEntity[],
): CADEntity[][] {
  const newHistory = [...history, currentEntities];
  if (newHistory.length > MAX_HISTORY) {
    return newHistory.slice(newHistory.length - MAX_HISTORY);
  }
  return newHistory;
}

/**
 * Move a single entity by (dx, dy), returning a new entity object.
 */
function moveEntity(entity: CADEntity, dx: number, dy: number): CADEntity {
  switch (entity.type) {
    case "line": {
      const e = entity as LineEntity;
      return { ...e, x1: e.x1 + dx, y1: e.y1 + dy, x2: e.x2 + dx, y2: e.y2 + dy };
    }
    case "circle": {
      const e = entity as CircleEntity;
      return { ...e, cx: e.cx + dx, cy: e.cy + dy };
    }
    case "arc": {
      const e = entity as ArcEntity;
      return { ...e, cx: e.cx + dx, cy: e.cy + dy };
    }
    case "rectangle": {
      const e = entity as RectangleEntity;
      return { ...e, x: e.x + dx, y: e.y + dy };
    }
    case "polyline": {
      const e = entity as PolylineEntity;
      return {
        ...e,
        points: e.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
      };
    }
    case "text": {
      const e = entity as TextEntity;
      return { ...e, x: e.x + dx, y: e.y + dy };
    }
    case "dimension": {
      const e = entity as DimensionEntity;
      return { ...e, x1: e.x1 + dx, y1: e.y1 + dy, x2: e.x2 + dx, y2: e.y2 + dy };
    }
    case "ellipse": {
      const e = entity as EllipseEntity;
      return { ...e, cx: e.cx + dx, cy: e.cy + dy };
    }
    default:
      return entity;
  }
}

export const useCADStore = create<CADStore>((set) => ({
  activeTool: "select",
  setActiveTool: (tool) => set({ activeTool: tool }),
  drawingUnit: "mm",
  setDrawingUnit: (unit) => set({ drawingUnit: unit }),
  zoom: 1,
  setZoom: (zoom) => set({ zoom }),

  panOffset: { x: 0, y: 0 },
  setPanOffset: (panOffset) => set({ panOffset }),

  layers: [
    {
      id: "0",
      name: "Layer 0",
      color: "#ffffff",
      visible: true,
      locked: false,
    },
    {
      id: "1",
      name: "MEP-Mechanical",
      color: "#ff4444",
      visible: true,
      locked: false,
    },
    {
      id: "2",
      name: "MEP-Electrical",
      color: "#ffff00",
      visible: true,
      locked: false,
    },
    {
      id: "3",
      name: "MEP-Plumbing",
      color: "#44aaff",
      visible: true,
      locked: false,
    },
  ],
  activeLayerId: "0",
  layerCounter: 4,
  setActiveLayer: (id) => set({ activeLayerId: id }),
  toggleLayerVisibility: (id) =>
    set((s) => ({
      layers: s.layers.map((l) =>
        l.id === id ? { ...l, visible: !l.visible } : l,
      ),
    })),
  toggleLayerLock: (id) =>
    set((s) => ({
      layers: s.layers.map((l) =>
        l.id === id ? { ...l, locked: !l.locked } : l,
      ),
    })),
  addLayer: (name, color) =>
    set((s) => ({
      layerCounter: s.layerCounter + 1,
      layers: [
        ...s.layers,
        {
          id: String(s.layerCounter),
          name,
          color,
          visible: true,
          locked: false,
        },
      ],
    })),
  renameLayer: (id, name) =>
    set((s) => ({
      layers: s.layers.map((l) => (l.id === id ? { ...l, name } : l)),
    })),
  deleteLayer: (id) =>
    set((s) => {
      // Cannot delete layer "0"
      if (id === "0") return s;
      return {
        layers: s.layers.filter((l) => l.id !== id),
        // Move entities on the deleted layer to layer "0"
        entities: s.entities.map((e) =>
          e.layerId === id ? { ...e, layerId: "0" } : e,
        ),
        // If the deleted layer was active, switch to layer "0"
        activeLayerId: s.activeLayerId === id ? "0" : s.activeLayerId,
      };
    }),

  showGrid: true,
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),

  snapEnabled: true,
  toggleSnap: () => set((s) => ({ snapEnabled: !s.snapEnabled })),

  orthoMode: false,
  toggleOrtho: () => set((s) => ({ orthoMode: !s.orthoMode })),

  selectedIds: [],
  setSelectedIds: (ids) => set({ selectedIds: ids }),

  entities: [],
  history: [],
  future: [],

  addEntity: (entity) =>
    set((s) => ({
      history: pushHistory(s.history, s.entities),
      future: [],
      entities: [...s.entities, entity],
    })),

  deleteEntities: (ids) =>
    set((s) => {
      const idSet = new Set(ids);
      return {
        history: pushHistory(s.history, s.entities),
        future: [],
        entities: s.entities.filter((e) => !idSet.has(e.id)),
        selectedIds: s.selectedIds.filter((sid) => !idSet.has(sid)),
      };
    }),

  updateEntity: (id, changes) =>
    set((s) => ({
      history: pushHistory(s.history, s.entities),
      future: [],
      entities: s.entities.map((e) =>
        e.id === id ? ({ ...e, ...changes } as CADEntity) : e,
      ),
    })),

  updateEntities: (updates) =>
    set((s) => {
      const changeMap = new Map(
        updates.map((u) => [u.id, u.changes]),
      );
      return {
        history: pushHistory(s.history, s.entities),
        future: [],
        entities: s.entities.map((e) => {
          const changes = changeMap.get(e.id);
          return changes ? ({ ...e, ...changes } as CADEntity) : e;
        }),
      };
    }),

  moveEntities: (ids, dx, dy) =>
    set((s) => {
      const idSet = new Set(ids);
      return {
        history: pushHistory(s.history, s.entities),
        future: [],
        entities: s.entities.map((e) =>
          idSet.has(e.id) ? moveEntity(e, dx, dy) : e,
        ),
      };
    }),

  copyEntities: (ids) =>
    set((s) => {
      const idSet = new Set(ids);
      const originals = s.entities.filter((e) => idSet.has(e.id));
      const copies = originals.map((e) => ({
        ...e,
        id: crypto.randomUUID(),
      }));
      return {
        history: pushHistory(s.history, s.entities),
        future: [],
        entities: [...s.entities, ...copies],
      };
    }),

  setEntities: (entities) =>
    set((s) => ({
      history: pushHistory(s.history, s.entities),
      future: [],
      entities,
    })),

  undo: () =>
    set((s) => {
      if (s.history.length === 0) return s;
      const previous = s.history[s.history.length - 1];
      const newFuture = [s.entities, ...s.future];
      return {
        history: s.history.slice(0, -1),
        future: newFuture.length > MAX_HISTORY
          ? newFuture.slice(0, MAX_HISTORY)
          : newFuture,
        entities: previous,
      };
    }),

  redo: () =>
    set((s) => {
      if (s.future.length === 0) return s;
      const next = s.future[0];
      return {
        history: pushHistory(s.history, s.entities),
        future: s.future.slice(1),
        entities: next,
      };
    }),

  clearEntities: () => set({ entities: [], history: [], future: [] }),

  commandLog: ["Welcome to moCAD — type a command or pick a tool."],
  pushLog: (msg) =>
    set((s) => ({
      commandLog: [...s.commandLog.slice(-49), msg],
    })),
}));
