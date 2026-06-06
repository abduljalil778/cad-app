/**
 * @module fillet
 *
 * Computes a fillet (rounded corner) between two line segments.
 *
 * Algorithm:
 * 1. Find the intersection of the two infinite lines.
 * 2. Determine the "near" endpoints (closest to intersection) for each segment.
 * 3. Offset both infinite lines by ±radius perpendicular to find fillet center candidates.
 * 4. Pick the center that is exactly `radius` from both lines and on the "inner" side.
 * 5. Drop perpendiculars from center to both lines → tangent points.
 * 6. Trim lines to tangent points.
 * 7. Compute the arc from tangent1 to tangent2, sweeping AWAY from the intersection.
 *
 * All angles are in radians.
 */

const EPSILON = 1e-9;

// ── Types ────────────────────────────────────────────────────────────────────

export interface LineSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface FilletResult {
  line1: LineSegment;
  line2: LineSegment;
  arc: {
    cx: number;
    cy: number;
    radius: number;
    startAngle: number;
    endAngle: number;
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

interface V2 { x: number; y: number; }

function len(v: V2): number { return Math.sqrt(v.x * v.x + v.y * v.y); }
function dot(a: V2, b: V2): number { return a.x * b.x + a.y * b.y; }
function cross2(a: V2, b: V2): number { return a.x * b.y - a.y * b.x; }
function sub(a: V2, b: V2): V2 { return { x: a.x - b.x, y: a.y - b.y }; }
function add(a: V2, b: V2): V2 { return { x: a.x + b.x, y: a.y + b.y }; }
function scale(v: V2, s: number): V2 { return { x: v.x * s, y: v.y * s }; }
function norm(v: V2): V2 { const l = len(v); return l < EPSILON ? { x: 0, y: 0 } : { x: v.x / l, y: v.y / l }; }
function perp(v: V2): V2 { return { x: -v.y, y: v.x }; }
function dist(a: V2, b: V2): number { return len(sub(a, b)); }

/** Parameter t of point P projected onto line A+t*D */
function projectT(p: V2, a: V2, d: V2): number {
  const dd = dot(d, d);
  if (dd < EPSILON * EPSILON) return 0;
  return dot(sub(p, a), d) / dd;
}

/** Project point onto line, return projected point */
function projectPt(p: V2, a: V2, d: V2): V2 {
  const t = projectT(p, a, d);
  return add(a, scale(d, t));
}

/** Intersect two infinite lines: P1 + t*D1 and P2 + t*D2 */
function lineLineIx(p1: V2, d1: V2, p2: V2, d2: V2): V2 | null {
  const denom = cross2(d1, d2);
  if (Math.abs(denom) < EPSILON) return null;
  const t = cross2(sub(p2, p1), d2) / denom;
  return add(p1, scale(d1, t));
}

/** Normalize angle to [0, 2π) */
function normAngle(a: number): number {
  const TWO_PI = 2 * Math.PI;
  let r = a % TWO_PI;
  if (r < 0) r += TWO_PI;
  return r;
}

/**
 * Angular sweep from `from` to `to` going counter-clockwise.
 * Returns value in (0, 2π].
 */
function ccwSweep(from: number, to: number): number {
  let s = normAngle(to - from);
  if (s < EPSILON) s = 2 * Math.PI;
  return s;
}

// ── Public API ──────────────────────────────────────────────────────────────

export function computeFillet(
  line1: LineSegment,
  line2: LineSegment,
  radius: number,
): FilletResult | null {
  if (radius <= 0) return null;

  const p1: V2 = { x: line1.x1, y: line1.y1 };
  const p2: V2 = { x: line1.x2, y: line1.y2 };
  const p3: V2 = { x: line2.x1, y: line2.y1 };
  const p4: V2 = { x: line2.x2, y: line2.y2 };

  const d1 = sub(p2, p1); // direction of line1
  const d2 = sub(p4, p3); // direction of line2

  if (len(d1) < EPSILON || len(d2) < EPSILON) return null;

  // ── 1. Find intersection of infinite lines ─────────────────────────────
  const ix = lineLineIx(p1, d1, p3, d2);
  if (!ix) return null; // parallel

  // ── 2. Determine "near" end of each segment ────────────────────────────
  // The near end is the endpoint closest to the intersection.
  // For L-shaped lines, this is the shared endpoint.
  const d_p1_ix = dist(p1, ix);
  const d_p2_ix = dist(p2, ix);
  const d_p3_ix = dist(p3, ix);
  const d_p4_ix = dist(p4, ix);

  // nearEnd = endpoint closest to ix, farEnd = the other
  const near1 = d_p1_ix < d_p2_ix ? p1 : p2;
  const far1 = d_p1_ix < d_p2_ix ? p2 : p1;
  const near2 = d_p3_ix < d_p4_ix ? p3 : p4;
  const far2 = d_p3_ix < d_p4_ix ? p4 : p3;

  // Direction from ix AWAY (towards far end of each segment)
  const away1 = norm(sub(far1, ix));
  const away2 = norm(sub(far2, ix));

  // ── 3. Find fillet center ──────────────────────────────────────────────
  // The fillet center is at distance `radius` from both infinite lines,
  // on the interior side of the angle formed by away1 and away2.
  //
  // Perpendicular normals to each line
  const n1 = perp(norm(d1)); // normal to line1
  const n2 = perp(norm(d2)); // normal to line2

  // There are 4 candidate centers (2 offsets × 2 offsets).
  // The correct one is at distance exactly `radius` from both lines
  // and on the same side as the interior of the angle.
  const candidates: V2[] = [];
  for (const s1 of [1, -1]) {
    for (const s2 of [1, -1]) {
      // Offset line1 by s1*radius*n1, offset line2 by s2*radius*n2
      // Find intersection of offset lines
      const offsetP1 = add(p1, scale(n1, s1 * radius));
      const offsetP3 = add(p3, scale(n2, s2 * radius));
      const c = lineLineIx(offsetP1, d1, offsetP3, d2);
      if (c) candidates.push(c);
    }
  }

  if (candidates.length === 0) return null;

  // Pick the candidate that is:
  // (a) at distance ≈ radius from both original lines
  // (b) on the "inner" side (between the two away directions from ix)
  //
  // The inner side candidate is the one where the vector from ix to center
  // has positive dot product with the bisector of away1 and away2.
  const bisector = norm(add(away1, away2));

  let bestCenter: V2 | null = null;
  let bestScore = -Infinity;

  for (const c of candidates) {
    // Check distance to both lines
    const distToL1 = Math.abs(cross2(sub(c, p1), norm(d1)));
    const distToL2 = Math.abs(cross2(sub(c, p3), norm(d2)));
    if (Math.abs(distToL1 - radius) > 0.01 || Math.abs(distToL2 - radius) > 0.01) continue;

    // Score: prefer the candidate on the inner side (positive dot with bisector from ix)
    const toC = sub(c, ix);
    const score = dot(toC, bisector);
    if (score > bestScore) {
      bestScore = score;
      bestCenter = c;
    }
  }

  if (!bestCenter) return null;

  // ── 4. Find tangent points ─────────────────────────────────────────────
  const tangent1 = projectPt(bestCenter, p1, d1);
  const tangent2 = projectPt(bestCenter, p3, d2);

  // Validate: tangent points should be reachable from the far endpoint
  // (i.e., the tangent is between the far endpoint and the intersection).
  // For L-shaped lines, tangent is between ix and the far endpoint.
  // We use a relaxed check: tangent must be on the line segment
  // from farEnd to near the intersection, with tolerance.
  const t1_on_seg = projectT(tangent1, far1, sub(near1, far1));
  const t2_on_seg = projectT(tangent2, far2, sub(near2, far2));

  // t should be in [0, ~1+epsilon] where 0=farEnd, 1=nearEnd
  // If t > 1, tangent is beyond the near endpoint (past intersection) — still OK for meeting lines
  // If t < -epsilon, tangent is beyond the far endpoint — radius too large
  if (t1_on_seg < -0.01) return null; // radius too large for line1
  if (t2_on_seg < -0.01) return null; // radius too large for line2

  // ── 5. Compute arc angles ──────────────────────────────────────────────
  // The fillet arc connects the two tangent points via the SHORTEST path.
  // A fillet arc is always < 180° (π radians).
  // We pick the CCW sweep direction that gives the smaller arc.
  const a1 = Math.atan2(tangent1.y - bestCenter.y, tangent1.x - bestCenter.x);
  const a2 = Math.atan2(tangent2.y - bestCenter.y, tangent2.x - bestCenter.x);

  const ccw12 = ccwSweep(a1, a2); // CCW sweep from a1 to a2

  let startAngle: number;
  let endAngle: number;

  if (ccw12 <= Math.PI) {
    // CCW from a1→a2 is the short arc
    startAngle = a1;
    endAngle = a2;
  } else {
    // CCW from a2→a1 is the short arc
    startAngle = a2;
    endAngle = a1;
  }

  // ── 6. Trim lines ─────────────────────────────────────────────────────
  // Line1: from far1 to tangent1
  const trimmedLine1: LineSegment = {
    x1: far1.x,
    y1: far1.y,
    x2: tangent1.x,
    y2: tangent1.y,
  };

  // Line2: from tangent2 to far2
  const trimmedLine2: LineSegment = {
    x1: tangent2.x,
    y1: tangent2.y,
    x2: far2.x,
    y2: far2.y,
  };

  return {
    line1: trimmedLine1,
    line2: trimmedLine2,
    arc: {
      cx: bestCenter.x,
      cy: bestCenter.y,
      radius,
      startAngle,
      endAngle,
    },
  };
}
