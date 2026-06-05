/**
 * @module intersection
 *
 * 2D intersection solver for moCAD.
 *
 * Provides pure-functional routines to compute intersection points between
 * every supported pair of CAD entity types, plus utilities for splitting
 * entities at intersection points.
 *
 * All angles are in **radians**. The tolerance constant `EPSILON` guards
 * against floating-point noise in every comparison.
 */

import type {
  CADEntity,
  LineEntity,
  CircleEntity,
  ArcEntity,
  RectangleEntity,
  PolylineEntity,
  EllipseEntity,
} from "./entities.ts";

// ────────────────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────────────────

/** Floating-point comparison tolerance. */
const EPSILON = 1e-10;

const TWO_PI = 2 * Math.PI;

// ────────────────────────────────────────────────────────────────────────────
// Geometry primitives
// ────────────────────────────────────────────────────────────────────────────

/** A simple 2-D point. */
export interface Point {
  x: number;
  y: number;
}

/** Result from an intersection query, enriched with the parametric position. */
export interface IntersectionResult {
  /** The intersection point in world coordinates. */
  point: Point;
  /** Id of the *other* entity that was intersected. */
  entityId: string;
  /** Parametric position along the *source* entity (see module docs). */
  t: number;
}

// ────────────────────────────────────────────────────────────────────────────
// Low-level helpers
// ────────────────────────────────────────────────────────────────────────────

/** Euclidean distance between two points. */
function dist(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Normalise an angle into the range [0, 2π).
 */
function normalizeAngle(a: number): number {
  let r = a % TWO_PI;
  if (r < 0) r += TWO_PI;
  return r;
}

/**
 * Check whether angle `a` lies within the arc span from `start` to `end`
 * (counter-clockwise). All angles must already be normalised to [0, 2π).
 */
function angleInArcRange(
  a: number,
  start: number,
  end: number
): boolean {
  const na = normalizeAngle(a);
  const ns = normalizeAngle(start);
  const ne = normalizeAngle(end);

  if (ns <= ne) {
    // Simple case: arc doesn't wrap around 0
    return na >= ns - EPSILON && na <= ne + EPSILON;
  }
  // Arc wraps around 0
  return na >= ns - EPSILON || na <= ne + EPSILON;
}

/**
 * Compute the `t` parameter of point `p` on the segment from `a` to `b`.
 *
 * Returns a value in (-∞, +∞); the caller should clamp / check [0, 1].
 * If the segment is degenerate (a ≈ b), returns 0.
 */
function paramOnSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < EPSILON * EPSILON) return 0;
  return ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
}

// ────────────────────────────────────────────────────────────────────────────
// Primitive intersection functions
// ────────────────────────────────────────────────────────────────────────────

/**
 * Intersect two line **segments** (p1→p2) and (p3→p4).
 *
 * Returns the intersection point if the two segments cross, or `null` when
 * the lines are parallel / the crossing is outside the segment bounds.
 */
function lineLineIntersection(
  p1: Point,
  p2: Point,
  p3: Point,
  p4: Point
): { point: Point; t: number; u: number } | null {
  const d =
    (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);

  if (Math.abs(d) < EPSILON) return null; // parallel or coincident

  const t =
    ((p3.x - p1.x) * (p4.y - p3.y) - (p3.y - p1.y) * (p4.x - p3.x)) / d;
  const u =
    ((p3.x - p1.x) * (p2.y - p1.y) - (p3.y - p1.y) * (p2.x - p1.x)) / d;

  if (t < -EPSILON || t > 1 + EPSILON || u < -EPSILON || u > 1 + EPSILON) {
    return null;
  }

  return {
    point: {
      x: p1.x + t * (p2.x - p1.x),
      y: p1.y + t * (p2.y - p1.y),
    },
    t: Math.max(0, Math.min(1, t)),
    u: Math.max(0, Math.min(1, u)),
  };
}

/**
 * Intersect a line **segment** (p1→p2) with a circle centred at (cx, cy)
 * with radius `r`.
 *
 * Returns 0, 1 or 2 intersection points that lie on the segment.
 */
function lineCircleIntersection(
  p1: Point,
  p2: Point,
  cx: number,
  cy: number,
  r: number
): { point: Point; t: number }[] {
  // Translate so circle is at origin
  const x1 = p1.x - cx;
  const y1 = p1.y - cy;
  const x2 = p2.x - cx;
  const y2 = p2.y - cy;

  const dx = x2 - x1;
  const dy = y2 - y1;

  const a = dx * dx + dy * dy;
  if (a < EPSILON * EPSILON) return []; // degenerate segment

  const b = 2 * (x1 * dx + y1 * dy);
  const c = x1 * x1 + y1 * y1 - r * r;
  const disc = b * b - 4 * a * c;

  if (disc < -EPSILON) return [];

  const results: { point: Point; t: number }[] = [];
  const sqrtDisc = Math.sqrt(Math.max(0, disc));

  const tValues = [(-b - sqrtDisc) / (2 * a), (-b + sqrtDisc) / (2 * a)];

  // Deduplicate when discriminant ≈ 0
  const uniqueT =
    Math.abs(tValues[0] - tValues[1]) < EPSILON
      ? [tValues[0]]
      : tValues;

  for (const t of uniqueT) {
    if (t >= -EPSILON && t <= 1 + EPSILON) {
      const ct = Math.max(0, Math.min(1, t));
      results.push({
        point: {
          x: p1.x + ct * (p2.x - p1.x),
          y: p1.y + ct * (p2.y - p1.y),
        },
        t: ct,
      });
    }
  }

  return results;
}

