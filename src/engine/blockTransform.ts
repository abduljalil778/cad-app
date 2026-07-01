import { CADEntity, BlockDefinition, BlockReferenceEntity } from './entities';
import { translateEntity, rotateEntity, scaleEntity } from './transform';

/** Max nesting depth to prevent circular reference infinite loops. */
const MAX_NESTING_DEPTH = 16;

/**
 * Transform a block definition's entities to world space based on a block reference.
 * Supports nested blocks: if a definition contains block_ref entities, they are
 * recursively resolved and flattened into primitive entities.
 *
 * The transform pipeline per level:
 * 1. Translate by -basePoint (move to origin)
 * 2. Scale by scaleX around origin
 * 3. Rotate by rotation around origin
 * 4. Translate by insertX/insertY (move to insertion point)
 *
 * @param def - The block definition to transform
 * @param ref - The block reference providing insertion point, scale, rotation
 * @param allDefinitions - All known block definitions (needed to resolve nested refs)
 * @param visitedIds - Set of definition IDs already in the call stack (circular ref guard)
 * @param depth - Current recursion depth
 */
export function getTransformedBlockEntities(
  def: BlockDefinition,
  ref: BlockReferenceEntity,
  allDefinitions: BlockDefinition[] = [],
  visitedIds: Set<string> = new Set(),
  depth: number = 0,
): CADEntity[] {
  // Circular reference / depth guard
  if (depth > MAX_NESTING_DEPTH || visitedIds.has(def.id)) {
    return [];
  }

  const visited = new Set(visitedIds);
  visited.add(def.id);

  const { basePoint } = def;
  const { insertX, insertY, scaleX, rotation } = ref;

  const result: CADEntity[] = [];

  def.entities.forEach((entity, index) => {
    if (entity.type === 'block_ref') {
      // Nested block reference: resolve recursively
      const nestedRef = entity as BlockReferenceEntity;
      const nestedDef = allDefinitions.find(d => d.id === nestedRef.blockDefId);
      if (!nestedDef) return; // skip orphaned refs

      // Get the nested block's primitive entities in its own local space
      const nestedPrimitives = getTransformedBlockEntities(
        nestedDef,
        nestedRef,
        allDefinitions,
        visited,
        depth + 1,
      );

      // Apply the outer block ref's transform to each nested primitive
      for (let i = 0; i < nestedPrimitives.length; i++) {
        let e: CADEntity = { ...nestedPrimitives[i], id: `${ref.id}_child_${index}_n${i}` };

        // Apply outer transform: -basePoint → scale → rotate → +insertPoint
        e = translateEntity(e, -basePoint.x, -basePoint.y);
        e = scaleEntity(e, { x: 0, y: 0 }, scaleX);
        if (rotation !== 0) {
          e = rotateEntity(e, { x: 0, y: 0 }, rotation);
        }
        e = translateEntity(e, insertX, insertY);

        result.push(e);
      }
    } else {
      // Primitive entity: apply standard transform
      let e: CADEntity = { ...entity, id: `${ref.id}_child_${index}` };

      e = translateEntity(e, -basePoint.x, -basePoint.y);
      e = scaleEntity(e, { x: 0, y: 0 }, scaleX);
      if (rotation !== 0) {
        e = rotateEntity(e, { x: 0, y: 0 }, rotation);
      }
      e = translateEntity(e, insertX, insertY);

      result.push(e);
    }
  });

  return result;
}

/**
 * Get the bounding box of a block reference's transformed entities.
 * Supports nested blocks via allDefinitions.
 * Returns null if the block definition has no entities.
 */
export function getBlockRefBounds(
  def: BlockDefinition,
  ref: BlockReferenceEntity,
  allDefinitions: BlockDefinition[] = [],
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  const entities = getTransformedBlockEntities(def, ref, allDefinitions);
  if (entities.length === 0) return null;

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  for (const e of entities) {
    switch (e.type) {
      case 'line': {
        const l = e as Extract<CADEntity, { type: 'line' }>;
        minX = Math.min(minX, l.x1, l.x2);
        maxX = Math.max(maxX, l.x1, l.x2);
        minY = Math.min(minY, l.y1, l.y2);
        maxY = Math.max(maxY, l.y1, l.y2);
        break;
      }
      case 'circle': {
        const c = e as Extract<CADEntity, { type: 'circle' }>;
        minX = Math.min(minX, c.cx - c.radius);
        maxX = Math.max(maxX, c.cx + c.radius);
        minY = Math.min(minY, c.cy - c.radius);
        maxY = Math.max(maxY, c.cy + c.radius);
        break;
      }
      case 'arc': {
        const a = e as Extract<CADEntity, { type: 'arc' }>;
        minX = Math.min(minX, a.cx - a.radius);
        maxX = Math.max(maxX, a.cx + a.radius);
        minY = Math.min(minY, a.cy - a.radius);
        maxY = Math.max(maxY, a.cy + a.radius);
        break;
      }
      case 'rectangle': {
        const r = e as Extract<CADEntity, { type: 'rectangle' }>;
        minX = Math.min(minX, r.x);
        maxX = Math.max(maxX, r.x + r.width);
        minY = Math.min(minY, r.y);
        maxY = Math.max(maxY, r.y + r.height);
        break;
      }
      case 'polyline': {
        const p = e as Extract<CADEntity, { type: 'polyline' }>;
        for (const pt of p.points) {
          minX = Math.min(minX, pt.x);
          maxX = Math.max(maxX, pt.x);
          minY = Math.min(minY, pt.y);
          maxY = Math.max(maxY, pt.y);
        }
        break;
      }
      case 'ellipse': {
        const el = e as Extract<CADEntity, { type: 'ellipse' }>;
        minX = Math.min(minX, el.cx - el.rx);
        maxX = Math.max(maxX, el.cx + el.rx);
        minY = Math.min(minY, el.cy - el.ry);
        maxY = Math.max(maxY, el.cy + el.ry);
        break;
      }
      case 'text': {
        const t = e as Extract<CADEntity, { type: 'text' }>;
        minX = Math.min(minX, t.x);
        maxX = Math.max(maxX, t.x);
        minY = Math.min(minY, t.y);
        maxY = Math.max(maxY, t.y);
        break;
      }
      case 'dimension': {
        const d = e as Extract<CADEntity, { type: 'dimension' }>;
        minX = Math.min(minX, d.x1, d.x2);
        maxX = Math.max(maxX, d.x1, d.x2);
        minY = Math.min(minY, d.y1, d.y2);
        maxY = Math.max(maxY, d.y1, d.y2);
        break;
      }
    }
  }

  return { minX, minY, maxX, maxY };
}
