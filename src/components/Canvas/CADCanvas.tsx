import { useEffect, useRef, useState, useCallback } from "react";
import {
  Stage,
  Layer,
  Line,
  Circle,
  Rect,
  Path,
  Text,
  Ellipse,
} from "react-konva";
import { useCADStore } from "../../store/useCADStore";
import { findSnapPoint, SnapPoint } from "../../engine/snap";
import { useLineTool } from "../../tools/useLineTool";
import { useRectangleTool } from "../../tools/useRectangleTool";
import { useCircleTool } from "../../tools/useCircleTool";
import { usePolylineTool } from "../../tools/usePolylineTool";
import { useArcTool } from "../../tools/useArcTool";
import { useTextTool } from "../../tools/useTextTool";
import { useEllipseTool } from "../../tools/useEllipseTool";
import { useModifyTool } from "../../tools/useModifyTool";
import { useTrimTool } from "../../tools/useTrimTool";
import { useExtendTool } from "../../tools/useExtendTool";
import { useFilletTool } from "../../tools/useFilletTool";
import { useMeasureTool } from "../../tools/useMeasureTool";
import {
  LineEntity,
  RectangleEntity,
  CircleEntity,
  PolylineEntity,
  ArcEntity,
  TextEntity,
  EllipseEntity,
} from "../../engine/entities";
import { arcToPath } from "../../engine/arcPath";
import "./CADCanvas.css";
import { JSX } from "react/jsx-dev-runtime";
import { useDimensionTool } from "../../tools/useDimensionTool";
import { useOffsetTool } from "../../tools/useOffsetTool";
import DimensionShape from "./DimensionShape";
import { DimensionEntity } from "../../engine/entities";

const GRID_PIXEL = 50;

function buildGrid(
  width: number,
  height: number,
  zoom: number,
  pan: { x: number; y: number },
) {
  const lines: JSX.Element[] = [];
  const step = GRID_PIXEL * zoom;
  if (step < 6) return lines;
  const sx = ((-pan.x % step) + step) % step;
  const sy = ((-pan.y % step) + step) % step;
  for (let x = sx; x < width; x += step)
    lines.push(
      <Line
        key={`v${x}`}
        points={[x, 0, x, height]}
        stroke="#2a2a2a"
        strokeWidth={0.5}
        listening={false}
      />,
    );
  for (let y = sy; y < height; y += step)
    lines.push(
      <Line
        key={`h${y}`}
        points={[0, y, width, y]}
        stroke="#2a2a2a"
        strokeWidth={0.5}
        listening={false}
      />,
    );
  return lines;
}