/**
 * Intersect a line **segment** (p1→p2) with an axis-aligned ellipse centred
 * at (cx, cy) with semi-axes rx, ry rotated by `rotation` radians.
 *
 * Strategy: transform everything so the ellipse becomes a unit circle, run
 * line-circle, then inverse-transform the results.
 */
function lineEllipseIntersection(
  p1: Point,
  p2: Point,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  rotation: number
): { point: Point; t: number }[] {
  const cosR = Math.cos(-rotation);
  const sinR = Math.sin(-rotation);

  // Transform a point: translate → rotate → scale
  const xform = (p: Point): Point => {
    const tx = p.x - cx;
    const ty = p.y - cy;
    const rx2 = tx * cosR - ty * sinR;
    const ry2 = tx * sinR + ty * cosR;
    return { x: rx2 / rx, y: ry2 / ry };
  };

  // Inverse transform a point (unit circle → world)
  const cosR2 = Math.cos(rotation);
  const sinR2 = Math.sin(rotation);
  const invXform = (p: Point): Point => {
    const sx = p.x * rx;
    const sy = p.y * ry;
    return {
      x: sx * cosR2 - sy * sinR2 + cx,
      y: sx * sinR2 + sy * cosR2 + cy,
    };
  };

  const tp1 = xform(p1);
  const tp2 = xform(p2);

  // In the transformed space the ellipse is a unit circle at origin
  const hits = lineCircleIntersection(tp1, tp2, 0, 0, 1);

  return hits.map((h) => ({
    point: invXform(h.point),
    t: h.t,
  }));
}

/**
 * Intersect two circles.
 *
 * Returns 0, 1 or 2 intersection points.
 */
function circleCircleIntersection(
  cx1: number,
  cy1: number,
  r1: number,
  cx2: number,
  cy2: number,
  r2: number
): Point[] {
  const dx = cx2 - cx1;
  const dy = cy2 - cy1;
  const d = Math.sqrt(dx * dx + dy * dy);

  // No intersection cases
  if (d > r1 + r2 + EPSILON) return []; // too far apart
  if (d < Math.abs(r1 - r2) - EPSILON) return []; // one inside the other
  if (d < EPSILON) return []; // concentric

  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const h2 = r1 * r1 - a * a;
  const h = Math.sqrt(Math.max(0, h2));

  const mx = cx1 + (a * dx) / d;
  const my = cy1 + (a * dy) / d;

  if (h < EPSILON) {
    // Tangent (single point)
    return [{ x: mx, y: my }];
  }

  const ox = (h * dy) / d;
  const oy = (h * dx) / d;

  return [
    { x: mx + ox, y: my - oy },
    { x: mx - ox, y: my + oy },
  ];
}

/**
 * Intersect a circle with an ellipse.
 *
 * Strategy: transform the space so the ellipse becomes a unit circle,
 * then the original circle becomes an ellipse in the transformed space.
 * We sample-search the transformed ellipse for intersections with the
 * unit circle numerically via Newton refinement.
 */
function circleEllipseIntersection(
  cx1: number,
  cy1: number,
  r1: number,
  cx2: number,
  cy2: number,
  rx2: number,
  ry2: number,
  rotation2: number
): Point[] {
  // We'll use a numerical approach:
  // Sample points on the circle and check signed distance to the ellipse,
  // then refine sign changes with bisection.
  const results: Point[] = [];

  // Signed distance of a point to the ellipse (positive outside)
  const ellipseDist = (p: Point): number => {
    const cosR = Math.cos(-rotation2);
    const sinR = Math.sin(-rotation2);
    const tx = p.x - cx2;
    const ty = p.y - cy2;
    const lx = (tx * cosR - ty * sinR) / rx2;
    const ly = (tx * sinR + ty * cosR) / ry2;
    return lx * lx + ly * ly - 1;
  };

  const N = 360;
  const step = TWO_PI / N;

  for (let i = 0; i < N; i++) {
    const a1 = i * step;
    const a2 = (i + 1) * step;

    const p1: Point = { x: cx1 + r1 * Math.cos(a1), y: cy1 + r1 * Math.sin(a1) };
    const p2: Point = { x: cx1 + r1 * Math.cos(a2), y: cy1 + r1 * Math.sin(a2) };

    const d1 = ellipseDist(p1);
    const d2 = ellipseDist(p2);

    if (d1 * d2 > 0) continue; // no sign change

    // Bisection to refine
    let lo = a1;
    let hi = a2;
    for (let j = 0; j < 50; j++) {
      const mid = (lo + hi) / 2;
      const pm: Point = { x: cx1 + r1 * Math.cos(mid), y: cy1 + r1 * Math.sin(mid) };
      const dm = ellipseDist(pm);
      if (Math.abs(dm) < EPSILON * EPSILON) break;
      if (dm * d1 < 0) {
        hi = mid;
      } else {
        lo = mid;
      }
    }

    const finalAngle = (lo + hi) / 2;
    const fp: Point = {
      x: cx1 + r1 * Math.cos(finalAngle),
      y: cy1 + r1 * Math.sin(finalAngle),
    };

    // Deduplicate
    if (!results.some((r) => dist(r, fp) < EPSILON * 100)) {
      results.push(fp);
    }
  }

  return results;
}

