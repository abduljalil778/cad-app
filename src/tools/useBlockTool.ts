import { useState, useCallback } from 'react';
import { useCADStore } from '../store/useCADStore';
import { BlockDefinition, BlockReferenceEntity } from '../engine/entities';
import { SnapPoint } from '../engine/snap';

type BlockStep = 'name' | 'basepoint' | 'idle';

export function useBlockTool() {
  const {
    pushLog,
  } = useCADStore();

  const [step, setStep] = useState<BlockStep>('idle');
  const [blockName, setBlockName] = useState('');
  const [nameInputActive, setNameInputActive] = useState(false);

  const start = useCallback(() => {
    const { selectedIds } = useCADStore.getState();
    if (selectedIds.length === 0) {
      pushLog('BLOCK: Select entities first, then use BLOCK command.');
      useCADStore.getState().setActiveTool('select');
      return;
    }
    setStep('name');
    setNameInputActive(true);
    setBlockName('');
    pushLog('BLOCK: Enter block name.');
  }, [pushLog]);

  const confirmName = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) {
      pushLog('BLOCK: Name cannot be empty.');
      return;
    }
    // Check duplicate
    const { blockDefinitions } = useCADStore.getState();
    if (blockDefinitions.some(d => d.name.toLowerCase() === trimmed.toLowerCase())) {
      pushLog(`BLOCK: Name "${trimmed}" already exists.`);
      return;
    }
    setBlockName(trimmed);
    setNameInputActive(false);
    setStep('basepoint');
    pushLog('BLOCK: Click base point (insertion point).');
  }, [pushLog]);

  const onMouseClick = useCallback(
    (snap: SnapPoint | null, wx: number, wy: number) => {
      if (step !== 'basepoint') return;

      const pt = snap ?? { x: wx, y: wy };
      const { selectedIds, entities, activeLayerId, layers } = useCADStore.getState();
      const selectedSet = new Set(selectedIds);
      const selectedEntities = entities.filter(e => selectedSet.has(e.id));

      if (selectedEntities.length === 0) {
        pushLog('BLOCK: No entities selected.');
        cancel();
        return;
      }

      const activeLayer = layers.find(l => l.id === activeLayerId);

      // Create block definition
      const defId = crypto.randomUUID();
      const def: BlockDefinition = {
        id: defId,
        name: blockName,
        basePoint: { x: pt.x, y: pt.y },
        entities: selectedEntities.map(e => ({ ...e })),
        createdAt: Date.now(),
      };

      // Create block reference at the same position
      const ref: BlockReferenceEntity = {
        id: crypto.randomUUID(),
        type: 'block_ref',
        layerId: activeLayerId,
        color: activeLayer?.color ?? '#ffffff',
        blockDefId: defId,
        insertX: pt.x,
        insertY: pt.y,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
      };

      // Add definition
      useCADStore.getState().addBlockDefinition(def);

      // Replace selected entities with block reference
      const remaining = entities.filter(e => !selectedSet.has(e.id));
      remaining.push(ref);
      useCADStore.getState().setEntities(remaining);
      useCADStore.getState().setSelectedIds([ref.id]);

      pushLog(`BLOCK: Created block "${blockName}" with ${selectedEntities.length} entities.`);

      setStep('idle');
      setBlockName('');
      useCADStore.getState().setActiveTool('select');
    },
    [step, blockName, pushLog],
  );

  const cancel = useCallback(() => {
    setStep('idle');
    setBlockName('');
    setNameInputActive(false);
    useCADStore.getState().setActiveTool('select');
  }, []);

  const getHintText = useCallback((): string | null => {
    if (step === 'name') return 'BLOCK: Enter block name in the input field';
    if (step === 'basepoint') return `BLOCK "${blockName}": Click base point`;
    return null;
  }, [step, blockName]);

  return { step, blockName, nameInputActive, start, confirmName, onMouseClick, cancel, getHintText, setBlockName };
}
