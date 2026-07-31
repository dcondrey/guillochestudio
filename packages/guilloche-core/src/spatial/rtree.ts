/**
 * Spatial indexing using R-tree (rbush)
 * Enables O(log n) queries for hit testing and segment lookups
 */

import RBush from 'rbush';
import type { Point, PathSegment } from '../engine.js';

/**
 * Bounding box interface for R-tree items
 */
export interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Indexed point with metadata
 */
export interface IndexedPoint extends BBox {
  point: Point;
  segmentIndex: number;
  pointIndex: number;
  layerId?: string;
}

/**
 * Indexed segment with metadata
 */
export interface IndexedSegment extends BBox {
  segment: PathSegment;
  segmentIndex: number;
  layerId?: string;
}

/**
 * Point spatial index using R-tree
 * Optimized for hit testing individual points
 */
export class PointIndex {
  private tree: RBush<IndexedPoint>;
  private items: IndexedPoint[] = [];

  constructor(nodeCapacity: number = 16) {
    this.tree = new RBush<IndexedPoint>(nodeCapacity);
  }

  /**
   * Clear all indexed points
   */
  clear(): void {
    this.tree.clear();
    this.items = [];
  }

  /**
   * Add points from a segment to the index
   *
   * @param segment - Path segment containing points
   * @param segmentIndex - Index of the segment
   * @param layerId - Optional layer identifier
   */
  addSegment(segment: PathSegment, segmentIndex: number, layerId?: string): void {
    const newItems: IndexedPoint[] = segment.points.map((point, pointIndex) => ({
      minX: point.x,
      minY: point.y,
      maxX: point.x,
      maxY: point.y,
      point,
      segmentIndex,
      pointIndex,
      layerId,
    }));

    this.items.push(...newItems);
    this.tree.load(newItems);
  }

  /**
   * Add multiple segments at once (more efficient than individual adds)
   *
   * @param segments - Array of path segments
   * @param layerId - Optional layer identifier
   */
  bulkAdd(segments: PathSegment[], layerId?: string): void {
    const allItems: IndexedPoint[] = [];

    segments.forEach((segment, segmentIndex) => {
      segment.points.forEach((point, pointIndex) => {
        allItems.push({
          minX: point.x,
          minY: point.y,
          maxX: point.x,
          maxY: point.y,
          point,
          segmentIndex,
          pointIndex,
          layerId,
        });
      });
    });

    this.items = allItems;
    this.tree.clear();
    this.tree.load(allItems);
  }

  /**
   * Find all points within a bounding box
   *
   * @param bbox - Search bounding box
   * @returns Array of indexed points within the box
   */
  search(bbox: BBox): IndexedPoint[] {
    return this.tree.search(bbox);
  }

  /**
   * Find the nearest point to a given location
   *
   * @param x - Query x coordinate
   * @param y - Query y coordinate
   * @param maxDistance - Maximum search distance
   * @returns Nearest point and distance, or null if none found
   */
  nearest(
    x: number,
    y: number,
    maxDistance: number = Infinity
  ): { item: IndexedPoint; distance: number } | null {
    const candidates = this.tree.search({
      minX: x - maxDistance,
      minY: y - maxDistance,
      maxX: x + maxDistance,
      maxY: y + maxDistance,
    });

    if (candidates.length === 0) return null;

    let nearest: IndexedPoint | null = null;
    let minDist = Infinity;

    for (const item of candidates) {
      const dx = item.point.x - x;
      const dy = item.point.y - y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < minDist && dist <= maxDistance) {
        minDist = dist;
        nearest = item;
      }
    }

    return nearest ? { item: nearest, distance: minDist } : null;
  }

  /**
   * Find all points within a given distance
   *
   * @param x - Query x coordinate
   * @param y - Query y coordinate
   * @param radius - Search radius
   * @returns Array of points within radius
   */
  withinRadius(x: number, y: number, radius: number): IndexedPoint[] {
    const candidates = this.tree.search({
      minX: x - radius,
      minY: y - radius,
      maxX: x + radius,
      maxY: y + radius,
    });

    const radiusSq = radius * radius;
    return candidates.filter((item) => {
      const dx = item.point.x - x;
      const dy = item.point.y - y;
      return dx * dx + dy * dy <= radiusSq;
    });
  }

  /**
   * Get the total number of indexed points
   */
  get size(): number {
    return this.items.length;
  }
}

/**
 * Segment spatial index using R-tree
 * Optimized for finding segments that overlap a region
 */
