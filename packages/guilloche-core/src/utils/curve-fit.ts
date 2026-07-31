/**
 * Bezier Curve Fitting Algorithm
 * Converts polylines to smooth cubic bezier curves
 * Based on Philip J. Schneider's algorithm from "Graphics Gems"
 *
 * This significantly reduces SVG file sizes while maintaining visual fidelity
 */

import type { Point } from '../engine.js';

/**
 * A cubic bezier curve segment
 */
export interface BezierSegment {
  /** Start point */
  p0: Point;
  /** First control point */
  p1: Point;
  /** Second control point */
  p2: Point;
  /** End point */
  p3: Point;
}

/**
 * Fit a cubic bezier curve to a set of points
 * Uses iterative refinement to minimize error
 *
 * @param points - Input points to fit
 * @param maxError - Maximum allowed error (default 1.0)
 * @returns Array of bezier segments
 */
export function fitCurve(points: Point[], maxError: number = 1.0): BezierSegment[] {
  if (points.length < 2) return [];
  if (points.length === 2) {
    // Simple line segment
    return [
      {
        p0: points[0],
        p1: lerpPoint(points[0], points[1], 1 / 3),
        p2: lerpPoint(points[0], points[1], 2 / 3),
        p3: points[1],
      },
    ];
  }

  // Calculate left and right tangent directions
  const leftTangent = computeLeftTangent(points, 0);
  const rightTangent = computeRightTangent(points, points.length - 1);

  return fitCubic(points, 0, points.length - 1, leftTangent, rightTangent, maxError);
}

/**
 * Fit a cubic bezier curve to a portion of the points
 */
function fitCubic(
  points: Point[],
  first: number,
  last: number,
  tHat1: Point,
  tHat2: Point,
  error: number
): BezierSegment[] {
  const nPts = last - first + 1;

  // Use simple line for 2 points
  if (nPts === 2) {
    const p0 = points[first];
    const p3 = points[last];
    const dist = distance(p0, p3) / 3.0;

    return [
      {
        p0,
        p1: { x: p0.x + tHat1.x * dist, y: p0.y + tHat1.y * dist },
        p2: { x: p3.x + tHat2.x * dist, y: p3.y + tHat2.y * dist },
        p3,
      },
    ];
  }

  // Parameterize points (chord-length parameterization)
  const u = chordLengthParameterize(points, first, last);

  // Generate initial bezier curve
  let bezCurve = generateBezier(points, first, last, u, tHat1, tHat2);

  // Find max error
  const [maxError, splitPoint] = computeMaxError(points, first, last, bezCurve, u);

  if (maxError < error) {
    return [bezCurve];
  }

  // Error too large - try reparameterization
  if (maxError < error * 4) {
    for (let i = 0; i < 4; i++) {
      const uPrime = reparameterize(points, first, last, u, bezCurve);
      bezCurve = generateBezier(points, first, last, uPrime, tHat1, tHat2);
      const [newMaxError] = computeMaxError(points, first, last, bezCurve, uPrime);

      if (newMaxError < error) {
        return [bezCurve];
      }

      u.splice(0, u.length, ...uPrime);
    }
  }

  // Error still too large - split at max error point and recurse
  const tHatCenter = computeCenterTangent(points, splitPoint);

  const left = fitCubic(points, first, splitPoint, tHat1, negate(tHatCenter), error);
  const right = fitCubic(points, splitPoint, last, tHatCenter, tHat2, error);

  return [...left, ...right];
}

/**
 * Generate a bezier curve using least-squares fit
 */
