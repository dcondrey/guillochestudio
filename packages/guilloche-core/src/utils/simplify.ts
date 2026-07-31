/**
 * Path Simplification using Ramer-Douglas-Peucker Algorithm
 * Reduces the number of points in a path while preserving shape
 */

import type { Point } from '../engine.js';

/**
 * Simplify a path using the Ramer-Douglas-Peucker algorithm
 * Removes points that don't contribute significantly to the shape
 *
 * @param points - Input points
 * @param epsilon - Maximum distance from the simplified line (higher = more simplification)
 * @returns Simplified points array
 */
export function simplifyPath(points: Point[], epsilon: number = 1.0): Point[] {
  if (points.length <= 2) return [...points];

  // Find the point with the maximum distance from line between first and last points
  let maxDist = 0;
  let maxIndex = 0;
  const first = points[0];
  const last = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i], first, last);
    if (dist > maxDist) {
      maxDist = dist;
      maxIndex = i;
    }
  }

  // If max distance is greater than epsilon, recursively simplify
  if (maxDist > epsilon) {
    const left = simplifyPath(points.slice(0, maxIndex + 1), epsilon);
    const right = simplifyPath(points.slice(maxIndex), epsilon);

    // Remove duplicate point at junction
    return [...left.slice(0, -1), ...right];
  }

  // All points between first and last are close enough - remove them
  return [first, last];
}

/**
 * Visvalingam-Whyatt simplification algorithm
 * Better for cartographic/organic shapes
 *
 * @param points - Input points
 * @param minArea - Minimum triangle area to keep (higher = more simplification)
 * @returns Simplified points array
 */
export function simplifyVisvalingam(points: Point[], minArea: number = 1.0): Point[] {
  if (points.length <= 2) return [...points];

  // Create linked list with area calculations
  interface Node {
    point: Point;
    index: number;
    area: number;
    prev: Node | null;
    next: Node | null;
    removed: boolean;
  }

  const nodes: Node[] = points.map((point, index) => ({
    point,
    index,
    area: Infinity,
    prev: null,
    next: null,
    removed: false,
  }));

  // Link nodes
  for (let i = 0; i < nodes.length; i++) {
    if (i > 0) nodes[i].prev = nodes[i - 1];
    if (i < nodes.length - 1) nodes[i].next = nodes[i + 1];
  }

  // Calculate initial areas (skip first and last)
  for (let i = 1; i < nodes.length - 1; i++) {
    nodes[i].area = triangleArea(nodes[i].prev!.point, nodes[i].point, nodes[i].next!.point);
  }

  // Process points in order of increasing area
  while (true) {
    // Find node with minimum area
    let minNode: Node | null = null;
    let minNodeArea = Infinity;

    for (const node of nodes) {
      if (!node.removed && node.prev && node.next && node.area < minNodeArea) {
        minNodeArea = node.area;
        minNode = node;
      }
    }

    // Stop if no more nodes to remove or area exceeds threshold
    if (!minNode || minNodeArea >= minArea) break;

    // Remove the node
    minNode.removed = true;
    if (minNode.prev) minNode.prev.next = minNode.next;
    if (minNode.next) minNode.next.prev = minNode.prev;

    // Recalculate areas of neighbors
    if (minNode.prev && minNode.prev.prev && minNode.prev.next) {
      minNode.prev.area = triangleArea(
        minNode.prev.prev.point,
        minNode.prev.point,
        minNode.prev.next.point
      );
    }
    if (minNode.next && minNode.next.prev && minNode.next.next) {
      minNode.next.area = triangleArea(
        minNode.next.prev.point,
        minNode.next.point,
        minNode.next.next.point
      );
    }
  }

  // Collect remaining points
  return nodes.filter((n) => !n.removed).map((n) => n.point);
}

/**
 * Radial distance simplification
 * Simple and fast - removes points too close to the previous point
 *
 * @param points - Input points
 * @param minDistance - Minimum distance between consecutive points
 * @returns Simplified points array
 */
export function simplifyRadial(points: Point[], minDistance: number = 1.0): Point[] {
  if (points.length <= 2) return [...points];

  const result: Point[] = [points[0]];
  let prevPoint = points[0];
  const minDistSq = minDistance * minDistance;

  for (let i = 1; i < points.length - 1; i++) {
    const dx = points[i].x - prevPoint.x;
    const dy = points[i].y - prevPoint.y;

    if (dx * dx + dy * dy >= minDistSq) {
      result.push(points[i]);
      prevPoint = points[i];
    }
  }

  // Always include last point
  result.push(points[points.length - 1]);

  return result;
}

