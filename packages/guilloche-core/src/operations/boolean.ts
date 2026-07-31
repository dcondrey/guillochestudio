/**
 * Boolean path operations using clipper2-js
 * Provides union, intersect, difference, and offset operations
 * for professional path manipulation in Guilloche Studio.
 *
 * Note: clipper2-js uses number coordinates, not BigInt like the C++ version
 */

import { Clipper, FillRule, JoinType, EndType, Point64 } from 'clipper2-js';
import type { Path64, Paths64, IPoint64 } from 'clipper2-js';
import type { Point, PathSegment } from '../engine.js';

/** Scale factor for converting float coordinates to integers (clipper2 uses integers) */
const SCALE = 1000000;

/**
 * Convert a Point array to clipper2 Path64 format
 */
function pointsToPath64(points: Point[]): Path64 {
  return points.map((p) => ({
    x: Math.round(p.x * SCALE),
    y: Math.round(p.y * SCALE),
  })) as Path64;
}

/**
 * Convert clipper2 Path64 to Point array
 */
function path64ToPoints(path: Path64): Point[] {
  return path.map((p) => ({
    x: p.x / SCALE,
    y: p.y / SCALE,
  }));
}

/**
 * Convert PathSegments to clipper2 Paths64
 */
function segmentsToPaths64(segments: PathSegment[]): Paths64 {
  return segments.map((seg) => pointsToPath64(seg.points));
}

/**
 * Convert clipper2 Paths64 to PathSegments
 */
function paths64ToSegments(paths: Paths64, template?: Partial<PathSegment>): PathSegment[] {
  return paths.map((path) => ({
    points: path64ToPoints(path),
    ...template,
  }));
}

/**
 * Boolean union of two path collections
 * Combines all paths, removing overlapping areas
 *
 * @param subjectSegments - First set of paths
 * @param clipSegments - Second set of paths
 * @returns Combined paths with overlaps merged
 */
export function union(subjectSegments: PathSegment[], clipSegments: PathSegment[]): PathSegment[] {
  const subject = segmentsToPaths64(subjectSegments);
  const clip = segmentsToPaths64(clipSegments);
  const result = Clipper.Union(subject, clip, FillRule.NonZero);
  return paths64ToSegments(result);
}

/**
 * Boolean intersection of two path collections
 * Returns only the overlapping areas
 *
 * @param subjectSegments - First set of paths
 * @param clipSegments - Second set of paths
 * @returns Only the overlapping regions
 */
export function intersect(
  subjectSegments: PathSegment[],
  clipSegments: PathSegment[]
): PathSegment[] {
  const subject = segmentsToPaths64(subjectSegments);
  const clip = segmentsToPaths64(clipSegments);
  const result = Clipper.Intersect(subject, clip, FillRule.NonZero);
  return paths64ToSegments(result);
}

/**
 * Boolean difference of two path collections
 * Subtracts clip paths from subject paths
 *
 * @param subjectSegments - Paths to subtract from
 * @param clipSegments - Paths to subtract
 * @returns Subject paths with clip areas removed
 */
export function difference(
  subjectSegments: PathSegment[],
  clipSegments: PathSegment[]
): PathSegment[] {
  const subject = segmentsToPaths64(subjectSegments);
  const clip = segmentsToPaths64(clipSegments);
  const result = Clipper.Difference(subject, clip, FillRule.NonZero);
  return paths64ToSegments(result);
}

/**
 * Boolean XOR of two path collections
 * Returns areas that are in one set but not both
 *
 * @param subjectSegments - First set of paths
 * @param clipSegments - Second set of paths
 * @returns Areas exclusive to each set
 */
export function xor(subjectSegments: PathSegment[], clipSegments: PathSegment[]): PathSegment[] {
  const subject = segmentsToPaths64(subjectSegments);
  const clip = segmentsToPaths64(clipSegments);
  const result = Clipper.Xor(subject, clip, FillRule.NonZero);
  return paths64ToSegments(result);
}

/**
 * Offset (inflate/deflate) paths
 * Positive delta expands paths outward, negative contracts inward
 *
 * @param segments - Paths to offset
 * @param delta - Offset distance (positive = expand, negative = contract)
 * @param joinType - Corner style: 'round', 'miter', or 'square'
 * @param endType - End cap style: 'polygon', 'joined', 'butt', 'square', 'round'
 * @returns Offset paths
 */
