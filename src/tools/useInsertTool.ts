import { useState, useCallback } from 'react';
import { useCADStore } from '../store/useCADStore';
import { BlockReferenceEntity } from '../engine/entities';
import { getTransformedBlockEntities } from '../engine/blockTransform';
import { SnapPoint } from '../engine/snap';

type InsertStep = 'pick' | 'place' | 'idle';

export function useInsertTool() {
  const { pushLog } = useCADStore();
  const [step, setStep] = useState<InsertStep>('idle');
  const [selectedDefId, setSelectedDefId] = useState<string | null>(null);
  const [previewPos, setPreviewPos] = useState<{ x: number; y: number } | null>(null);
  const [pickerActive, setPickerActive] = useState(false);
  const [insertRotation, setInsertRotation] = useState(0);
  const [insertScale, setInsertScale] = useState(1);

  const start = useCallback(() => {
    const { blockDefinitions } = useCADStore.getState();
    if (blockDefinitions.length === 0) {
      pushLog('INSERT: No block definitions available. Create a block first.');
      useCADStore.getState().setActiveTool('select');
      return;
    }
    setStep('pick');
    setPickerActive(true);
    pushLog('INSERT: Select a block to insert.');
  }, [pushLog]);

  const selectBlock = useCallback((defId: string) => {
    setSelectedDefId(defId);
    setPickerActive(false);
    setStep('place');
    const { blockDefinitions } = useCADStore.getState();
    const def = blockDefinitions.find(d => d.id === defId);
    pushLog(`INSERT: Click to place "${def?.name ?? 'block'}".`);
  }, [pushLog]);

  const onMouseMove = useCallback(
    (_snap: SnapPoint | null, wx: number, wy: number) => {
      if (step === 'place') {
        setPreviewPos({ x: wx, y: wy });
      }
    },
    [step],
  );

  const onMouseClick = useCallback(
    (snap: SnapPoint | null, wx: number, wy: number) => {
      if (step !== 'place' || !selectedDefId) return;

      const pt = snap ?? { x: wx, y: wy };
      const { activeLayerId, layers } = useCADStore.getState();
      const activeLayer = layers.find(l => l.id === activeLayerId);

      const ref: BlockReferenceEntity = {
        id: crypto.randomUUID(),
        type: 'block_ref',
        layerId: activeLayerId,
        color: activeLayer?.color ?? '#ffffff',
        blockDefId: selectedDefId,
        insertX: pt.x,
        insertY: pt.y,
        scaleX: insertScale,
        scaleY: insertScale,
        rotation: insertRotation,
      };

      useCADStore.getState().addEntity(ref);

      const { blockDefinitions } = useCADStore.getState();
      const def = blockDefinitions.find(d => d.id === selectedDefId);
      pushLog(`INSERT: Placed "${def?.name ?? 'block'}" at (${pt.x.toFixed(2)}, ${pt.y.toFixed(2)}).`);

      // Stay in insert mode for multiple placements
      // User can press Escape to exit
    },
    [step, selectedDefId, insertRotation, insertScale, pushLog],
  );

  const cancel = useCallback(() => {
    setStep('idle');
    setSelectedDefId(null);
    setPreviewPos(null);
    setPickerActive(false);
    setInsertRotation(0);
    setInsertScale(1);
    useCADStore.getState().setActiveTool('select');
  }, []);

  const getHintText = useCallback((): string | null => {
    if (step === 'pick') return 'INSERT: Select block from list';
    if (step === 'place') {
      const { blockDefinitions } = useCADStore.getState();
      const def = blockDefinitions.find(d => d.id === selectedDefId);
      return `INSERT "${def?.name ?? ''}": Click to place | ESC=cancel`;
    }
    return null;
  }, [step, selectedDefId]);

  // Get preview entities for rendering ghost
  const getPreviewEntities = useCallback(() => {
    if (step !== 'place' || !selectedDefId || !previewPos) return [];
    const { blockDefinitions } = useCADStore.getState();
    const def = blockDefinitions.find(d => d.id === selectedDefId);
    if (!def) return [];

    const tempRef: BlockReferenceEntity = {
      id: 'preview',
      type: 'block_ref',
      layerId: '',
      blockDefId: selectedDefId,
      insertX: previewPos.x,
      insertY: previewPos.y,
      scaleX: insertScale,
      scaleY: insertScale,
      rotation: insertRotation,
    };

    return getTransformedBlockEntities(def, tempRef, blockDefinitions);
  }, [step, selectedDefId, previewPos, insertScale, insertRotation]);

  return {
    step, selectedDefId, previewPos, pickerActive, insertRotation, insertScale,
    start, selectBlock, onMouseMove, onMouseClick, cancel, getHintText, getPreviewEntities,
    setInsertRotation, setInsertScale,
  };
}