/**
 * Intersect two ellipses numerically.
 *
 * Samples points on ellipse A and checks signed distance to ellipse B,
 * then bisects sign changes.
 */
function ellipseEllipseIntersection(
  cx1: number,
  cy1: number,
  rx1: number,
  ry1: number,
  rot1: number,
  cx2: number,
  cy2: number,
  rx2: number,
  ry2: number,
  rot2: number
): Point[] {
  const results: Point[] = [];

  const ellipsePoint = (
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    rot: number,
    angle: number
  ): Point => {
    const cosR = Math.cos(rot);
    const sinR = Math.sin(rot);
    const lx = rx * Math.cos(angle);
    const ly = ry * Math.sin(angle);
    return {
      x: cx + lx * cosR - ly * sinR,
      y: cy + lx * sinR + ly * cosR,
    };
  };

  const ellipseDist = (p: Point): number => {
    const cosR = Math.cos(-rot2);
    const sinR = Math.sin(-rot2);
    const tx = p.x - cx2;
    const ty = p.y - cy2;
    const lx = (tx * cosR - ty * sinR) / rx2;
    const ly = (tx * sinR + ty * cosR) / ry2;
    return lx * lx + ly * ly - 1;
  };

  const N = 720;
  const step = TWO_PI / N;

  for (let i = 0; i < N; i++) {
    const a1 = i * step;
    const a2 = (i + 1) * step;

    const p1 = ellipsePoint(cx1, cy1, rx1, ry1, rot1, a1);
    const p2 = ellipsePoint(cx1, cy1, rx1, ry1, rot1, a2);

    const d1 = ellipseDist(p1);
    const d2 = ellipseDist(p2);

    if (d1 * d2 > 0) continue;

    let lo = a1;
    let hi = a2;
    const dLo = d1;
    for (let j = 0; j < 50; j++) {
      const mid = (lo + hi) / 2;
      const pm = ellipsePoint(cx1, cy1, rx1, ry1, rot1, mid);
      const dm = ellipseDist(pm);
      if (Math.abs(dm) < EPSILON * EPSILON) break;
      if (dm * dLo < 0) {
        hi = mid;
      } else {
        lo = mid;
      }
    }

    const finalAngle = (lo + hi) / 2;
    const fp = ellipsePoint(cx1, cy1, rx1, ry1, rot1, finalAngle);

    if (!results.some((r) => dist(r, fp) < EPSILON * 100)) {
      results.push(fp);
    }
  }

  return results;
}

// ────────────────────────────────────────────────────────────────────────────
// Entity → primitive decomposition
// ────────────────────────────────────────────────────────────────────────────

/** A directed line segment primitive. */
interface Segment {
  p1: Point;
  p2: Point;
  /** Index of this segment within the parent entity (for `t` computation). */
  segIndex: number;
}

/**
 * Decompose a CADEntity into line segments.
 * Returns `null` for entities that are *not* segment-based (circles,
 * arcs, ellipses) and for non-geometric entities (text, dimension).
 */
function entityToSegments(entity: CADEntity): Segment[] | null {
  switch (entity.type) {
    case "line":
      return [
        {
          p1: { x: entity.x1, y: entity.y1 },
          p2: { x: entity.x2, y: entity.y2 },
          segIndex: 0,
        },
      ];

    case "rectangle": {
      const { x, y, width, height } = entity;
      const corners: Point[] = [
        { x, y },
        { x: x + width, y },
        { x: x + width, y: y + height },
        { x, y: y + height },
      ];
      return corners.map((c, i) => ({
        p1: c,
        p2: corners[(i + 1) % 4],
        segIndex: i,
      }));
    }

    case "polyline": {
      const segs: Segment[] = [];
      const pts = entity.points;
      const n = entity.closed ? pts.length : pts.length - 1;
      for (let i = 0; i < n; i++) {
        segs.push({
          p1: pts[i],
          p2: pts[(i + 1) % pts.length],
          segIndex: i,
        });
      }
      return segs;
    }

    case "circle":
    case "arc":
    case "ellipse":
      return null; // curved primitives handled separately

    case "dimension":
    case "text":
      return null; // non-geometric
  }
}