export function offset(
  segments: PathSegment[],
  delta: number,
  joinType: 'round' | 'miter' | 'square' = 'round',
  endType: 'polygon' | 'joined' | 'butt' | 'square' | 'round' = 'polygon'
): PathSegment[] {
  const paths = segmentsToPaths64(segments);
  const scaledDelta = delta * SCALE;

  const jt =
    joinType === 'round' ? JoinType.Round : joinType === 'miter' ? JoinType.Miter : JoinType.Square;

  const et =
    endType === 'polygon'
      ? EndType.Polygon
      : endType === 'joined'
        ? EndType.Joined
        : endType === 'butt'
          ? EndType.Butt
          : endType === 'square'
            ? EndType.Square
            : EndType.Round;

  const result = Clipper.InflatePaths(paths, scaledDelta, jt, et);
  return paths64ToSegments(result);
}

/**
 * Simplify paths by removing redundant points using Ramer-Douglas-Peucker
 *
 * @param segments - Paths to simplify
 * @param epsilon - Simplification tolerance (higher = more simplification)
 * @returns Simplified paths
 */
export function simplify(segments: PathSegment[], epsilon: number = 0.1): PathSegment[] {
  const paths = segmentsToPaths64(segments);
  const scaledEpsilon = epsilon * SCALE;
  const result = Clipper.simplifyPaths(paths, scaledEpsilon);
  return paths64ToSegments(result);
}

/**
 * Check if a point is inside a closed path
 *
 * @param point - Point to test
 * @param segment - Closed path to test against
 * @returns 1 if inside, 0 if on edge, -1 if outside
 */
export function pointInPath(point: Point, segment: PathSegment): number {
  const path = pointsToPath64(segment.points);
  const testPoint = new Point64(Math.round(point.x * SCALE), Math.round(point.y * SCALE));

  const result = Clipper.pointInPolygon(testPoint, path);
  // PointInPolygonResult enum: IsOn=0, IsInside=1, IsOutside=-1
  return result;
}

/**
 * Calculate the area of a closed path
 * Positive = counter-clockwise, Negative = clockwise
 *
 * @param segment - Path to measure
 * @returns Signed area
 */
export function pathArea(segment: PathSegment): number {
  const path = pointsToPath64(segment.points);
  const scaledArea = Clipper.area(path);
  return scaledArea / (SCALE * SCALE);
}

/**
 * Check if a path is clockwise
 *
 * @param segment - Path to check
 * @returns true if clockwise
 */
export function isClockwise(segment: PathSegment): boolean {
  return pathArea(segment) < 0;
}

/**
 * Reverse the direction of a path
 *
 * @param segment - Path to reverse
 * @returns Reversed path
 */
export function reversePath(segment: PathSegment): PathSegment {
  return {
    ...segment,
    points: [...segment.points].reverse(),
  };
}

/**
 * Create a circle as a Path64
 */
export function createCircle(
  centerX: number,
  centerY: number,
  radius: number,
  steps: number = 64
): PathSegment {
  const path = Clipper.ellipse(
    { x: Math.round(centerX * SCALE), y: Math.round(centerY * SCALE) },
    Math.round(radius * SCALE),
    Math.round(radius * SCALE),
    steps
  );
  return { points: path64ToPoints(path) };
}

/**
 * Create an ellipse as a PathSegment
 */
export function createEllipse(
  centerX: number,
  centerY: number,
  radiusX: number,
  radiusY: number,
  steps: number = 64
): PathSegment {
  const path = Clipper.ellipse(
    { x: Math.round(centerX * SCALE), y: Math.round(centerY * SCALE) },
    Math.round(radiusX * SCALE),
    Math.round(radiusY * SCALE),
    steps
  );
  return { points: path64ToPoints(path) };
}

/**
 * Create a rectangle as a PathSegment
 */
export function createRectangle(x: number, y: number, width: number, height: number): PathSegment {
  return {
    points: [
      { x, y },
      { x: x + width, y },
      { x: x + width, y: y + height },
      { x, y: y + height },
      { x, y }, // Close the path
    ],
  };
}

/**
 * Create a regular polygon as a PathSegment
 */
export function createPolygon(
  centerX: number,
  centerY: number,
  radius: number,
  sides: number,
  startAngle: number = 0
): PathSegment {
  const points: Point[] = [];
  for (let i = 0; i <= sides; i++) {
    const angle = startAngle + (2 * Math.PI * i) / sides;
    points.push({
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    });
  }
  return { points };
}
