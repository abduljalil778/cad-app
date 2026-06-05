/**
 * @module fillet
 *
 * Computes a fillet (rounded corner) between two line segments.
 *
 * Given two lines and a fillet radius, the algorithm:
 * 1. Extends both lines to infinite lines and finds their intersection.
 * 2. Computes the angle bisector direction.
 * 3. Locates the fillet arc centre at `r / sin(halfAngle)` from the
 *    intersection along the bisector.
 * 4. Projects the centre perpendicularly onto each line to find the
 *    tangent points.
 * 5. Trims both lines to the tangent points and returns the resulting
 *    arc.
 *
 * All angles are in **radians**.
 */

// ────────────────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────────────────

const EPSILON = 1e-10;

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

/** A simple line segment defined by two endpoints. */
export interface LineSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** The result of a fillet computation. */
export interface FilletResult {
  /** The trimmed first line segment. */
  line1: LineSegment;
  /** The trimmed second line segment. */
  line2: LineSegment;
  /** The fillet arc connecting the two trimmed endpoints. */
  arc: {
    cx: number;
    cy: number;
    radius: number;
    startAngle: number;
    endAngle: number;
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ────────────────────────────────────────────────────────────────────────────

interface Vec2 {
  x: number;
  y: number;
}

/** Dot product of two 2-D vectors. */
function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

/** 2-D cross product (z-component of the 3-D cross). */
function cross(a: Vec2, b: Vec2): number {
  return a.x * b.y - a.y * b.x;
}

/** Euclidean length of a 2-D vector. */
function length(v: Vec2): number {
  return Math.sqrt(v.x * v.x + v.y * v.y);
}

/** Return a unit-length vector, or {0,0} if input is degenerate. */
function normalise(v: Vec2): Vec2 {
  const len = length(v);
  if (len < EPSILON) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

/**
 * Intersect two **infinite** lines.
 *
 * Line 1: P + t·D1,  Line 2: Q + u·D2.
 *
 * Returns the intersection point or `null` if the lines are parallel.
 */
function infiniteLineIntersection(
  p: Vec2,
  d1: Vec2,
  q: Vec2,
  d2: Vec2
): Vec2 | null {
  const denom = cross(d1, d2);
  if (Math.abs(denom) < EPSILON) return null; // parallel

  const diff: Vec2 = { x: q.x - p.x, y: q.y - p.y };
  const t = cross(diff, d2) / denom;

  return { x: p.x + t * d1.x, y: p.y + t * d1.y };
}

/**
 * Project point `p` onto the infinite line through `a` in direction `d`.
 *
 * Returns the projected point and the parameter `t` such that
 * `projected = a + t * d`.
 */
function projectOntoLine(
  p: Vec2,
  a: Vec2,
  d: Vec2
): { projected: Vec2; t: number } {
  const len2 = dot(d, d);
  if (len2 < EPSILON * EPSILON) return { projected: a, t: 0 };

  const ap: Vec2 = { x: p.x - a.x, y: p.y - a.y };
  const t = dot(ap, d) / len2;

  return {
    projected: { x: a.x + t * d.x, y: a.y + t * d.y },
    t,
  };
}

/**
 * Normalise an angle to [0, 2π).
 */
function normalizeAngle(a: number): number {
  const TWO_PI = 2 * Math.PI;
  let r = a % TWO_PI;
  if (r < 0) r += TWO_PI;
  return r;
}

// ────────────────────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────────────────────

/**
 * Compute a fillet between two line segments.
 *
 * The fillet is placed at the side of the intersection where the two
 * nearest segment endpoints are.
 *
 * @param line1  - First line segment
 * @param line2  - Second line segment
 * @param radius - Fillet radius (must be > 0)
 * @returns A `FilletResult` containing the trimmed lines and fillet arc,
 *          or `null` if the fillet cannot be computed (parallel lines,
 *          zero radius, or radius too large).
 */
export function computeFillet(
  line1: LineSegment,
  line2: LineSegment,
  radius: number
): FilletResult | null {
  if (radius <= 0) return null;

  // ── 1. Direction vectors ──────────────────────────────────────────────
  const p1: Vec2 = { x: line1.x1, y: line1.y1 };
  const p2: Vec2 = { x: line1.x2, y: line1.y2 };
  const p3: Vec2 = { x: line2.x1, y: line2.y1 };
  const p4: Vec2 = { x: line2.x2, y: line2.y2 };

  const d1: Vec2 = { x: p2.x - p1.x, y: p2.y - p1.y };
  const d2: Vec2 = { x: p4.x - p3.x, y: p4.y - p3.y };

  const len1 = length(d1);
  const len2 = length(d2);
  if (len1 < EPSILON || len2 < EPSILON) return null; // degenerate segment

  // ── 2. Infinite-line intersection ─────────────────────────────────────
  const ix = infiniteLineIntersection(p1, d1, p3, d2);
  if (!ix) return null; // parallel lines

  // ── 3. Orient directions *away* from the intersection ─────────────────
  //    Choose the direction along each line such that the segment extends
  //    *away* from the intersection point. This ensures the fillet is
  //    placed on the "inner" side where the two segments meet.

  // For line 1: which endpoint is farther from ix?
  const t1_ix = dot({ x: ix.x - p1.x, y: ix.y - p1.y }, d1) / dot(d1, d1);
  // For line 2:
  const t2_ix = dot({ x: ix.x - p3.x, y: ix.y - p3.y }, d2) / dot(d2, d2);

  // Direction vectors pointing away from intersection along each segment
  let away1: Vec2;
  let segStart1: Vec2;
  let segEnd1: Vec2;

  if (t1_ix <= 0.5) {
    // Intersection is near p1 → the segment extends towards p2
    away1 = normalise(d1);
    segStart1 = p1;
    segEnd1 = p2;
  } else {
    // Intersection is near p2 → segment extends towards p1
    away1 = normalise({ x: -d1.x, y: -d1.y });
    segStart1 = p2;
    segEnd1 = p1;
  }

  let away2: Vec2;
  let segStart2: Vec2;
  let segEnd2: Vec2;

  if (t2_ix <= 0.5) {
    away2 = normalise(d2);
    segStart2 = p3;
    segEnd2 = p4;
  } else {
    away2 = normalise({ x: -d2.x, y: -d2.y });
    segStart2 = p4;
    segEnd2 = p3;
  }

  // ── 4. Half-angle and fillet centre ───────────────────────────────────
  const cosAngle = dot(away1, away2);
  const halfAngle = Math.acos(Math.max(-1, Math.min(1, cosAngle))) / 2;

  if (Math.abs(halfAngle) < EPSILON || Math.abs(halfAngle - Math.PI / 2) < EPSILON * 10) {
    // Lines are very nearly parallel or perpendicular in degenerate way
    // (perpendicular is fine actually, but halfAngle=0 means parallel)
    if (Math.abs(halfAngle) < EPSILON) return null;
  }

  const sinHalf = Math.sin(halfAngle);
  if (Math.abs(sinHalf) < EPSILON) return null;

  const distToCenter = radius / sinHalf;

  // Bisector direction (normalised)
  const bisectorRaw: Vec2 = {
    x: away1.x + away2.x,
    y: away1.y + away2.y,
  };
  const bisector = normalise(bisectorRaw);

  // There are two bisector directions (interior & exterior angle).
  // We want the one that leads to a centre on the *inside* of the angle.
  // The inside is the side where a perpendicular from the centre to each
  // line has length exactly `radius`. We compute both candidates and
  // pick the correct one.
  const candidateA: Vec2 = {
    x: ix.x + bisector.x * distToCenter,
    y: ix.y + bisector.y * distToCenter,
  };
  const candidateB: Vec2 = {
    x: ix.x - bisector.x * distToCenter,
    y: ix.y - bisector.y * distToCenter,
  };

  // Perpendicular distance from a point to a line through `origin` with direction `dir`
  const perpDist = (pt: Vec2, origin: Vec2, dir: Vec2): number => {
    const v: Vec2 = { x: pt.x - origin.x, y: pt.y - origin.y };
    return Math.abs(cross(v, normalise(dir)));
  };

  const distA = perpDist(candidateA, p1, d1);
  const distB = perpDist(candidateB, p1, d1);

  const centre =
    Math.abs(distA - radius) < Math.abs(distB - radius)
      ? candidateA
      : candidateB;

  // ── 5. Tangent points ─────────────────────────────────────────────────
  const { projected: tangent1 } = projectOntoLine(centre, p1, d1);
  const { projected: tangent2 } = projectOntoLine(centre, p3, d2);

  // ── 6. Validate: tangent points should be on the segments ─────────────
  //    Check that the tangent point is between segStart and segEnd for
  //    each line. If the fillet radius is too large the tangent may fall
  //    outside the segment.
  const tTan1 = dot(
    { x: tangent1.x - segStart1.x, y: tangent1.y - segStart1.y },
    { x: segEnd1.x - segStart1.x, y: segEnd1.y - segStart1.y }
  ) /
    dot(
      { x: segEnd1.x - segStart1.x, y: segEnd1.y - segStart1.y },
      { x: segEnd1.x - segStart1.x, y: segEnd1.y - segStart1.y }
    );

  const tTan2 = dot(
    { x: tangent2.x - segStart2.x, y: tangent2.y - segStart2.y },
    { x: segEnd2.x - segStart2.x, y: segEnd2.y - segStart2.y }
  ) /
    dot(
      { x: segEnd2.x - segStart2.x, y: segEnd2.y - segStart2.y },
      { x: segEnd2.x - segStart2.x, y: segEnd2.y - segStart2.y }
    );

  if (tTan1 < -EPSILON || tTan1 > 1 + EPSILON) return null; // radius too large
  if (tTan2 < -EPSILON || tTan2 > 1 + EPSILON) return null;

  // ── 7. Arc angles ─────────────────────────────────────────────────────
  const startAngle = normalizeAngle(
    Math.atan2(tangent1.y - centre.y, tangent1.x - centre.x)
  );
  const endAngle = normalizeAngle(
    Math.atan2(tangent2.y - centre.y, tangent2.x - centre.x)
  );

  // Determine arc direction: the arc should sweep through the angle
  // that does NOT contain the intersection point.
  const ixAngle = normalizeAngle(
    Math.atan2(ix.y - centre.y, ix.x - centre.x)
  );

  // Check if ixAngle is in the CCW sweep from startAngle to endAngle
  const sweepCCW = normalizeAngle(endAngle - startAngle);
  const ixInCCW = normalizeAngle(ixAngle - startAngle);

  let finalStartAngle: number;
  let finalEndAngle: number;

  if (ixInCCW < sweepCCW) {
    // The intersection is inside the CCW sweep → we want the CW sweep
    // (which is the opposite direction). Swap start/end.
    finalStartAngle = endAngle;
    finalEndAngle = startAngle;
  } else {
    // The intersection is outside the CCW sweep → CCW sweep is correct
    finalStartAngle = startAngle;
    finalEndAngle = endAngle;
  }

  // ── 8. Trim lines ────────────────────────────────────────────────────
  //    For each line, the trimmed segment goes from the *far* endpoint
  //    (the one away from the intersection) to the tangent point.

  // Determine which original endpoint to keep for line1
  const d1_p1_to_ix2 =
    (p1.x - ix.x) ** 2 + (p1.y - ix.y) ** 2;
  const d1_p2_to_ix2 =
    (p2.x - ix.x) ** 2 + (p2.y - ix.y) ** 2;

  let trimmedLine1: LineSegment;
  if (d1_p1_to_ix2 > d1_p2_to_ix2) {
    // p1 is farther from intersection → keep p1, trim to tangent1
    trimmedLine1 = {
      x1: p1.x,
      y1: p1.y,
      x2: tangent1.x,
      y2: tangent1.y,
    };
  } else {
    // p2 is farther → keep p2, trim to tangent1
    trimmedLine1 = {
      x1: tangent1.x,
      y1: tangent1.y,
      x2: p2.x,
      y2: p2.y,
    };
  }

  const d2_p3_to_ix2 =
    (p3.x - ix.x) ** 2 + (p3.y - ix.y) ** 2;
  const d2_p4_to_ix2 =
    (p4.x - ix.x) ** 2 + (p4.y - ix.y) ** 2;

  let trimmedLine2: LineSegment;
  if (d2_p3_to_ix2 > d2_p4_to_ix2) {
    trimmedLine2 = {
      x1: p3.x,
      y1: p3.y,
      x2: tangent2.x,
      y2: tangent2.y,
    };
  } else {
    trimmedLine2 = {
      x1: tangent2.x,
      y1: tangent2.y,
      x2: p4.x,
      y2: p4.y,
    };
  }

  // ── 9. Return ─────────────────────────────────────────────────────────
  return {
    line1: trimmedLine1,
    line2: trimmedLine2,
    arc: {
      cx: centre.x,
      cy: centre.y,
      radius,
      startAngle: finalStartAngle,
      endAngle: finalEndAngle,
    },
  };
}