/**
 * Combined simplification: radial + RDP
 * First removes close points, then applies RDP for shape simplification
 *
 * @param points - Input points
 * @param radialDistance - Minimum distance for radial simplification
 * @param epsilon - Epsilon for RDP simplification
 * @returns Simplified points array
 */
export function simplifyCombined(
  points: Point[],
  radialDistance: number = 0.5,
  epsilon: number = 1.0
): Point[] {
  const radialSimplified = simplifyRadial(points, radialDistance);
  return simplifyPath(radialSimplified, epsilon);
}

/**
 * Adaptive simplification based on point count
 * Automatically chooses epsilon to achieve target point reduction
 *
 * @param points - Input points
 * @param targetRatio - Target ratio of points to keep (0-1)
 * @param maxIterations - Maximum iterations to find epsilon
 * @returns Simplified points array
 */
export function simplifyAdaptive(
  points: Point[],
  targetRatio: number = 0.1,
  maxIterations: number = 10
): Point[] {
  if (points.length <= 2) return [...points];

  const targetCount = Math.max(2, Math.floor(points.length * targetRatio));

  // Binary search for epsilon
  let low = 0;
  let high = getBoundsSize(points);
  let bestResult = points;
  let bestDiff = points.length;

  for (let i = 0; i < maxIterations; i++) {
    const epsilon = (low + high) / 2;
    const simplified = simplifyPath(points, epsilon);
    const diff = Math.abs(simplified.length - targetCount);

    if (diff < bestDiff) {
      bestDiff = diff;
      bestResult = simplified;
    }

    if (simplified.length > targetCount) {
      low = epsilon;
    } else if (simplified.length < targetCount) {
      high = epsilon;
    } else {
      break;
    }
  }

  return bestResult;
}

/**
 * Calculate perpendicular distance from point to line
 */
function perpendicularDistance(point: Point, lineStart: Point, lineEnd: Point): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const lengthSq = dx * dx + dy * dy;

  if (lengthSq === 0) {
    // Line start and end are the same point
    const ddx = point.x - lineStart.x;
    const ddy = point.y - lineStart.y;
    return Math.sqrt(ddx * ddx + ddy * ddy);
  }

  // Calculate perpendicular distance using cross product
  const num = Math.abs(
    dy * point.x - dx * point.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x
  );
  return num / Math.sqrt(lengthSq);
}

/**
 * Calculate area of triangle formed by three points
 */
function triangleArea(p1: Point, p2: Point, p3: Point): number {
  return Math.abs((p2.x - p1.x) * (p3.y - p1.y) - (p3.x - p1.x) * (p2.y - p1.y)) / 2;
}

/**
 * Get the size of the bounding box (diagonal)
 */
function getBoundsSize(points: Point[]): number {
  if (points.length === 0) return 0;

  let minX = Infinity,
    minY = Infinity;
  let maxX = -Infinity,
    maxY = -Infinity;

  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }

  const dx = maxX - minX;
  const dy = maxY - minY;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate path length
 */
export function pathLength(points: Point[]): number {
  if (points.length < 2) return 0;

  let length = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    length += Math.sqrt(dx * dx + dy * dy);
  }

  return length;
}

/**
 * Resample path to have evenly spaced points
 *
 * @param points - Input points
 * @param targetCount - Target number of points
 * @returns Resampled points array
 */
export function resamplePath(points: Point[], targetCount: number): Point[] {
  if (points.length < 2) return [...points];
  if (targetCount < 2) return [points[0], points[points.length - 1]];

  const totalLength = pathLength(points);
  const spacing = totalLength / (targetCount - 1);

  const result: Point[] = [points[0]];
  let currentDist = 0;
  let accumulated = 0;
  let i = 1;

  while (result.length < targetCount - 1 && i < points.length) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    const segLength = Math.sqrt(dx * dx + dy * dy);

    const nextDist = accumulated + segLength;

    while (currentDist + spacing <= nextDist && result.length < targetCount - 1) {
      currentDist += spacing;
      const t = (currentDist - accumulated) / segLength;
      result.push({
        x: points[i - 1].x + dx * t,
        y: points[i - 1].y + dy * t,
      });
    }

    accumulated = nextDist;
    i++;
  }

  result.push(points[points.length - 1]);
  return result;
}