export default function CADCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [worldCursor, setWorldCursor] = useState({ x: 0, y: 0 });
  const [snapPoint, setSnapPoint] = useState<SnapPoint | null>(null);
  const [offsetInputActive, setOffsetInputActive] = useState(false);
  const [offsetInputValue, setOffsetInputValue] = useState("");
  const offsetInputRef = useRef<HTMLInputElement>(null);
  const [textInputActive, setTextInputActive] = useState(false);
  const [textInputValue, setTextInputValue] = useState("");
  const [textFontSize, setTextFontSize] = useState(0.3);
  const textInputRef = useRef<HTMLTextAreaElement>(null);
  const [boxSelectStart, setBoxSelectStart] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [boxSelectEnd, setBoxSelectEnd] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const isBoxSelecting = useRef(false);
  const isDragging = useRef(false);
  const dragStartWorld = useRef<{ x: number; y: number } | null>(null);
  const [scaleInputActive, setScaleInputActive] = useState(false);
  const [scaleInputValue, setScaleInputValue] = useState("");
  const scaleInputRef = useRef<HTMLInputElement>(null);
  const [filletInputActive, setFilletInputActive] = useState(false);
  const [filletInputValue, setFilletInputValue] = useState("");
  const filletInputRef = useRef<HTMLInputElement>(null);
  const lineLengthInputRef = useRef<HTMLInputElement>(null);
  const rectWidthInputRef = useRef<HTMLInputElement>(null);
  const rectHeightInputRef = useRef<HTMLInputElement>(null);
  const circleRadiusInputRef = useRef<HTMLInputElement>(null);
  const ellipseRxInputRef = useRef<HTMLInputElement>(null);
  const ellipseRyInputRef = useRef<HTMLInputElement>(null);
  const polylineLengthInputRef = useRef<HTMLInputElement>(null);

  const {
    zoom,
    setZoom,
    panOffset,
    setPanOffset,
    showGrid,
    snapEnabled,
    entities,
    activeTool,
    undo,
    redo,
    toggleSnap,
    setSelectedIds,
    selectedIds,
    drawingUnit,
    setDrawingUnit,
    layers,
    deleteEntities,
    orthoMode,
    toggleOrtho,
    moveEntities,
  } = useCADStore();

  const lineTool = useLineTool();
  const rectangleTool = useRectangleTool();
  const circleTool = useCircleTool();
  const polylineTool = usePolylineTool();
  const arcTool = useArcTool();
  const dimensionTool = useDimensionTool("linear");
  const offsetTool = useOffsetTool();
  const textTool = useTextTool();
  const ellipseTool = useEllipseTool();
  const modifyTool = useModifyTool();
  const trimTool = useTrimTool();
  const extendTool = useExtendTool();
  const filletTool = useFilletTool();
  const measureTool = useMeasureTool();

  // ── Resize observer ───────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() =>
      setSize({ width: el.clientWidth, height: el.clientHeight }),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Keyboard shortcuts ────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        lineTool.cancel();
        rectangleTool.cancel();
        circleTool.cancel();
        polylineTool.cancel();
        arcTool.cancel();
        dimensionTool.cancel();
        offsetTool.cancel();
        textTool.cancel();
        ellipseTool.cancel();
        modifyTool.cancel();
        trimTool.cancel();
        extendTool.cancel();
        filletTool.cancel();
        measureTool.cancel();
        if (textInputActive) {
          setTextInputActive(false);
          setTextInputValue("");
        }
        if (scaleInputActive) {
          setScaleInputActive(false);
          setScaleInputValue("");
        }
        if (filletInputActive) {
          setFilletInputActive(false);
          setFilletInputValue("");
        }
        useCADStore.getState().setActiveTool("select");
      }
      // Modify tool: Enter confirms selection or finishes copy
      if (["move", "copy", "rotate", "mirror", "scale"].includes(activeTool)) {
        if (e.key === "Enter") {
          e.preventDefault();
          if (modifyTool.step === "scaleInput") {
            // Open scale input overlay
            setScaleInputActive(true);
            setScaleInputValue("");
            setTimeout(() => scaleInputRef.current?.focus(), 50);
          } else {
            modifyTool.confirmSelection();
          }
          return;
        }
        // Mirror: Y/N for delete source
        if (modifyTool.step === "confirmDelete") {
          if (e.key === "y" || e.key === "Y") {
            modifyTool.answerDeleteSource(true);
            return;
          }
          if (e.key === "n" || e.key === "N") {
            modifyTool.answerDeleteSource(false);
            return;
          }
        }
      }
      if (e.key === "Backspace" && activeTool === "polyline") {
        e.preventDefault();
        polylineTool.undoLastPoint();
        return;
      }
      if (activeTool === "polyline") {
        if (e.key === "Enter") polylineTool.finish();
        if (e.key === "c" || e.key === "C") polylineTool.close();
      }
      if (activeTool === "offset" && e.key === "Enter") {
        e.preventDefault();
        setOffsetInputValue(String(offsetTool.distance));
        setOffsetInputActive(true);
        setTimeout(() => offsetInputRef.current?.focus(), 50);
      }
      if (activeTool === "line" && e.key === "Enter") {
        e.preventDefault();
        lineTool.finish();
        return;
      }
      if (activeTool === "measure_area" && e.key === "Enter") {
        e.preventDefault();
        measureTool.finishArea();
        return;
      }
      if (activeTool === "fillet" && e.key === "Enter") {
        e.preventDefault();
        setFilletInputActive(true);
        setFilletInputValue(String(filletTool.radius));
        setTimeout(() => filletInputRef.current?.focus(), 50);
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedIds.length > 0 && activeTool === "select") {
          deleteEntities(selectedIds);
        }
      }
      if (e.key === "F3") {
        e.preventDefault();
        toggleSnap();
      }
      if (e.key === "F8") {
        e.preventDefault();
        toggleOrtho();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if (
        (e.metaKey || e.ctrlKey) &&
        (e.key === "y" || (e.key === "z" && e.shiftKey))
      ) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    activeTool,
    lineTool,
    rectangleTool,
    circleTool,
    polylineTool,
    arcTool,
    dimensionTool,
    offsetTool,
    textTool,
    ellipseTool,
    toggleSnap,
    toggleOrtho,
    undo,
    redo,
    selectedIds,
    deleteEntities,
    textInputActive,
    modifyTool,
    scaleInputActive,
    trimTool,
    extendTool,
    filletTool,
    measureTool,
    filletInputActive,
  ]);

  useEffect(() => {
    setOffsetInputActive(false);
    setScaleInputActive(false);
    setFilletInputActive(false);
  }, [activeTool]);

  useEffect(() => {
    if (activeTool === "line" && lineTool.startPoint) {
      setTimeout(() => lineLengthInputRef.current?.focus(), 50);
      return;
    }
    if (activeTool === "rectangle" && rectangleTool.startPoint) {
      setTimeout(() => rectWidthInputRef.current?.focus(), 50);
      return;
    }
    if (activeTool === "circle" && circleTool.center) {
      setTimeout(() => circleRadiusInputRef.current?.focus(), 50);
      return;
    }
    if (activeTool === "ellipse" && ellipseTool.center) {
      setTimeout(() => ellipseRxInputRef.current?.focus(), 50);
      return;
    }
    if (activeTool === "polyline" && polylineTool.points.length > 0) {
      setTimeout(() => polylineLengthInputRef.current?.focus(), 50);
      return;
    }
  }, [
    activeTool,
    lineTool.startPoint,
    rectangleTool.startPoint,
    circleTool.center,
    ellipseTool.center,
    polylineTool.points.length,
  ]);

  // ── Coordinate helpers ────────────────────────────────────────
  const screenToWorld = useCallback(
    (sx: number, sy: number) => ({
      x: (sx - panOffset.x) / (zoom * GRID_PIXEL),
      y: (sy - panOffset.y) / (zoom * GRID_PIXEL),
    }),
    [panOffset, zoom],
  );

  // ── Mouse handlers ────────────────────────────────────────────
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const factor = 1.1;
      setZoom(
        e.deltaY < 0
          ? Math.min(zoom * factor, 50)
          : Math.max(zoom / factor, 0.05),
      );
    },
    [zoom, setZoom],
  );

  const isPanning = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 1) {
        isPanning.current = true;
        lastPos.current = { x: e.clientX, y: e.clientY };
      }
      if (
        e.button === 0 &&
        (activeTool === "select" ||
          (modifyTool.isActive && modifyTool.step === "selecting"))
      ) {
        const rect = containerRef.current!.getBoundingClientRect();
        const world = screenToWorld(
          e.clientX - rect.left,
          e.clientY - rect.top,
        );

        // Check if clicking on a selected entity to start drag
        if (selectedIds.length > 0) {
          const threshold = 0.15 / (zoom * 0.5 + 0.5);
          const onSelected = entities.some((entity) => {
            if (!selectedIds.includes(entity.id)) return false;
            if (entity.type === "line") {
              const l = entity as any;
              const dx = l.x2 - l.x1,
                dy = l.y2 - l.y1;
              const len = Math.sqrt(dx * dx + dy * dy);
              if (len === 0) return false;
              const t = Math.max(
                0,
                Math.min(
                  1,
                  ((world.x - l.x1) * dx + (world.y - l.y1) * dy) / (len * len),
                ),
              );
              return (
                Math.sqrt(
                  (l.x1 + t * dx - world.x) ** 2 +
                    (l.y1 + t * dy - world.y) ** 2,
                ) < threshold
              );
            }
            if (entity.type === "circle") {
              const c = entity as any;
              return (
                Math.abs(
                  Math.sqrt((world.x - c.cx) ** 2 + (world.y - c.cy) ** 2) -
                    c.radius,
                ) < threshold
              );
            }
            if (entity.type === "rectangle") {
              const r = entity as any;
              return (
                world.x >= r.x - threshold &&
                world.x <= r.x + r.width + threshold &&
                world.y >= r.y - threshold &&
                world.y <= r.y + r.height + threshold
              );
            }
            return false;
          });

          if (onSelected) {
            isDragging.current = true;
            dragStartWorld.current = world;
            return;
          }
        }

        // Start potential box selection
        isBoxSelecting.current = true;
        setBoxSelectStart(world);
        setBoxSelectEnd(world);
      }
    },
    [activeTool, screenToWorld, selectedIds, entities, zoom, modifyTool],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning.current) {
        setPanOffset({
          x: panOffset.x + e.clientX - lastPos.current.x,
          y: panOffset.y + e.clientY - lastPos.current.y,
        });
        lastPos.current = { x: e.clientX, y: e.clientY };
        return;
      }
      const rect = containerRef.current!.getBoundingClientRect();
      const world = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
      setWorldCursor(world);

      // Apply ortho constraint for drawing tools
      let orthoWorld = world;
      if (orthoMode && (activeTool === "line" || activeTool === "polyline")) {
        let lastPt: { x: number; y: number } | null = null;
        if (activeTool === "line" && lineTool.startPoint)
          lastPt = lineTool.startPoint;
        if (activeTool === "polyline" && polylineTool.points.length > 0)
          lastPt = polylineTool.points[polylineTool.points.length - 1];

        if (lastPt) {
          const dx = Math.abs(world.x - lastPt.x);
          const dy = Math.abs(world.y - lastPt.y);
          if (dx > dy) {
            orthoWorld = { x: world.x, y: lastPt.y };
          } else {
            orthoWorld = { x: lastPt.x, y: world.y };
          }
        }
      }

      const snap = findSnapPoint(
        orthoWorld.x,
        orthoWorld.y,
        entities,
        zoom,
        1,
        snapEnabled,
      );
      setSnapPoint(snap);

      // Box selection tracking
      if (
        isBoxSelecting.current &&
        (activeTool === "select" ||
          (modifyTool.isActive && modifyTool.step === "selecting"))
      ) {
        setBoxSelectEnd(world);
      }

      if (activeTool === "line")
        lineTool.onMouseMove(snap, orthoWorld.x, orthoWorld.y);
      if (activeTool === "rectangle")
        rectangleTool.onMouseMove(snap, orthoWorld.x, orthoWorld.y);
      if (activeTool === "circle")
        circleTool.onMouseMove(snap, orthoWorld.x, orthoWorld.y);
      if (activeTool === "polyline")
        polylineTool.onMouseMove(snap, orthoWorld.x, orthoWorld.y);
      if (activeTool === "arc")
        arcTool.onMouseMove(snap, orthoWorld.x, orthoWorld.y);
      if (activeTool === "dimension")
        dimensionTool.onMouseMove(snap, orthoWorld.x, orthoWorld.y);
      if (activeTool === "text")
        textTool.onMouseMove(snap, orthoWorld.x, orthoWorld.y);
      if (activeTool === "ellipse")
        ellipseTool.onMouseMove(snap, orthoWorld.x, orthoWorld.y);
      if (
        ["measure_dist", "measure_angle", "measure_area"].includes(activeTool)
      ) {
        measureTool.onMouseMove(snap, orthoWorld.x, orthoWorld.y);
      }
      if (activeTool === "fillet") {
        filletTool.onMouseMove(snap, orthoWorld.x, orthoWorld.y);
      }
      if (modifyTool.isActive) {
        modifyTool.onMouseMove(snap, orthoWorld.x, orthoWorld.y);
      }
    },
    [
      isPanning,
      panOffset,
      setPanOffset,
      screenToWorld,
      entities,
      zoom,
      snapEnabled,
      activeTool,
      lineTool,
      rectangleTool,
      circleTool,
      polylineTool,
      arcTool,
      dimensionTool,
      textTool,
      ellipseTool,
      orthoMode,
      modifyTool,
      measureTool,
      filletTool,
    ],
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 1) isPanning.current = false;

      // Drag-to-move completion
      if (isDragging.current && dragStartWorld.current) {
        isDragging.current = false;
        const rect = containerRef.current!.getBoundingClientRect();
        const world = screenToWorld(
          e.clientX - rect.left,
          e.clientY - rect.top,
        );
        const dx = world.x - dragStartWorld.current.x;
        const dy = world.y - dragStartWorld.current.y;
        if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001) {
          moveEntities(selectedIds, dx, dy);
        }
        dragStartWorld.current = null;
        return;
      }

      if (
        isBoxSelecting.current &&
        (activeTool === "select" ||
          (modifyTool.isActive && modifyTool.step === "selecting")) &&
        boxSelectStart
      ) {
        isBoxSelecting.current = false;
        const rect = containerRef.current!.getBoundingClientRect();
        const world = screenToWorld(
          e.clientX - rect.left,
          e.clientY - rect.top,
        );
        const start = boxSelectStart;
        const end = boxSelectEnd || world;
        const minX = Math.min(start.x, end.x);
        const maxX = Math.max(start.x, end.x);
        const minY = Math.min(start.y, end.y);
        const maxY = Math.max(start.y, end.y);

        // Only do box select if dragged more than a small threshold
        const dragDist = Math.sqrt(
          (end.x - start.x) ** 2 + (end.y - start.y) ** 2,
        );
        if (dragDist > 0.05) {
          const isWindowSelect = end.x > start.x; // left-to-right = window
          const hits = entities.filter((entity) => {
            // Check layer visibility
            const entityLayer = layers.find((l) => l.id === entity.layerId);
            if (entityLayer && !entityLayer.visible) return false;

            // Get entity bounding box
            let eMinX = Infinity,
              eMinY = Infinity,
              eMaxX = -Infinity,
              eMaxY = -Infinity;
            if (entity.type === "line") {
              eMinX = Math.min(entity.x1, entity.x2);
              eMaxX = Math.max(entity.x1, entity.x2);
              eMinY = Math.min(entity.y1, entity.y2);
              eMaxY = Math.max(entity.y1, entity.y2);
            } else if (entity.type === "circle") {
              eMinX = entity.cx - entity.radius;
              eMaxX = entity.cx + entity.radius;
              eMinY = entity.cy - entity.radius;
              eMaxY = entity.cy + entity.radius;
            } else if (entity.type === "rectangle") {
              eMinX = entity.x;
              eMaxX = entity.x + entity.width;
              eMinY = entity.y;
              eMaxY = entity.y + entity.height;
            } else if (entity.type === "polyline") {
              for (const p of entity.points) {
                eMinX = Math.min(eMinX, p.x);
                eMaxX = Math.max(eMaxX, p.x);
                eMinY = Math.min(eMinY, p.y);
                eMaxY = Math.max(eMaxY, p.y);
              }
            } else if (entity.type === "arc") {
              eMinX = entity.cx - entity.radius;
              eMaxX = entity.cx + entity.radius;
              eMinY = entity.cy - entity.radius;
              eMaxY = entity.cy + entity.radius;
            } else if (entity.type === "ellipse") {
              eMinX = entity.cx - entity.rx;
              eMaxX = entity.cx + entity.rx;
              eMinY = entity.cy - entity.ry;
              eMaxY = entity.cy + entity.ry;
            } else if (entity.type === "text") {
              const t = entity as TextEntity;
              const textWidth = t.text.length * t.fontSize * 0.6;
              const textHeight =
                t.fontSize * t.lineHeight * t.text.split("\n").length;
              eMinX = t.x;
              eMaxX = t.x + textWidth;
              eMinY = t.y;
              eMaxY = t.y + textHeight;
            } else {
              return false;
            }

            if (isWindowSelect) {
              // Window: entity must be fully inside
              return (
                eMinX >= minX && eMaxX <= maxX && eMinY >= minY && eMaxY <= maxY
              );
            } else {
              // Crossing: entity just needs to intersect
              return !(
                eMaxX < minX ||
                eMinX > maxX ||
                eMaxY < minY ||
                eMinY > maxY
              );
            }
          });
          setSelectedIds(hits.map((e) => e.id));
        }
        setBoxSelectStart(null);
        setBoxSelectEnd(null);
      }
    },
    [
      activeTool,
      boxSelectStart,
      boxSelectEnd,
      screenToWorld,
      entities,
      layers,
      setSelectedIds,
      moveEntities,
      selectedIds,
      modifyTool,
    ],
  );

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;

      // Compute ortho-constrained cursor position for tools
      let effectiveX = worldCursor.x;
      let effectiveY = worldCursor.y;
      if (orthoMode) {
        let lastPt: { x: number; y: number } | null = null;
        if (activeTool === "line" && lineTool.startPoint)
          lastPt = lineTool.startPoint;
        if (activeTool === "polyline" && polylineTool.points.length > 0)
          lastPt = polylineTool.points[polylineTool.points.length - 1];

        if (lastPt) {
          const dx = Math.abs(worldCursor.x - lastPt.x);
          const dy = Math.abs(worldCursor.y - lastPt.y);
          if (dx > dy) {
            effectiveY = lastPt.y;
          } else {
            effectiveX = lastPt.x;
          }
        }
      }

      if (activeTool === "line") {
        lineTool.onMouseClick(snapPoint, effectiveX, effectiveY);
        return;
      }
      if (activeTool === "rectangle") {
        rectangleTool.onMouseClick(snapPoint, effectiveX, effectiveY);
        return;
      }
      if (activeTool === "circle") {
        circleTool.onMouseClick(snapPoint, effectiveX, effectiveY);
        return;
      }
      if (activeTool === "polyline") {
        polylineTool.onMouseClick(snapPoint, effectiveX, effectiveY);
        return;
      }
      if (activeTool === "arc") {
        arcTool.onMouseClick(snapPoint, effectiveX, effectiveY);
        return;
      }
      if (activeTool === "dimension") {
        dimensionTool.onMouseClick(snapPoint, effectiveX, effectiveY);
        return;
      }
      if (activeTool === "offset") {
        offsetTool.onMouseClick(snapPoint, effectiveX, effectiveY);
        return;
      }
      if (activeTool === "text") {
        textTool.onMouseClick(snapPoint, effectiveX, effectiveY);
        setTextInputActive(true);
        setTextInputValue("");
        setTimeout(() => textInputRef.current?.focus(), 50);
        return;
      }
      if (activeTool === "ellipse") {
        ellipseTool.onMouseClick(snapPoint, effectiveX, effectiveY);
        return;
      }

      if (activeTool === "trim") {
        trimTool.onMouseClick(snapPoint, effectiveX, effectiveY);
        return;
      }
      if (activeTool === "extend") {
        extendTool.onMouseClick(snapPoint, effectiveX, effectiveY);
        return;
      }
      if (activeTool === "fillet") {
        filletTool.onMouseClick(snapPoint, effectiveX, effectiveY);
        return;
      }
      if (
        ["measure_dist", "measure_angle", "measure_area"].includes(activeTool)
      ) {
        measureTool.onMouseClick(snapPoint, effectiveX, effectiveY);
        return;
      }

      // Modify tools: clicking during selecting step uses the select hit-test below
      // Clicking during basePoint/action step delegates to modify tool
      if (modifyTool.isActive && modifyTool.step !== "selecting") {
        modifyTool.onMouseClick(snapPoint, effectiveX, effectiveY);
        return;
      }

      // ── SELECT hit test ────────────────────────────────────────
      if (
        activeTool === "select" ||
        (modifyTool.isActive && modifyTool.step === "selecting")
      ) {
        const threshold = 0.15 / (zoom * 0.5 + 0.5); // scales with zoom
        const hit = [...entities].reverse().find((entity) => {
          // Skip entities on hidden layers
          const entityLayer = layers.find((l) => l.id === entity.layerId);
          if (entityLayer && !entityLayer.visible) return false;

          if (entity.type === "line") {
            const l = entity as LineEntity;
            const dx = l.x2 - l.x1,
              dy = l.y2 - l.y1;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len === 0) return false;
            const t = Math.max(
              0,
              Math.min(
                1,
                ((effectiveX - l.x1) * dx + (effectiveY - l.y1) * dy) /
                  (len * len),
              ),
            );
            return (
              Math.sqrt(
                (l.x1 + t * dx - effectiveX) ** 2 +
                  (l.y1 + t * dy - effectiveY) ** 2,
              ) < threshold
            );
          }
          if (entity.type === "circle") {
            const c = entity as CircleEntity;
            return (
              Math.abs(
                Math.sqrt((effectiveX - c.cx) ** 2 + (effectiveY - c.cy) ** 2) -
                  c.radius,
              ) < threshold
            );
          }
          if (entity.type === "rectangle") {
            const r = entity as RectangleEntity;
            const onH =
              Math.abs(effectiveY - r.y) < threshold ||
              Math.abs(effectiveY - r.y - r.height) < threshold;
            const onV =
              Math.abs(effectiveX - r.x) < threshold ||
              Math.abs(effectiveX - r.x - r.width) < threshold;
            const inX =
              effectiveX >= r.x - threshold &&
              effectiveX <= r.x + r.width + threshold;
            const inY =
              effectiveY >= r.y - threshold &&
              effectiveY <= r.y + r.height + threshold;
            return (onH && inX) || (onV && inY);
          }
          if (entity.type === "polyline") {
            const p = entity as PolylineEntity;
            for (let i = 0; i < p.points.length - 1; i++) {
              const ax = p.points[i].x,
                ay = p.points[i].y;
              const bx = p.points[i + 1].x,
                by = p.points[i + 1].y;
              const dx = bx - ax,
                dy = by - ay;
              const len = Math.sqrt(dx * dx + dy * dy);
              if (len === 0) continue;
              const t = Math.max(
                0,
                Math.min(
                  1,
                  ((effectiveX - ax) * dx + (effectiveY - ay) * dy) /
                    (len * len),
                ),
              );
              if (
                Math.sqrt(
                  (ax + t * dx - effectiveX) ** 2 +
                    (ay + t * dy - effectiveY) ** 2,
                ) < threshold
              )
                return true;
            }
            return false;
          }
          if (entity.type === "arc") {
            const a = entity as ArcEntity;
            const dist = Math.sqrt(
              (effectiveX - a.cx) ** 2 + (effectiveY - a.cy) ** 2,
            );
            if (Math.abs(dist - a.radius) > threshold) return false;
            let angle = Math.atan2(effectiveY - a.cy, effectiveX - a.cx);
            let start = a.startAngle,
              end = a.endAngle;
            if (end < start) end += Math.PI * 2;
            if (angle < start) angle += Math.PI * 2;
            return angle >= start && angle <= end;
          }
          if (entity.type === "dimension") {
            const d = entity as DimensionEntity;
            return (
              Math.sqrt((effectiveX - d.x1) ** 2 + (effectiveY - d.y1) ** 2) <
                threshold * 3 ||
              Math.sqrt((effectiveX - d.x2) ** 2 + (effectiveY - d.y2) ** 2) <
                threshold * 3
            );
          }
          if (entity.type === "text") {
            // Simple bounding box hit test
            const t = entity as TextEntity;
            const textWidth = t.text.length * t.fontSize * 0.6;
            const textHeight =
              t.fontSize * t.lineHeight * t.text.split("\n").length;
            return (
              effectiveX >= t.x &&
              effectiveX <= t.x + textWidth &&
              effectiveY >= t.y &&
              effectiveY <= t.y + textHeight
            );
          }
          if (entity.type === "ellipse") {
            const el = entity as EllipseEntity;
            // Approximate: check if point is near ellipse boundary
            const dx = (effectiveX - el.cx) / el.rx;
            const dy = (effectiveY - el.cy) / el.ry;
            const d = Math.sqrt(dx * dx + dy * dy);
            return Math.abs(d - 1) < threshold / Math.min(el.rx, el.ry);
          }
          return false;
        });
        if (hit) {
          // Toggle selection: add if not selected, remove if already selected
          if (selectedIds.includes(hit.id)) {
            setSelectedIds(selectedIds.filter((id) => id !== hit.id));
          } else {
            setSelectedIds([...selectedIds, hit.id]);
          }
        } else {
          // Click on empty space: deselect all
          setSelectedIds([]);
        }
      }
    },
    [
      activeTool,
      lineTool,
      rectangleTool,
      circleTool,
      polylineTool,
      arcTool,
      dimensionTool,
      offsetTool,
      textTool,
      ellipseTool,
      snapPoint,
      worldCursor,
      entities,
      setSelectedIds,
      selectedIds,
      zoom,
      layers,
      modifyTool,
      trimTool,
      extendTool,
      filletTool,
      measureTool,
      orthoMode,
    ],
  );

  // ── Helpers ───────────────────────────────────────────────────
  const sw = (n: number) => n / (zoom * GRID_PIXEL);

  const snapScreen = snapPoint
    ? {
        x: snapPoint.x * GRID_PIXEL * zoom + panOffset.x,
        y: snapPoint.y * GRID_PIXEL * zoom + panOffset.y,
      }
    : null;

  // ── Hint text ─────────────────────────────────────────────────
  const hintText: string | null = (() => {
    if (activeTool === "arc")
      return (
        {
          start: "Click start point",
          mid: "Click point on arc",
          end: "Click end point",
        }[arcTool.step] ?? null
      );

    if (activeTool === "dimension")
      return (
        {
          p1: "Click first point",
          p2: "Click second point",
          offset: "Click to place dimension line",
        }[dimensionTool.step] ?? null
      );

    if (activeTool === "offset") {
      const offsetHints: Record<string, string> = {
        select: "Click entity to offset",
        side: `Click side to offset  |  dist: ${offsetTool.distance}  |  Enter = change distance`,
      };
      return offsetHints[offsetTool.step] ?? null;
    }

    if (activeTool === "polyline" && polylineTool.points.length > 0)
      return "Enter = finish  |  C = close  |  Backspace = undo  |  ESC = cancel";

    if (activeTool === "text") {
      return textTool.insertPoint
        ? "Type text and press Enter"
        : "Click to set text position";
    }
    if (activeTool === "ellipse") {
      return ellipseTool.center
        ? "Click to set semi-axes (corner point)"
        : "Click to set ellipse center";
    }
    if (activeTool === "trim") return "TRIM: Click entity segment to trim";
    if (activeTool === "extend")
      return "EXTEND: Click entity near the end to extend";
    if (activeTool === "fillet") {
      return filletTool.step === "first"
        ? `FILLET (r=${filletTool.radius}): Click first line | Enter = change radius`
        : "FILLET: Click second line";
    }
    if (measureTool.mode) return measureTool.getHintText();

    if (modifyTool.isActive) {
      return modifyTool.getHintText();
    }

    return null;
  })();

  // ── Dimension preview entity ──────────────────────────────────
  const dimPreview: DimensionEntity | null =
    activeTool === "dimension" &&
    dimensionTool.p1 &&
    dimensionTool.p2 &&
    dimensionTool.cursor &&
    dimensionTool.step === "offset"
      ? {
          id: "__preview__",
          type: "dimension",
          layerId: "0",
          color: "#00ffff",
          dimType: "linear",
          x1: dimensionTool.p1.x,
          y1: dimensionTool.p1.y,
          x2: dimensionTool.p2.x,
          y2: dimensionTool.p2.y,
          dx: dimensionTool.cursor.x - dimensionTool.p1.x,
          dy: dimensionTool.cursor.y - dimensionTool.p1.y,
        }
      : null;

  return (
    <div
      ref={containerRef}
      className="cad-canvas-container"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onClick={handleClick}
    >
      <Stage width={size.width} height={size.height}>
        {/* ── Grid ── */}
        {showGrid && (
          <Layer listening={false}>
            {buildGrid(size.width, size.height, zoom, panOffset)}
          </Layer>
        )}

        {/* ── Entity + Preview Layer ── */}
        <Layer
          x={panOffset.x}
          y={panOffset.y}
          scaleX={zoom * GRID_PIXEL}
          scaleY={zoom * GRID_PIXEL}
        >
          {/* Committed entities */}
          {entities.map((entity) => {
            // Layer visibility check
            const entityLayer = layers.find((l) => l.id === entity.layerId);
            if (entityLayer && !entityLayer.visible) return null;

            const sel = selectedIds.includes(entity.id);
            const stroke = sel ? "#4fc3f7" : (entity.color ?? "#ffffff");
            const sw1 = sw(sel ? 2 : 1);

            if (entity.type === "line") {
              const l = entity as LineEntity;
              return (
                <Line
                  key={l.id}
                  points={[l.x1, l.y1, l.x2, l.y2]}
                  stroke={stroke}
                  strokeWidth={sw1}
                  listening={false}
                />
              );
            }
            if (entity.type === "rectangle") {
              const r = entity as RectangleEntity;
              return (
                <Rect
                  key={r.id}
                  x={r.x}
                  y={r.y}
                  width={r.width}
                  height={r.height}
                  stroke={stroke}
                  strokeWidth={sw1}
                  fill={sel ? "rgba(79,195,247,0.07)" : "transparent"}
                  listening={false}
                />
              );
            }
            if (entity.type === "circle") {
              const c = entity as CircleEntity;
              return (
                <Circle
                  key={c.id}
                  x={c.cx}
                  y={c.cy}
                  radius={c.radius}
                  stroke={stroke}
                  strokeWidth={sw1}
                  fill={sel ? "rgba(79,195,247,0.07)" : "transparent"}
                  listening={false}
                />
              );
            }
            if (entity.type === "polyline") {
              const p = entity as PolylineEntity;
              const pts = p.points.flatMap((pt) => [pt.x, pt.y]);
              if (p.closed) pts.push(p.points[0].x, p.points[0].y);
              return (
                <Line
                  key={p.id}
                  points={pts}
                  stroke={stroke}
                  strokeWidth={sw1}
                  listening={false}
                />
              );
            }
            if (entity.type === "arc") {
              const a = entity as ArcEntity;
              return (
                <Path
                  key={a.id}
                  data={arcToPath(
                    a.cx,
                    a.cy,
                    a.radius,
                    a.startAngle,
                    a.endAngle,
                  )}
                  stroke={stroke}
                  strokeWidth={sw1}
                  fill="transparent"
                  listening={false}
                />
              );
            }
            if (entity.type === "dimension") {
              return (
                <DimensionShape
                  key={entity.id}
                  entity={entity as DimensionEntity}
                  zoom={zoom}
                  gridPixel={GRID_PIXEL}
                  isSelected={sel}
                />
              );
            }
            if (entity.type === "text") {
              const t = entity as TextEntity;
              return (
                <Text
                  key={t.id}
                  x={t.x}
                  y={t.y}
                  text={t.text}
                  fontSize={t.fontSize}
                  fontFamily={t.fontFamily}
                  fontStyle={
                    `${t.bold ? "bold" : ""} ${t.italic ? "italic" : ""}`.trim() ||
                    "normal"
                  }
                  fill={stroke}
                  rotation={(t.rotation * 180) / Math.PI}
                  align={t.alignment}
                  lineHeight={t.lineHeight}
                  listening={false}
                />
              );
            }
            if (entity.type === "ellipse") {
              const el = entity as EllipseEntity;
              return (
                <Ellipse
                  key={el.id}
                  x={el.cx}
                  y={el.cy}
                  radiusX={el.rx}
                  radiusY={el.ry}
                  rotation={(el.rotation * 180) / Math.PI}
                  stroke={stroke}
                  strokeWidth={sw1}
                  fill={sel ? "rgba(79,195,247,0.07)" : "transparent"}
                  listening={false}
                />
              );
            }
            return null;
          })}

          {/* ── Line preview ── */}
          {lineTool.preview && (
            <Line
              points={[
                lineTool.preview.x1,
                lineTool.preview.y1,
                lineTool.preview.x2,
                lineTool.preview.y2,
              ]}
              stroke="#4fc3f7"
              strokeWidth={sw(1)}
              dash={[sw(6), sw(4)]}
              listening={false}
            />
          )}
          {lineTool.startPoint && (
            <Circle
              x={lineTool.startPoint.x}
              y={lineTool.startPoint.y}
              radius={sw(3)}
              fill="#4fc3f7"
              listening={false}
            />
          )}

          {/* ── Rectangle preview ── */}
          {rectangleTool.preview && (
            <Rect
              x={rectangleTool.preview.x}
              y={rectangleTool.preview.y}
              width={rectangleTool.preview.width}
              height={rectangleTool.preview.height}
              stroke="#4fc3f7"
              strokeWidth={sw(1)}
              fill="rgba(79,195,247,0.05)"
              dash={[sw(6), sw(4)]}
              listening={false}
            />
          )}
          {rectangleTool.startPoint && (
            <Circle
              x={rectangleTool.startPoint.x}
              y={rectangleTool.startPoint.y}
              radius={sw(3)}
              fill="#4fc3f7"
              listening={false}
            />
          )}

          {/* ── Circle preview ── */}
          {circleTool.preview && (
            <>
              <Circle
                x={circleTool.preview.cx}
                y={circleTool.preview.cy}
                radius={circleTool.preview.radius}
                stroke="#4fc3f7"
                strokeWidth={sw(1)}
                fill="rgba(79,195,247,0.05)"
                dash={[sw(6), sw(4)]}
                listening={false}
              />
              <Line
                points={[
                  circleTool.preview.cx,
                  circleTool.preview.cy,
                  circleTool.preview.cx + circleTool.preview.radius,
                  circleTool.preview.cy,
                ]}
                stroke="#4fc3f7"
                strokeWidth={sw(0.5)}
                dash={[sw(3), sw(3)]}
                listening={false}
              />
            </>
          )}
          {circleTool.center && (
            <Circle
              x={circleTool.center.x}
              y={circleTool.center.y}
              radius={sw(3)}
              fill="#4fc3f7"
              listening={false}
            />
          )}

          {/* ── Polyline preview ── */}
          {polylineTool.points.length > 0 && (
            <>
              {polylineTool.points.map((pt, i) => (
                <Circle
                  key={i}
                  x={pt.x}
                  y={pt.y}
                  radius={sw(3)}
                  fill="#4fc3f7"
                  listening={false}
                />
              ))}
              {polylineTool.cursor && (
                <Line
                  points={[...polylineTool.points, polylineTool.cursor].flatMap(
                    (p) => [p.x, p.y],
                  )}
                  stroke="#4fc3f7"
                  strokeWidth={sw(1)}
                  dash={[sw(6), sw(4)]}
                  listening={false}
                />
              )}
            </>
          )}

          {/* ── Arc preview ── */}
          {arcTool.p1 && (
            <Circle
              x={arcTool.p1.x}
              y={arcTool.p1.y}
              radius={sw(3)}
              fill="#4fc3f7"
              listening={false}
            />
          )}
          {arcTool.p2 && (
            <Circle
              x={arcTool.p2.x}
              y={arcTool.p2.y}
              radius={sw(3)}
              fill="#ffaa44"
              listening={false}
            />
          )}
          {arcTool.preview && arcTool.preview.radius > 0 && (
            <Path
              data={arcToPath(
                arcTool.preview.cx,
                arcTool.preview.cy,
                arcTool.preview.radius,
                arcTool.preview.startAngle,
                arcTool.preview.endAngle,
              )}
              stroke="#4fc3f7"
              strokeWidth={sw(1)}
              fill="transparent"
              dash={[sw(6), sw(4)]}
              listening={false}
            />
          )}

          {/* ── Ellipse preview ── */}
          {ellipseTool.center && (
            <Circle
              x={ellipseTool.center.x}
              y={ellipseTool.center.y}
              radius={sw(3)}
              fill="#4fc3f7"
              listening={false}
            />
          )}
          {ellipseTool.preview && (
            <Ellipse
              x={ellipseTool.preview.cx}
              y={ellipseTool.preview.cy}
              radiusX={ellipseTool.preview.rx}
              radiusY={ellipseTool.preview.ry}
              stroke="#4fc3f7"
              strokeWidth={sw(1)}
              fill="rgba(79,195,247,0.05)"
              dash={[sw(6), sw(4)]}
              listening={false}
            />
          )}

          {/* ── Text insert cursor ── */}
          {activeTool === "text" &&
            textTool.cursor &&
            !textTool.insertPoint && (
              <>
                <Line
                  points={[
                    textTool.cursor.x,
                    textTool.cursor.y - sw(8),
                    textTool.cursor.x,
                    textTool.cursor.y + sw(8),
                  ]}
                  stroke="#4fc3f7"
                  strokeWidth={sw(1)}
                  listening={false}
                />
                <Line
                  points={[
                    textTool.cursor.x - sw(4),
                    textTool.cursor.y,
                    textTool.cursor.x + sw(4),
                    textTool.cursor.y,
                  ]}
                  stroke="#4fc3f7"
                  strokeWidth={sw(1)}
                  listening={false}
                />
              </>
            )}
          {activeTool === "text" && textTool.insertPoint && (
            <Circle
              x={textTool.insertPoint.x}
              y={textTool.insertPoint.y}
              radius={sw(3)}
              fill="#00ffff"
              listening={false}
            />
          )}

          {/* ── Modify tool preview (ghost entities) ── */}
          {modifyTool.previewEntities.map((entity, idx) => {
            const stroke = "#00bcd4";
            const sw1 = sw(1);
            const dashPattern = [sw(6), sw(4)];

            if (entity.type === "line") {
              return (
                <Line
                  key={`mp_${idx}`}
                  points={[entity.x1, entity.y1, entity.x2, entity.y2]}
                  stroke={stroke}
                  strokeWidth={sw1}
                  dash={dashPattern}
                  listening={false}
                />
              );
            }
            if (entity.type === "circle") {
              return (
                <Circle
                  key={`mp_${idx}`}
                  x={entity.cx}
                  y={entity.cy}
                  radius={entity.radius}
                  stroke={stroke}
                  strokeWidth={sw1}
                  dash={dashPattern}
                  fill="transparent"
                  listening={false}
                />
              );
            }
            if (entity.type === "rectangle") {
              return (
                <Rect
                  key={`mp_${idx}`}
                  x={entity.x}
                  y={entity.y}
                  width={entity.width}
                  height={entity.height}
                  stroke={stroke}
                  strokeWidth={sw1}
                  dash={dashPattern}
                  fill="transparent"
                  listening={false}
                />
              );
            }
            if (entity.type === "polyline") {
              const pts = entity.points.flatMap((p) => [p.x, p.y]);
              if (entity.closed)
                pts.push(entity.points[0].x, entity.points[0].y);
              return (
                <Line
                  key={`mp_${idx}`}
                  points={pts}
                  stroke={stroke}
                  strokeWidth={sw1}
                  dash={dashPattern}
                  listening={false}
                />
              );
            }
            if (entity.type === "arc") {
              return (
                <Path
                  key={`mp_${idx}`}
                  data={arcToPath(
                    entity.cx,
                    entity.cy,
                    entity.radius,
                    entity.startAngle,
                    entity.endAngle,
                  )}
                  stroke={stroke}
                  strokeWidth={sw1}
                  dash={dashPattern}
                  fill="transparent"
                  listening={false}
                />
              );
            }
            if (entity.type === "ellipse") {
              return (
                <Ellipse
                  key={`mp_${idx}`}
                  x={entity.cx}
                  y={entity.cy}
                  radiusX={entity.rx}
                  radiusY={entity.ry}
                  rotation={(entity.rotation * 180) / Math.PI}
                  stroke={stroke}
                  strokeWidth={sw1}
                  dash={dashPattern}
                  fill="transparent"
                  listening={false}
                />
              );
            }
            if (entity.type === "text") {
              return (
                <Text
                  key={`mp_${idx}`}
                  x={entity.x}
                  y={entity.y}
                  text={entity.text}
                  fontSize={entity.fontSize}
                  fontFamily={entity.fontFamily}
                  fill={stroke}
                  rotation={(entity.rotation * 180) / Math.PI}
                  align={entity.alignment}
                  opacity={0.6}
                  listening={false}
                />
              );
            }
            if (entity.type === "dimension") {
              return (
                <DimensionShape
                  key={`mp_${idx}`}
                  entity={entity as DimensionEntity}
                  zoom={zoom}
                  gridPixel={GRID_PIXEL}
                  isSelected={false}
                />
              );
            }
            return null;
          })}

          {/* ── Modify tool: base point indicator ── */}
          {modifyTool.basePoint && (
            <Circle
              x={modifyTool.basePoint.x}
              y={modifyTool.basePoint.y}
              radius={sw(4)}
              fill="#ff4444"
              listening={false}
            />
          )}

          {/* ── Modify tool: mirror line preview ── */}
          {modifyTool.mode === "mirror" &&
            modifyTool.basePoint &&
            modifyTool.step === "action" &&
            modifyTool.cursor && (
              <Line
                points={[
                  modifyTool.basePoint.x,
                  modifyTool.basePoint.y,
                  modifyTool.cursor.x,
                  modifyTool.cursor.y,
                ]}
                stroke="#ff4444"
                strokeWidth={sw(1)}
                dash={[sw(4), sw(4)]}
                listening={false}
              />
            )}

          {/* ── Modify tool: rotate angle line preview ── */}
          {modifyTool.mode === "rotate" &&
            modifyTool.basePoint &&
            modifyTool.step === "action" &&
            modifyTool.cursor && (
              <Line
                points={[
                  modifyTool.basePoint.x,
                  modifyTool.basePoint.y,
                  modifyTool.cursor.x,
                  modifyTool.cursor.y,
                ]}
                stroke="#ffaa44"
                strokeWidth={sw(0.5)}
                dash={[sw(3), sw(3)]}
                listening={false}
              />
            )}

          {/* ── Dimension preview ── */}
          {activeTool === "dimension" && dimensionTool.p1 && (
            <Circle
              x={dimensionTool.p1.x}
              y={dimensionTool.p1.y}
              radius={sw(3)}
              fill="#00ffff"
              listening={false}
            />
          )}
          {activeTool === "dimension" && dimensionTool.p2 && (
            <Circle
              x={dimensionTool.p2.x}
              y={dimensionTool.p2.y}
              radius={sw(3)}
              fill="#00ffff"
              listening={false}
            />
          )}
          {dimPreview && (
            <DimensionShape
              entity={dimPreview}
              zoom={zoom}
              gridPixel={GRID_PIXEL}
              isSelected={false}
            />
          )}

          {/* ── Measurement preview ── */}
          {measureTool.points.length > 0 && (
            <>
              {measureTool.points.map((pt, i) => (
                <Circle
                  key={`mp_${i}`}
                  x={pt.x}
                  y={pt.y}
                  radius={sw(3)}
                  fill="#ffaa00"
                  listening={false}
                />
              ))}
              {/* Preview lines between points */}
              {measureTool.points.length > 1 && (
                <Line
                  points={measureTool.points.flatMap((p) => [p.x, p.y])}
                  stroke="#ffaa00"
                  strokeWidth={sw(1)}
                  dash={[sw(4), sw(4)]}
                  listening={false}
                />
              )}
              {/* Preview line to cursor for area mode */}
              {measureTool.mode === "area" &&
                measureTool.cursor &&
                measureTool.points.length > 0 && (
                  <Line
                    points={[
                      measureTool.points[measureTool.points.length - 1].x,
                      measureTool.points[measureTool.points.length - 1].y,
                      measureTool.cursor.x,
                      measureTool.cursor.y,
                    ]}
                    stroke="#ffaa00"
                    strokeWidth={sw(0.5)}
                    dash={[sw(3), sw(3)]}
                    listening={false}
                  />
                )}
              {/* Close preview for area */}
              {measureTool.mode === "area" &&
                measureTool.points.length >= 3 && (
                  <Line
                    points={[
                      measureTool.points[measureTool.points.length - 1].x,
                      measureTool.points[measureTool.points.length - 1].y,
                      measureTool.points[0].x,
                      measureTool.points[0].y,
                    ]}
                    stroke="#ffaa00"
                    strokeWidth={sw(0.5)}
                    dash={[sw(2), sw(6)]}
                    opacity={0.5}
                    listening={false}
                  />
                )}
              {/* Distance preview line */}
              {measureTool.mode === "dist" &&
                measureTool.points.length === 1 &&
                measureTool.cursor && (
                  <Line
                    points={[
                      measureTool.points[0].x,
                      measureTool.points[0].y,
                      measureTool.cursor.x,
                      measureTool.cursor.y,
                    ]}
                    stroke="#ffaa00"
                    strokeWidth={sw(1)}
                    dash={[sw(4), sw(4)]}
                    listening={false}
                  />
                )}
            </>
          )}

          {/* ── Fillet first line highlight ── */}
          {activeTool === "fillet" && filletTool.firstLine && (
            <Line
              points={[
                filletTool.firstLine.x1,
                filletTool.firstLine.y1,
                filletTool.firstLine.x2,
                filletTool.firstLine.y2,
              ]}
              stroke="#00ffff"
              strokeWidth={sw(2)}
              listening={false}
            />
          )}

          {/* ── Fillet preview (trimmed lines + arc) ── */}
          {activeTool === "fillet" && filletTool.previewResult && (
            <>
              {/* Preview trimmed line 1 */}
              <Line
                points={[
                  filletTool.previewResult.line1.x1,
                  filletTool.previewResult.line1.y1,
                  filletTool.previewResult.line1.x2,
                  filletTool.previewResult.line1.y2,
                ]}
                stroke="#00ffff"
                strokeWidth={sw(1)}
                dash={[sw(6), sw(4)]}
                listening={false}
              />
              {/* Preview trimmed line 2 */}
              <Line
                points={[
                  filletTool.previewResult.line2.x1,
                  filletTool.previewResult.line2.y1,
                  filletTool.previewResult.line2.x2,
                  filletTool.previewResult.line2.y2,
                ]}
                stroke="#00ffff"
                strokeWidth={sw(1)}
                dash={[sw(6), sw(4)]}
                listening={false}
              />
              {/* Preview fillet arc */}
              <Path
                data={arcToPath(
                  filletTool.previewResult.arc.cx,
                  filletTool.previewResult.arc.cy,
                  filletTool.previewResult.arc.radius,
                  filletTool.previewResult.arc.startAngle,
                  filletTool.previewResult.arc.endAngle,
                )}
                stroke="#00ffff"
                strokeWidth={sw(1)}
                dash={[sw(6), sw(4)]}
                fill="transparent"
                listening={false}
              />
            </>
          )}
        </Layer>

        {/* ── Snap indicators (screen space) ── */}
        <Layer listening={false}>
          {snapScreen && snapPoint?.type === "endpoint" && (
            <Rect
              x={snapScreen.x - 6}
              y={snapScreen.y - 6}
              width={12}
              height={12}
              stroke="#ffff00"
              strokeWidth={1.5}
              fill="transparent"
            />
          )}
          {snapScreen && snapPoint?.type === "midpoint" && (
            <Rect
              x={snapScreen.x - 5}
              y={snapScreen.y - 5}
              width={10}
              height={10}
              stroke="#00ff88"
              strokeWidth={1.5}
              fill="transparent"
              rotation={45}
            />
          )}
          {snapScreen && snapPoint?.type === "center" && (
            <Circle
              x={snapScreen.x}
              y={snapScreen.y}
              radius={6}
              stroke="#ffff00"
              strokeWidth={1.5}
              fill="transparent"
            />
          )}
          {snapScreen && snapPoint?.type === "quadrant" && (
            <Rect
              x={snapScreen.x - 5}
              y={snapScreen.y - 5}
              width={10}
              height={10}
              stroke="#00bcd4"
              strokeWidth={1.5}
              fill="transparent"
              rotation={45}
            />
          )}
          {snapScreen && snapPoint?.type === "intersection" && (
            <>
              <Line
                points={[
                  snapScreen.x - 5,
                  snapScreen.y - 5,
                  snapScreen.x + 5,
                  snapScreen.y + 5,
                ]}
                stroke="#ff4444"
                strokeWidth={1.5}
              />
              <Line
                points={[
                  snapScreen.x + 5,
                  snapScreen.y - 5,
                  snapScreen.x - 5,
                  snapScreen.y + 5,
                ]}
                stroke="#ff4444"
                strokeWidth={1.5}
              />
            </>
          )}
          {snapScreen && snapPoint?.type === "nearest" && (
            <Circle
              x={snapScreen.x}
              y={snapScreen.y}
              radius={4}
              stroke="#ffaa44"
              strokeWidth={1.5}
              fill="transparent"
            />
          )}

          {/* Box selection rectangle (screen space) */}
          {boxSelectStart &&
            boxSelectEnd &&
            isBoxSelecting.current &&
            (() => {
              const s = {
                x: boxSelectStart.x * GRID_PIXEL * zoom + panOffset.x,
                y: boxSelectStart.y * GRID_PIXEL * zoom + panOffset.y,
              };
              const e = {
                x: boxSelectEnd.x * GRID_PIXEL * zoom + panOffset.x,
                y: boxSelectEnd.y * GRID_PIXEL * zoom + panOffset.y,
              };
              const isWindow = boxSelectEnd.x > boxSelectStart.x;
              return (
                <Rect
                  x={Math.min(s.x, e.x)}
                  y={Math.min(s.y, e.y)}
                  width={Math.abs(e.x - s.x)}
                  height={Math.abs(e.y - s.y)}
                  stroke={isWindow ? "#2196f3" : "#4caf50"}
                  strokeWidth={1}
                  fill={
                    isWindow ? "rgba(33,150,243,0.1)" : "rgba(76,175,80,0.1)"
                  }
                  dash={isWindow ? undefined : [6, 3]}
                />
              );
            })()}
        </Layer>
      </Stage>

      {/* ── Tool hint ── */}
      {/* Offset distance input */}
      {offsetInputActive && (
        <div className="offset-input-overlay">
          <span>Offset distance:</span>
          <input
            ref={offsetInputRef}
            className="offset-input"
            type="number"
            min="0.001"
            step="0.1"
            value={offsetInputValue}
            onChange={(e) => setOffsetInputValue(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") {
                const val = Number(offsetInputValue);
                if (!isNaN(val) && val > 0) {
                  offsetTool.setOffsetDistance(val);
                }
                setOffsetInputActive(false);
              }
              if (e.key === "Escape") {
                setOffsetInputActive(false);
              }
            }}
          />
          <span className="offset-input-hint">
            Enter = confirm ESC = cancel
          </span>
        </div>
      )}
      {/* Text input overlay */}
      {textInputActive && textTool.insertPoint && (
        <div className="text-input-overlay">
          <div className="text-input-header">
            <span>Text Input</span>
            <div className="text-input-options">
              <label>
                Size:
                <input
                  type="number"
                  min="0.05"
                  step="0.05"
                  value={textFontSize}
                  onChange={(e) =>
                    setTextFontSize(Number(e.target.value) || 0.3)
                  }
                  className="text-size-input"
                />
              </label>
            </div>
          </div>
          <textarea
            ref={textInputRef}
            className="text-content-input"
            value={textInputValue}
            onChange={(e) => setTextInputValue(e.target.value)}
            placeholder="Type text here... (Enter to confirm, Shift+Enter for new line)"
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (textInputValue.trim()) {
                  textTool.commit(textInputValue, { fontSize: textFontSize });
                }
                setTextInputActive(false);
                setTextInputValue("");
              }
              if (e.key === "Escape") {
                textTool.cancel();
                setTextInputActive(false);
                setTextInputValue("");
              }
            }}
          />
          <span className="text-input-hint">
            Enter = confirm &nbsp; Shift+Enter = new line &nbsp; ESC = cancel
          </span>
        </div>
      )}
      {/* Scale factor input */}
      {scaleInputActive && (
        <div className="offset-input-overlay">
          <span>Scale factor:</span>
          <input
            ref={scaleInputRef}
            className="offset-input"
            type="number"
            min="0.001"
            step="0.1"
            value={scaleInputValue}
            onChange={(e) => setScaleInputValue(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") {
                const val = Number(scaleInputValue);
                if (!isNaN(val) && val > 0) {
                  modifyTool.applyScale(val);
                }
                setScaleInputActive(false);
                setScaleInputValue("");
              }
              if (e.key === "Escape") {
                setScaleInputActive(false);
                setScaleInputValue("");
              }
            }}
          />
          <span className="offset-input-hint">
            Enter = confirm ESC = cancel
          </span>
        </div>
      )}
      {/* Fillet radius input */}
      {filletInputActive && (
        <div className="offset-input-overlay">
          <span>Fillet radius:</span>
          <input
            ref={filletInputRef}
            className="offset-input"
            type="number"
            min="0"
            step="0.1"
            value={filletInputValue}
            onChange={(e) => setFilletInputValue(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") {
                const val = Number(filletInputValue);
                if (!isNaN(val) && val >= 0) {
                  filletTool.setFilletRadius(val);
                }
                setFilletInputActive(false);
                setFilletInputValue("");
              }
              if (e.key === "Escape") {
                setFilletInputActive(false);
                setFilletInputValue("");
              }
            }}
          />
          <span className="offset-input-hint">
            Enter = confirm ESC = cancel
          </span>
        </div>
      )}
      {activeTool === "line" && lineTool.startPoint && (
        <div className="offset-input-overlay">
          <span>Length:</span>
          <input
            ref={lineLengthInputRef}
            className="offset-input"
            type="number"
            min="0"
            step="0.1"
            value={lineTool.lengthValue}
            onChange={(e) => lineTool.setLengthValue(e.target.value)}
          />
          <span className="offset-input-hint">
            Masukkan panjang lalu klik titik akhir
          </span>
        </div>
      )}
      {activeTool === "rectangle" && rectangleTool.startPoint && (
        <div className="offset-input-overlay">
          <span>W:</span>
          <input
            ref={rectWidthInputRef}
            className="offset-input"
            type="number"
            min="0"
            step="0.1"
            value={rectangleTool.widthValue}
            onChange={(e) => rectangleTool.setWidthValue(e.target.value)}
          />
          <span>H:</span>
          <input
            ref={rectHeightInputRef}
            className="offset-input"
            type="number"
            min="0"
            step="0.1"
            value={rectangleTool.heightValue}
            onChange={(e) => rectangleTool.setHeightValue(e.target.value)}
          />
          <span className="offset-input-hint">
            Masukkan lebar/tinggi lalu klik titik akhir
          </span>
        </div>
      )}
      {activeTool === "circle" && circleTool.center && (
        <div className="offset-input-overlay">
          <span>R:</span>
          <input
            ref={circleRadiusInputRef}
            className="offset-input"
            type="number"
            min="0"
            step="0.1"
            value={circleTool.radiusValue}
            onChange={(e) => circleTool.setRadiusValue(e.target.value)}
          />
          <span className="offset-input-hint">
            Masukkan radius lalu klik titik akhir
          </span>
        </div>
      )}
      {activeTool === "ellipse" && ellipseTool.center && (
        <div className="offset-input-overlay">
          <span>Rx:</span>
          <input
            ref={ellipseRxInputRef}
            className="offset-input"
            type="number"
            min="0"
            step="0.1"
            value={ellipseTool.rxValue}
            onChange={(e) => ellipseTool.setRxValue(e.target.value)}
          />
          <span>Ry:</span>
          <input
            ref={ellipseRyInputRef}
            className="offset-input"
            type="number"
            min="0"
            step="0.1"
            value={ellipseTool.ryValue}
            onChange={(e) => ellipseTool.setRyValue(e.target.value)}
          />
          <span className="offset-input-hint">
            Masukkan Rx/Ry lalu klik titik akhir
          </span>
        </div>
      )}
      {activeTool === "polyline" && polylineTool.points.length > 0 && (
        <div className="offset-input-overlay">
          <span>Length:</span>
          <input
            ref={polylineLengthInputRef}
            className="offset-input"
            type="number"
            min="0"
            step="0.1"
            value={polylineTool.lengthValue}
            onChange={(e) => polylineTool.setLengthValue(e.target.value)}
          />
          <span className="offset-input-hint">
            Masukkan panjang segmen lalu klik titik akhir
          </span>
        </div>
      )}
      {hintText && <div className="tool-hint">{hintText}</div>}

      {/* ── Status bar ── */}
      <div className="coord-display">
        <span className="status-tool">{activeTool.toUpperCase()}</span>
        &nbsp;&nbsp;
        {snapPoint ? (
          <span
            style={{
              color:
                snapPoint.type === "endpoint"
                  ? "#ffff00"
                  : snapPoint.type === "midpoint"
                    ? "#00ff88"
                    : snapPoint.type === "center"
                      ? "#ffff00"
                      : snapPoint.type === "quadrant"
                        ? "#00bcd4"
                        : snapPoint.type === "intersection"
                          ? "#ff4444"
                          : snapPoint.type === "nearest"
                            ? "#ffaa44"
                            : "#555",
            }}
          >
            ⊕ {snapPoint.type}
          </span>
        ) : (
          <span style={{ color: "#555" }}>○ free</span>
        )}
        &nbsp;&nbsp; X: {worldCursor.x.toFixed(3)} &nbsp; Y:{" "}
        {(-worldCursor.y).toFixed(3)}
        &nbsp;&nbsp;|&nbsp;&nbsp; Zoom: {zoom.toFixed(2)}x
        &nbsp;&nbsp;|&nbsp;&nbsp;
        <span style={{ color: snapEnabled ? "#4fc3f7" : "#555" }}>
          SNAP {snapEnabled ? "ON" : "OFF"} (F3)
        </span>
        &nbsp;&nbsp;|&nbsp;&nbsp;
        <span style={{ color: orthoMode ? "#4fc3f7" : "#555" }}>
          ORTHO {orthoMode ? "ON" : "OFF"} (F8)
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
    </div>
  );
}