export class SegmentIndex {
  private tree: RBush<IndexedSegment>;
  private items: IndexedSegment[] = [];

  constructor(nodeCapacity: number = 9) {
    this.tree = new RBush<IndexedSegment>(nodeCapacity);
  }

  /**
   * Clear all indexed segments
   */
  clear(): void {
    this.tree.clear();
    this.items = [];
  }

  /**
   * Add a segment to the index
   *
   * @param segment - Path segment
   * @param segmentIndex - Index of the segment
   * @param layerId - Optional layer identifier
   */
  addSegment(segment: PathSegment, segmentIndex: number, layerId?: string): void {
    const bbox = computeSegmentBBox(segment);
    const item: IndexedSegment = {
      ...bbox,
      segment,
      segmentIndex,
      layerId,
    };

    this.items.push(item);
    this.tree.insert(item);
  }

  /**
   * Add multiple segments at once (more efficient than individual adds)
   *
   * @param segments - Array of path segments
   * @param layerId - Optional layer identifier
   */
  bulkAdd(segments: PathSegment[], layerId?: string): void {
    const allItems: IndexedSegment[] = segments.map((segment, segmentIndex) => ({
      ...computeSegmentBBox(segment),
      segment,
      segmentIndex,
      layerId,
    }));

    this.items = allItems;
    this.tree.clear();
    this.tree.load(allItems);
  }

  /**
   * Find all segments that overlap a bounding box
   *
   * @param bbox - Search bounding box
   * @returns Array of segments overlapping the box
   */
  search(bbox: BBox): IndexedSegment[] {
    return this.tree.search(bbox);
  }

  /**
   * Find segments that might contain a point (within tolerance)
   *
   * @param x - Query x coordinate
   * @param y - Query y coordinate
   * @param tolerance - Search tolerance
   * @returns Array of candidate segments
   */
  findAtPoint(x: number, y: number, tolerance: number = 1): IndexedSegment[] {
    return this.tree.search({
      minX: x - tolerance,
      minY: y - tolerance,
      maxX: x + tolerance,
      maxY: y + tolerance,
    });
  }

  /**
   * Get all indexed segments
   */
  all(): IndexedSegment[] {
    return this.tree.all();
  }

  /**
   * Get the total number of indexed segments
   */
  get size(): number {
    return this.items.length;
  }
}

/**
 * Compute the bounding box of a path segment
 */
export function computeSegmentBBox(segment: PathSegment): BBox {
  if (segment.points.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const point of segment.points) {
    if (point.x < minX) minX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.x > maxX) maxX = point.x;
    if (point.y > maxY) maxY = point.y;
  }

  return { minX, minY, maxX, maxY };
}

/**
 * Check if two bounding boxes intersect
 */
export function bboxIntersects(a: BBox, b: BBox): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
}

/**
 * Check if a point is inside a bounding box
 */
export function bboxContainsPoint(bbox: BBox, x: number, y: number): boolean {
  return x >= bbox.minX && x <= bbox.maxX && y >= bbox.minY && y <= bbox.maxY;
}

/**
 * Compute the distance from a point to the nearest point on a line segment
 */
export function pointToSegmentDistance(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSq = dx * dx + dy * dy;

  if (lengthSq === 0) {
    // Segment is a point
    const ddx = px - x1;
    const ddy = py - y1;
    return Math.sqrt(ddx * ddx + ddy * ddy);
  }

  // Project point onto line, clamped to segment
  let t = ((px - x1) * dx + (py - y1) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));

  const closestX = x1 + t * dx;
  const closestY = y1 + t * dy;

  const ddx = px - closestX;
  const ddy = py - closestY;
  return Math.sqrt(ddx * ddx + ddy * ddy);
}

/**
 * Find the exact distance from a point to the nearest point on a path segment
 */
export function pointToPathDistance(x: number, y: number, segment: PathSegment): number {
  if (segment.points.length === 0) return Infinity;
  if (segment.points.length === 1) {
    const p = segment.points[0];
    const dx = x - p.x;
    const dy = y - p.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  let minDist = Infinity;

  for (let i = 0; i < segment.points.length - 1; i++) {
    const p1 = segment.points[i];
    const p2 = segment.points[i + 1];
    const dist = pointToSegmentDistance(x, y, p1.x, p1.y, p2.x, p2.y);
    if (dist < minDist) {
      minDist = dist;
    }
  }

  return minDist;
}