/**
 * Check if a CADEntity is geometric (i.e. can participate in intersections).
 */
function isGeometric(entity: CADEntity): boolean {
  return entity.type !== "dimension" && entity.type !== "text";
}

// ────────────────────────────────────────────────────────────────────────────
// Segment ↔ curved entity intersection helpers
// ────────────────────────────────────────────────────────────────────────────

/** Intersect a segment with a full circle, returning only on-segment hits. */
function segmentCircle(
  seg: Segment,
  c: CircleEntity | ArcEntity
): { point: Point; tSeg: number; angle: number }[] {
  const hits = lineCircleIntersection(
    seg.p1,
    seg.p2,
    c.cx,
    c.cy,
    c.radius
  );

  return hits.map((h) => ({
    point: h.point,
    tSeg: h.t,
    angle: normalizeAngle(
      Math.atan2(h.point.y - c.cy, h.point.x - c.cx)
    ),
  }));
}

/** Intersect a segment with a full ellipse, returning only on-segment hits. */
function segmentEllipse(
  seg: Segment,
  e: EllipseEntity
): { point: Point; tSeg: number; angle: number }[] {
  const hits = lineEllipseIntersection(
    seg.p1,
    seg.p2,
    e.cx,
    e.cy,
    e.rx,
    e.ry,
    e.rotation
  );

  return hits.map((h) => {
    // Compute the ellipse angle for the hit
    const cosR = Math.cos(-e.rotation);
    const sinR = Math.sin(-e.rotation);
    const tx = h.point.x - e.cx;
    const ty = h.point.y - e.cy;
    const lx = tx * cosR - ty * sinR;
    const ly = tx * sinR + ty * cosR;
    const angle = normalizeAngle(Math.atan2(ly / e.ry, lx / e.rx));

    return { point: h.point, tSeg: h.t, angle };
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Core: pairwise entity intersection
// ────────────────────────────────────────────────────────────────────────────

/**
 * Internal result carrying parametric positions on *both* entities.
 */
interface RawHit {
  point: Point;
  tA: number; // parameter on entity A
  tB: number; // parameter on entity B
}

/**
 * Compute `t` for a point on a curved entity.
 */
function curvedT(
  entity: CircleEntity | ArcEntity | EllipseEntity,
  point: Point
): number {
  if (entity.type === "ellipse") {
    const cosR = Math.cos(-entity.rotation);
    const sinR = Math.sin(-entity.rotation);
    const tx = point.x - entity.cx;
    const ty = point.y - entity.cy;
    const lx = tx * cosR - ty * sinR;
    const ly = tx * sinR + ty * cosR;
    return normalizeAngle(Math.atan2(ly / entity.ry, lx / entity.rx));
  }
  return normalizeAngle(
    Math.atan2(point.y - entity.cy, point.x - entity.cx)
  );
}

/**
 * Deduplicate points that are within EPSILON of each other.
 */
function dedup(hits: RawHit[]): RawHit[] {
  const out: RawHit[] = [];
  for (const h of hits) {
    if (!out.some((o) => dist(o.point, h.point) < EPSILON * 100)) {
      out.push(h);
    }
  }
  return out;
}

/**
 * Intersect segments-of-A with segments-of-B.
 */
function segsVsSegs(
  segsA: Segment[],
  segsB: Segment[]
): RawHit[] {
  const hits: RawHit[] = [];
  for (const sa of segsA) {
    for (const sb of segsB) {
      const r = lineLineIntersection(sa.p1, sa.p2, sb.p1, sb.p2);
      if (r) {
        hits.push({
          point: r.point,
          tA: sa.segIndex + r.t,
          tB: sb.segIndex + r.u,
        });
      }
    }
  }
  return hits;
}

/**
 * Intersect segments-of-A with a circle/arc B.
 */
function segsVsCircle(
  segs: Segment[],
  circ: CircleEntity | ArcEntity,
  isArc: boolean
): RawHit[] {
  const hits: RawHit[] = [];
  for (const seg of segs) {
    const rawHits = segmentCircle(seg, circ);
    for (const h of rawHits) {
      if (isArc) {
        const arc = circ as ArcEntity;
        if (!angleInArcRange(h.angle, arc.startAngle, arc.endAngle)) {
          continue;
        }
      }
      hits.push({
        point: h.point,
        tA: seg.segIndex + h.tSeg,
        tB: h.angle,
      });
    }
  }
  return hits;
}

/**
 * Intersect segments-of-A with an ellipse B.
 */
function segsVsEllipse(
  segs: Segment[],
  ell: EllipseEntity
): RawHit[] {
  const hits: RawHit[] = [];
  for (const seg of segs) {
    const rawHits = segmentEllipse(seg, ell);
    for (const h of rawHits) {
      hits.push({
        point: h.point,
        tA: seg.segIndex + h.tSeg,
        tB: h.angle,
      });
    }
  }
  return hits;
}

/**
 * Intersect circle/arc A with circle/arc B.
 */
function circVsCirc(
  a: CircleEntity | ArcEntity,
  b: CircleEntity | ArcEntity
): RawHit[] {
  const pts = circleCircleIntersection(
    a.cx,
    a.cy,
    a.radius,
    b.cx,
    b.cy,
    b.radius
  );

  const hits: RawHit[] = [];
  for (const p of pts) {
    const angleA = normalizeAngle(Math.atan2(p.y - a.cy, p.x - a.cx));
    const angleB = normalizeAngle(Math.atan2(p.y - b.cy, p.x - b.cx));

    if (a.type === "arc" && !angleInArcRange(angleA, a.startAngle, a.endAngle)) {
      continue;
    }
    if (b.type === "arc" && !angleInArcRange(angleB, b.startAngle, b.endAngle)) {
      continue;
    }

    hits.push({ point: p, tA: angleA, tB: angleB });
  }
  return hits;
}

/**
 * Intersect a circle/arc A with an ellipse B.
 */
function circVsEllipse(
  circ: CircleEntity | ArcEntity,
  ell: EllipseEntity
): RawHit[] {
  const pts = circleEllipseIntersection(
    circ.cx,
    circ.cy,
    circ.radius,
    ell.cx,
    ell.cy,
    ell.rx,
    ell.ry,
    ell.rotation
  );

  const hits: RawHit[] = [];
  for (const p of pts) {
    const angleA = normalizeAngle(Math.atan2(p.y - circ.cy, p.x - circ.cx));

    if (circ.type === "arc" && !angleInArcRange(angleA, circ.startAngle, circ.endAngle)) {
      continue;
    }

    hits.push({
      point: p,
      tA: angleA,
      tB: curvedT(ell, p),
    });
  }
  return hits;
}

/**
 * Intersect two ellipses.
 */
function ellVsEll(
  a: EllipseEntity,
  b: EllipseEntity
): RawHit[] {
  const pts = ellipseEllipseIntersection(
    a.cx,
    a.cy,
    a.rx,
    a.ry,
    a.rotation,
    b.cx,
    b.cy,
    b.rx,
    b.ry,
    b.rotation
  );

  return pts.map((p) => ({
    point: p,
    tA: curvedT(a, p),
    tB: curvedT(b, p),
  }));
}

/**
 * Compute the `t` parameter for a point along `entity`.
 *
 * - **Line**: 0 at (x1,y1), 1 at (x2,y2).
 * - **Circle / Arc**: angle of intersection point (radians, [0, 2π)).
 * - **Polyline**: segmentIndex + fractionAlongSegment.
 * - **Rectangle**: edgeIndex + fractionAlongEdge.
 * - **Ellipse**: angle of intersection point in ellipse-local frame.
 */
function computeT(entity: CADEntity, point: Point): number {
  switch (entity.type) {
    case "line":
      return paramOnSegment(
        point,
        { x: entity.x1, y: entity.y1 },
        { x: entity.x2, y: entity.y2 }
      );

    case "circle":
    case "arc":
      return normalizeAngle(
        Math.atan2(point.y - entity.cy, point.x - entity.cx)
      );

    case "ellipse":
      return curvedT(entity, point);

    case "rectangle": {
      const segs = entityToSegments(entity)!;
      let bestT = 0;
      let bestDist = Infinity;
      for (const seg of segs) {
        const t = paramOnSegment(point, seg.p1, seg.p2);
        const ct = Math.max(0, Math.min(1, t));
        const proj: Point = {
          x: seg.p1.x + ct * (seg.p2.x - seg.p1.x),
          y: seg.p1.y + ct * (seg.p2.y - seg.p1.y),
        };
        const d = dist(point, proj);
        if (d < bestDist) {
          bestDist = d;
          bestT = seg.segIndex + ct;
        }
      }
      return bestT;
    }

    case "polyline": {
      const segs = entityToSegments(entity)!;
      let bestT = 0;
      let bestDist = Infinity;
      for (const seg of segs) {
        const t = paramOnSegment(point, seg.p1, seg.p2);
        const ct = Math.max(0, Math.min(1, t));
        const proj: Point = {
          x: seg.p1.x + ct * (seg.p2.x - seg.p1.x),
          y: seg.p1.y + ct * (seg.p2.y - seg.p1.y),
        };
        const d = dist(point, proj);
        if (d < bestDist) {
          bestDist = d;
          bestT = seg.segIndex + ct;
        }
      }
      return bestT;
    }

    default:
      return 0;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────────────────────

/**
 * Find all intersection points between two CAD entities.
 *
 * Non-geometric entities (text, dimension) always return `[]`.
 *
 * @param entityA - First entity
 * @param entityB - Second entity
 * @returns Array of intersection points (may be empty)
 */
export function findIntersections(
  entityA: CADEntity,
  entityB: CADEntity
): Point[] {
  if (!isGeometric(entityA) || !isGeometric(entityB)) return [];

  const rawHits = computeRawHits(entityA, entityB);
  return dedup(rawHits).map((h) => h.point);
}

/**
 * Find all intersections of `entity` against every other entity in
 * `allEntities`, returning enriched results with `entityId` and `t`.
 *
 * @param entity      - The source entity
 * @param allEntities - All entities in the scene (including `entity` itself)
 * @returns Intersection results with the id of the other entity and the `t`
 *          parameter along the source entity.
 */
export function findAllIntersections(
  entity: CADEntity,
  allEntities: CADEntity[]
): IntersectionResult[] {
  if (!isGeometric(entity)) return [];

  const results: IntersectionResult[] = [];

  for (const other of allEntities) {
    if (other.id === entity.id) continue;
    if (!isGeometric(other)) continue;

    const rawHits = dedup(computeRawHits(entity, other));
    for (const hit of rawHits) {
      results.push({
        point: hit.point,
        entityId: other.id,
        t: hit.tA,
      });
    }
  }

  return results;
}

/**
 * Internal dispatcher that routes to the appropriate primitive intersection
 * function based on the types of the two entities.
 */
function computeRawHits(a: CADEntity, b: CADEntity): RawHit[] {
  const segsA = entityToSegments(a);
  const segsB = entityToSegments(b);

  // ── Both segment-based ──────────────────────────────────────────────
  if (segsA && segsB) {
    return segsVsSegs(segsA, segsB);
  }

  // ── A is segment-based, B is curved ─────────────────────────────────
  if (segsA && !segsB) {
    if (b.type === "circle" || b.type === "arc") {
      return segsVsCircle(segsA, b, b.type === "arc");
    }
    if (b.type === "ellipse") {
      return segsVsEllipse(segsA, b);
    }
  }

  // ── B is segment-based, A is curved ─────────────────────────────────
  if (!segsA && segsB) {
    if (a.type === "circle" || a.type === "arc") {
      // Swap roles so the segment is always first, then flip tA/tB
      const hits = segsVsCircle(segsB, a, a.type === "arc");
      return hits.map((h) => ({ point: h.point, tA: h.tB, tB: h.tA }));
    }
    if (a.type === "ellipse") {
      const hits = segsVsEllipse(segsB, a);
      return hits.map((h) => ({ point: h.point, tA: h.tB, tB: h.tA }));
    }
  }

  // ── Both curved ─────────────────────────────────────────────────────
  // Circle/Arc vs Circle/Arc
  if (
    (a.type === "circle" || a.type === "arc") &&
    (b.type === "circle" || b.type === "arc")
  ) {
    return circVsCirc(a, b);
  }

  // Circle/Arc vs Ellipse
  if (
    (a.type === "circle" || a.type === "arc") &&
    b.type === "ellipse"
  ) {
    return circVsEllipse(a, b);
  }

  // Ellipse vs Circle/Arc (swap)
  if (
    a.type === "ellipse" &&
    (b.type === "circle" || b.type === "arc")
  ) {
    const hits = circVsEllipse(b, a);
    return hits.map((h) => ({ point: h.point, tA: h.tB, tB: h.tA }));
  }

  // Ellipse vs Ellipse
  if (a.type === "ellipse" && b.type === "ellipse") {
    return ellVsEll(a, b);
  }

  return [];
}

// ────────────────────────────────────────────────────────────────────────────
// Entity splitting
// ────────────────────────────────────────────────────────────────────────────

/**
 * Split a CAD entity into sub-entities at the given intersection points.
 *
 * The new entities inherit all visual properties (layer, colour, line width)
 * from the original. Their ids follow the pattern `${original.id}_split_${i}`.
 *
 * @param entity - The entity to split
 * @param points - Intersection points where splits should occur
 * @returns An array of new entities (length ≥ 1). If no valid split points
 *          lie on the entity, the original entity is returned unchanged.
 */
export function splitEntityAtPoints(
  entity: CADEntity,
  points: Point[]
): CADEntity[] {
  if (points.length === 0) return [entity];

  switch (entity.type) {
    case "line":
      return splitLine(entity, points);
    case "arc":
      return splitArc(entity, points);
    case "circle":
      return splitCircle(entity, points);
    case "polyline":
      return splitPolyline(entity, points);
    case "rectangle":
      return splitRectangle(entity, points);
    case "ellipse":
      return splitEllipse(entity, points);
    default:
      return [entity]; // text, dimension — not splittable
  }
}

// ── Split helpers ──────────────────────────────────────────────────────────

/** Copy base properties from a source entity. */
function baseProps(src: CADEntity, index: number) {
  return {
    id: `${src.id}_split_${index}`,
    layerId: src.layerId,
    color: src.color,
    lineWidth: src.lineWidth,
  } as const;
}

/** Split a line at intersection points. */
function splitLine(
  line: LineEntity,
  points: Point[]
): CADEntity[] {
  const p1: Point = { x: line.x1, y: line.y1 };
  const p2: Point = { x: line.x2, y: line.y2 };

  // Compute t for each point along the line and filter to [0, 1]
  const tValues = points
    .map((p) => paramOnSegment(p, p1, p2))
    .filter((t) => t > EPSILON && t < 1 - EPSILON)
    .sort((a, b) => a - b);

  if (tValues.length === 0) return [line];

  // Deduplicate close t values
  const uniqueT = [tValues[0]];
  for (let i = 1; i < tValues.length; i++) {
    if (tValues[i] - uniqueT[uniqueT.length - 1] > EPSILON * 100) {
      uniqueT.push(tValues[i]);
    }
  }

  const result: CADEntity[] = [];
  let prevPoint = p1;

  for (let i = 0; i < uniqueT.length; i++) {
    const splitPt: Point = {
      x: p1.x + uniqueT[i] * (p2.x - p1.x),
      y: p1.y + uniqueT[i] * (p2.y - p1.y),
    };
    result.push({
      ...baseProps(line, i),
      type: "line",
      x1: prevPoint.x,
      y1: prevPoint.y,
      x2: splitPt.x,
      y2: splitPt.y,
    });
    prevPoint = splitPt;
  }

  // Final segment
  result.push({
    ...baseProps(line, uniqueT.length),
    type: "line",
    x1: prevPoint.x,
    y1: prevPoint.y,
    x2: p2.x,
    y2: p2.y,
  });

  return result;
}

/** Split an arc at intersection angles. */
function splitArc(
  arc: ArcEntity,
  points: Point[]
): CADEntity[] {
  const angles = points
    .map((p) =>
      normalizeAngle(Math.atan2(p.y - arc.cy, p.x - arc.cx))
    )
    .filter((a) => angleInArcRange(a, arc.startAngle, arc.endAngle));

  if (angles.length === 0) return [arc];

  // Sort angles relative to arc start
  const start = normalizeAngle(arc.startAngle);
  const sortedAngles = angles
    .map((a) => {
      const diff = normalizeAngle(a - start);
      return { angle: a, offset: diff };
    })
    .sort((a, b) => a.offset - b.offset)
    .map((a) => a.angle);

  // Deduplicate
  const unique = [sortedAngles[0]];
  for (let i = 1; i < sortedAngles.length; i++) {
    const diff = Math.abs(normalizeAngle(sortedAngles[i] - unique[unique.length - 1]));
    if (diff > EPSILON * 100 && Math.abs(diff - TWO_PI) > EPSILON * 100) {
      unique.push(sortedAngles[i]);
    }
  }

  const result: CADEntity[] = [];
  let prevAngle = arc.startAngle;

  for (let i = 0; i < unique.length; i++) {
    result.push({
      ...baseProps(arc, i),
      type: "arc",
      cx: arc.cx,
      cy: arc.cy,
      radius: arc.radius,
      startAngle: prevAngle,
      endAngle: unique[i],
    });
    prevAngle = unique[i];
  }

  result.push({
    ...baseProps(arc, unique.length),
    type: "arc",
    cx: arc.cx,
    cy: arc.cy,
    radius: arc.radius,
    startAngle: prevAngle,
    endAngle: arc.endAngle,
  });

  return result;
}

/** Split a full circle at intersection points into arcs. */
function splitCircle(
  circle: CircleEntity,
  points: Point[]
): CADEntity[] {
  const angles = points
    .map((p) =>
      normalizeAngle(Math.atan2(p.y - circle.cy, p.x - circle.cx))
    )
    .sort((a, b) => a - b);

  if (angles.length === 0) return [circle];

  // Deduplicate
  const unique = [angles[0]];
  for (let i = 1; i < angles.length; i++) {
    if (angles[i] - unique[unique.length - 1] > EPSILON * 100) {
      unique.push(angles[i]);
    }
  }

  if (unique.length < 2) return [circle]; // need at least 2 points to split

  const result: CADEntity[] = [];
  for (let i = 0; i < unique.length; i++) {
    const startAngle = unique[i];
    const endAngle = unique[(i + 1) % unique.length];
    result.push({
      ...baseProps(circle, i),
      type: "arc",
      cx: circle.cx,
      cy: circle.cy,
      radius: circle.radius,
      startAngle,
      endAngle: i === unique.length - 1 ? endAngle + TWO_PI : endAngle,
    });
  }

  return result;
}

/** Split a polyline at intersection points. */
function splitPolyline(
  poly: PolylineEntity,
  points: Point[]
): CADEntity[] {
  const segs = entityToSegments(poly)!;

  // For each point, find the segment and t value
  interface SplitInfo {
    segIndex: number;
    t: number;
    point: Point;
  }

  const splits: SplitInfo[] = [];
  for (const pt of points) {
    let bestSeg = 0;
    let bestT = 0;
    let bestDist = Infinity;

    for (let i = 0; i < segs.length; i++) {
      const seg = segs[i];
      const t = paramOnSegment(pt, seg.p1, seg.p2);
      const ct = Math.max(0, Math.min(1, t));
      const proj: Point = {
        x: seg.p1.x + ct * (seg.p2.x - seg.p1.x),
        y: seg.p1.y + ct * (seg.p2.y - seg.p1.y),
      };
      const d = dist(pt, proj);
      if (d < bestDist) {
        bestDist = d;
        bestSeg = i;
        bestT = ct;
      }
    }

    // Only keep if the point actually lies on the polyline
    if (bestDist < EPSILON * 1000 && bestT > EPSILON && bestT < 1 - EPSILON) {
      splits.push({ segIndex: bestSeg, t: bestT, point: pt });
    }
  }

  if (splits.length === 0) return [poly];

  // Sort by segment index, then by t within segment
  splits.sort((a, b) =>
    a.segIndex !== b.segIndex
      ? a.segIndex - b.segIndex
      : a.t - b.t
  );

  // Build split polylines
  const result: CADEntity[] = [];
  let currentPoints: Point[] = [poly.points[0]];
  let splitIdx = 0;
  let resultIdx = 0;

  for (let si = 0; si < segs.length; si++) {
    // Process splits on this segment
    while (splitIdx < splits.length && splits[splitIdx].segIndex === si) {
      currentPoints.push(splits[splitIdx].point);

      result.push({
        ...baseProps(poly, resultIdx++),
        type: "polyline",
        points: [...currentPoints],
        closed: false,
      });

      currentPoints = [splits[splitIdx].point];
      splitIdx++;
    }

    // Add segment endpoint
    currentPoints.push(segs[si].p2);
  }

  // Final polyline
  if (currentPoints.length >= 2) {
    result.push({
      ...baseProps(poly, resultIdx),
      type: "polyline",
      points: currentPoints,
      closed: false,
    });
  }

  return result.length > 0 ? result : [poly];
}

/** Split a rectangle by converting to a closed polyline first. */
function splitRectangle(
  rect: RectangleEntity,
  points: Point[]
): CADEntity[] {
  const { x, y, width, height } = rect;

  const polyline: PolylineEntity = {
    id: rect.id,
    type: "polyline",
    layerId: rect.layerId,
    color: rect.color,
    lineWidth: rect.lineWidth,
    closed: true,
    points: [
      { x, y },
      { x: x + width, y },
      { x: x + width, y: y + height },
      { x, y: y + height },
    ],
  };

  return splitPolyline(polyline, points);
}

/**
 * Split an ellipse at intersection points into arcs (approximated
 * as elliptical arcs using the ArcEntity type with a note that
 * downstream code may need to handle ellipse arcs specially).
 *
 * Since the entity model only has circular arcs, we return full
 * sub-ellipses as individual ellipse entities with angle ranges
 * stored in a simplified way. In practice, we convert to a polyline
 * approximation for splitting.
 */
function splitEllipse(
  ellipse: EllipseEntity,
  points: Point[]
): CADEntity[] {
  // Compute angles in ellipse-local frame
  const angles = points
    .map((p) => curvedT(ellipse, p))
    .sort((a, b) => a - b);

  if (angles.length === 0) return [ellipse];

  // Deduplicate
  const unique = [angles[0]];
  for (let i = 1; i < angles.length; i++) {
    if (angles[i] - unique[unique.length - 1] > EPSILON * 100) {
      unique.push(angles[i]);
    }
  }

  if (unique.length < 2) return [ellipse]; // need ≥ 2 to split

  // Approximate each arc segment as a polyline
  const result: CADEntity[] = [];
  const cosR = Math.cos(ellipse.rotation);
  const sinR = Math.sin(ellipse.rotation);

  const ellipsePoint = (angle: number): Point => {
    const lx = ellipse.rx * Math.cos(angle);
    const ly = ellipse.ry * Math.sin(angle);
    return {
      x: ellipse.cx + lx * cosR - ly * sinR,
      y: ellipse.cy + lx * sinR + ly * cosR,
    };
  };

  for (let i = 0; i < unique.length; i++) {
    const startAngle = unique[i];
    const endAngle =
      i < unique.length - 1 ? unique[i + 1] : unique[0] + TWO_PI;

    // Generate polyline approximation of this arc segment
    const pts: Point[] = [];
    const arcSpan =
      endAngle > startAngle
        ? endAngle - startAngle
        : endAngle - startAngle + TWO_PI;
    const steps = Math.max(8, Math.ceil(arcSpan * 32));

    for (let s = 0; s <= steps; s++) {
      const a = startAngle + (s / steps) * arcSpan;
      pts.push(ellipsePoint(a));
    }

    result.push({
      ...baseProps(ellipse, i),
      type: "polyline",
      points: pts,
      closed: false,
    });
  }

  return result;
}

// Re-export computeT for external use
export { computeT };