function generateBezier(
  points: Point[],
  first: number,
  last: number,
  uPrime: number[],
  tHat1: Point,
  tHat2: Point
): BezierSegment {
  const nPts = last - first + 1;
  const p0 = points[first];
  const p3 = points[last];

  // Compute A matrices
  const A: [Point, Point][] = [];

  for (let i = 0; i < nPts; i++) {
    const u = uPrime[i];
    const b0 = B0(u);
    const b1 = B1(u);
    const b2 = B2(u);
    const b3 = B3(u);

    A.push([
      { x: tHat1.x * b1, y: tHat1.y * b1 },
      { x: tHat2.x * b2, y: tHat2.y * b2 },
    ]);
  }

  // Create C and X matrices
  const C: [[number, number], [number, number]] = [
    [0, 0],
    [0, 0],
  ];
  const X: [number, number] = [0, 0];

  for (let i = 0; i < nPts; i++) {
    C[0][0] += dot(A[i][0], A[i][0]);
    C[0][1] += dot(A[i][0], A[i][1]);
    C[1][0] = C[0][1];
    C[1][1] += dot(A[i][1], A[i][1]);

    const u = uPrime[i];
    const tmp = subtract(
      points[first + i],
      add(add(scale(p0, B0(u) + B1(u)), scale(p3, B2(u) + B3(u))), { x: 0, y: 0 })
    );

    // Correct tmp calculation
    const b0 = B0(u);
    const b1 = B1(u);
    const b2 = B2(u);
    const b3 = B3(u);

    const bezPt = add(scale(p0, b0), add(scale(p0, b1), add(scale(p3, b2), scale(p3, b3))));

    const diff = subtract(points[first + i], bezPt);

    X[0] += dot(A[i][0], diff);
    X[1] += dot(A[i][1], diff);
  }

  // Solve system
  const det = C[0][0] * C[1][1] - C[0][1] * C[1][0];

  let alpha_l: number, alpha_r: number;

  if (Math.abs(det) < 1e-12) {
    // Singular matrix - use simple heuristic
    const dist = distance(p0, p3) / 3.0;
    alpha_l = alpha_r = dist;
  } else {
    alpha_l = (C[1][1] * X[0] - C[0][1] * X[1]) / det;
    alpha_r = (C[0][0] * X[1] - C[1][0] * X[0]) / det;
  }

  // Prevent negative alphas
  const segLength = distance(p0, p3);
  const epsilon = 1.0e-6 * segLength;

  if (alpha_l < epsilon || alpha_r < epsilon) {
    alpha_l = alpha_r = segLength / 3.0;
  }

  return {
    p0,
    p1: { x: p0.x + tHat1.x * alpha_l, y: p0.y + tHat1.y * alpha_l },
    p2: { x: p3.x + tHat2.x * alpha_r, y: p3.y + tHat2.y * alpha_r },
    p3,
  };
}

/**
 * Reparameterize to find better u values
 */
function reparameterize(
  points: Point[],
  first: number,
  last: number,
  u: number[],
  bezCurve: BezierSegment
): number[] {
  const uPrime: number[] = [];

  for (let i = first; i <= last; i++) {
    uPrime.push(newtonRaphsonRootFind(bezCurve, points[i], u[i - first]));
  }

  return uPrime;
}

/**
 * Newton-Raphson iteration to find better parameter value
 */
function newtonRaphsonRootFind(bez: BezierSegment, p: Point, u: number): number {
  const Q = evaluateBezier(bez, u);
  const Q1 = evaluateBezierDerivative(bez, u);
  const Q2 = evaluateBezierSecondDerivative(bez, u);

  const numerator = (Q.x - p.x) * Q1.x + (Q.y - p.y) * Q1.y;
  const denominator = Q1.x * Q1.x + Q1.y * Q1.y + (Q.x - p.x) * Q2.x + (Q.y - p.y) * Q2.y;

  if (Math.abs(denominator) < 1e-12) return u;

  return u - numerator / denominator;
}

/**
 * Evaluate bezier curve at parameter t
 */
export function evaluateBezier(bez: BezierSegment, t: number): Point {
  const t2 = t * t;
  const t3 = t2 * t;
  const mt = 1 - t;
  const mt2 = mt * mt;
  const mt3 = mt2 * mt;

  return {
    x: mt3 * bez.p0.x + 3 * mt2 * t * bez.p1.x + 3 * mt * t2 * bez.p2.x + t3 * bez.p3.x,
    y: mt3 * bez.p0.y + 3 * mt2 * t * bez.p1.y + 3 * mt * t2 * bez.p2.y + t3 * bez.p3.y,
  };
}

/**
 * Evaluate first derivative of bezier curve at parameter t
 */
function evaluateBezierDerivative(bez: BezierSegment, t: number): Point {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;

  return {
    x:
      3 *
      (mt2 * (bez.p1.x - bez.p0.x) +
        2 * mt * t * (bez.p2.x - bez.p1.x) +
        t2 * (bez.p3.x - bez.p2.x)),
    y:
      3 *
      (mt2 * (bez.p1.y - bez.p0.y) +
        2 * mt * t * (bez.p2.y - bez.p1.y) +
        t2 * (bez.p3.y - bez.p2.y)),
  };
}

/**
 * Evaluate second derivative of bezier curve at parameter t
 */
function evaluateBezierSecondDerivative(bez: BezierSegment, t: number): Point {
  const mt = 1 - t;

  return {
    x: 6 * (mt * (bez.p2.x - 2 * bez.p1.x + bez.p0.x) + t * (bez.p3.x - 2 * bez.p2.x + bez.p1.x)),
    y: 6 * (mt * (bez.p2.y - 2 * bez.p1.y + bez.p0.y) + t * (bez.p3.y - 2 * bez.p2.y + bez.p1.y)),
  };
}

/**
 * Compute max error between points and bezier curve
 */
function computeMaxError(
  points: Point[],
  first: number,
  last: number,
  bezCurve: BezierSegment,
  u: number[]
): [number, number] {
  let maxError = 0;
  let splitPoint = (last + first) / 2;

  for (let i = first + 1; i < last; i++) {
    const p = evaluateBezier(bezCurve, u[i - first]);
    const dist = distanceSquared(points[i], p);

    if (dist >= maxError) {
      maxError = dist;
      splitPoint = i;
    }
  }

  return [Math.sqrt(maxError), splitPoint];
}

/**
 * Chord-length parameterization
 */
function chordLengthParameterize(points: Point[], first: number, last: number): number[] {
  const u: number[] = [0];

  for (let i = first + 1; i <= last; i++) {
    u.push(u[u.length - 1] + distance(points[i], points[i - 1]));
  }

  const totalLength = u[u.length - 1];
  if (totalLength > 0) {
    for (let i = 1; i < u.length; i++) {
      u[i] /= totalLength;
    }
  }

  return u;
}

/**
 * Compute tangent at start of curve
 */
function computeLeftTangent(points: Point[], end: number): Point {
  return normalize(subtract(points[end + 1], points[end]));
}

/**
 * Compute tangent at end of curve
 */
function computeRightTangent(points: Point[], end: number): Point {
  return normalize(subtract(points[end - 1], points[end]));
}

/**
 * Compute tangent at middle of curve
 */
function computeCenterTangent(points: Point[], center: number): Point {
  const v1 = subtract(points[center - 1], points[center]);
  const v2 = subtract(points[center], points[center + 1]);
  return normalize({ x: (v1.x + v2.x) / 2, y: (v1.y + v2.y) / 2 });
}

// Bernstein basis functions
function B0(t: number): number {
  const s = 1 - t;
  return s * s * s;
}
function B1(t: number): number {
  const s = 1 - t;
  return 3 * s * s * t;
}
function B2(t: number): number {
  const s = 1 - t;
  return 3 * s * t * t;
}
function B3(t: number): number {
  return t * t * t;
}

// Vector operations
function add(a: Point, b: Point): Point {
  return { x: a.x + b.x, y: a.y + b.y };
}

function subtract(a: Point, b: Point): Point {
  return { x: a.x - b.x, y: a.y - b.y };
}

function scale(p: Point, s: number): Point {
  return { x: p.x * s, y: p.y * s };
}

function negate(p: Point): Point {
  return { x: -p.x, y: -p.y };
}

function dot(a: Point, b: Point): number {
  return a.x * b.x + a.y * b.y;
}

function distance(a: Point, b: Point): number {
  return Math.sqrt(distanceSquared(a, b));
}

function distanceSquared(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function normalize(p: Point): Point {
  const len = Math.sqrt(p.x * p.x + p.y * p.y);
  if (len === 0) return { x: 0, y: 0 };
  return { x: p.x / len, y: p.y / len };
}

function lerpPoint(a: Point, b: Point, t: number): Point {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  };
}

/**
 * Convert bezier segments to SVG path data
 *
 * @param segments - Bezier segments
 * @param precision - Decimal precision for coordinates
 * @returns SVG path data string
 */
export function bezierToSVGPath(segments: BezierSegment[], precision: number = 3): string {
  if (segments.length === 0) return '';

  const fmt = (n: number) => n.toFixed(precision);
  let path = `M ${fmt(segments[0].p0.x)} ${fmt(segments[0].p0.y)}`;

  for (const seg of segments) {
    path += ` C ${fmt(seg.p1.x)} ${fmt(seg.p1.y)}, ${fmt(seg.p2.x)} ${fmt(seg.p2.y)}, ${fmt(seg.p3.x)} ${fmt(seg.p3.y)}`;
  }

  return path;
}

/**
 * Flatten bezier segments back to polyline (for rendering)
 *
 * @param segments - Bezier segments
 * @param flatness - Maximum deviation from curve
 * @returns Array of points
 */
export function flattenBezier(segments: BezierSegment[], flatness: number = 0.5): Point[] {
  if (segments.length === 0) return [];

  const points: Point[] = [segments[0].p0];

  for (const seg of segments) {
    flattenCubicBezier(seg, flatness, points);
  }

  return points;
}

/**
 * Flatten a single cubic bezier to points
 */
function flattenCubicBezier(seg: BezierSegment, flatness: number, result: Point[]): void {
  const stack: BezierSegment[] = [seg];

  while (stack.length > 0) {
    const current = stack.pop()!;

    // Check if curve is flat enough
    const d1 = pointToLineDistance(current.p1, current.p0, current.p3);
    const d2 = pointToLineDistance(current.p2, current.p0, current.p3);

    if (d1 + d2 <= flatness) {
      result.push(current.p3);
    } else {
      // Subdivide
      const [left, right] = subdivideBezier(current);
      stack.push(right, left); // Reverse order for correct output
    }
  }
}

/**
 * Subdivide bezier at midpoint
 */
function subdivideBezier(seg: BezierSegment): [BezierSegment, BezierSegment] {
  const mid01 = lerpPoint(seg.p0, seg.p1, 0.5);
  const mid12 = lerpPoint(seg.p1, seg.p2, 0.5);
  const mid23 = lerpPoint(seg.p2, seg.p3, 0.5);
  const mid012 = lerpPoint(mid01, mid12, 0.5);
  const mid123 = lerpPoint(mid12, mid23, 0.5);
  const mid0123 = lerpPoint(mid012, mid123, 0.5);

  return [
    { p0: seg.p0, p1: mid01, p2: mid012, p3: mid0123 },
    { p0: mid0123, p1: mid123, p2: mid23, p3: seg.p3 },
  ];
}

/**
 * Distance from point to line
 */
function pointToLineDistance(p: Point, lineStart: Point, lineEnd: Point): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const lengthSq = dx * dx + dy * dy;

  if (lengthSq === 0) return distance(p, lineStart);

  const num = Math.abs(dy * p.x - dx * p.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x);
  return num / Math.sqrt(lengthSq);
}
