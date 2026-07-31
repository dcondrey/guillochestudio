import { describe, it, expect, beforeEach } from 'vitest';
import {
  PointIndex,
  SegmentIndex,
  computeSegmentBBox,
  bboxIntersects,
  bboxContainsPoint,
  pointToSegmentDistance,
  pointToPathDistance,
} from '../spatial/rtree.js';
import type { PathSegment } from '../engine.js';
import type { BBox } from '../spatial/rtree.js';

describe('PointIndex', () => {
  let index: PointIndex;

  beforeEach(() => {
    index = new PointIndex();
  });

  describe('bulkAdd', () => {
    it('should add points from segments', () => {
      const segments: PathSegment[] = [
        {
          points: [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
            { x: 100, y: 100 },
          ],
        },
      ];

      index.bulkAdd(segments);

      expect(index.size).toBe(3);
    });

    it('should assign layer IDs', () => {
      const segments: PathSegment[] = [{ points: [{ x: 0, y: 0 }] }];

      index.bulkAdd(segments, 'layer-1');

      const results = index.search({ minX: -10, minY: -10, maxX: 10, maxY: 10 });
      expect(results[0].layerId).toBe('layer-1');
    });
  });

  describe('search', () => {
    beforeEach(() => {
      const segments: PathSegment[] = [
        {
          points: [
            { x: 0, y: 0 },
            { x: 50, y: 50 },
            { x: 100, y: 100 },
            { x: 200, y: 200 },
          ],
        },
      ];
      index.bulkAdd(segments);
    });

    it('should find points within bbox', () => {
      const bbox: BBox = { minX: 40, minY: 40, maxX: 110, maxY: 110 };
      const results = index.search(bbox);

      expect(results.length).toBe(2);
      expect(results.map((r) => r.point.x)).toContain(50);
      expect(results.map((r) => r.point.x)).toContain(100);
    });

    it('should return empty for non-matching bbox', () => {
      const bbox: BBox = { minX: 300, minY: 300, maxX: 400, maxY: 400 };
      const results = index.search(bbox);

      expect(results.length).toBe(0);
    });
  });

  describe('nearest', () => {
    beforeEach(() => {
      const segments: PathSegment[] = [
        {
          points: [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
            { x: 100, y: 100 },
            { x: 0, y: 100 },
          ],
        },
      ];
      index.bulkAdd(segments);
    });

    it('should find nearest point', () => {
      const result = index.nearest(95, 5, 50);

      expect(result).not.toBeNull();
      expect(result!.item.point.x).toBe(100);
      expect(result!.item.point.y).toBe(0);
    });

    it('should respect max distance', () => {
      const result = index.nearest(500, 500, 10);

      expect(result).toBeNull();
    });
  });

  describe('withinRadius', () => {
    beforeEach(() => {
      const segments: PathSegment[] = [
        {
          points: [
            { x: 0, y: 0 },
            { x: 10, y: 10 },
            { x: 100, y: 100 },
            { x: 200, y: 200 },
          ],
        },
      ];
      index.bulkAdd(segments);
    });

    it('should find all points within radius', () => {
      const results = index.withinRadius(5, 5, 20);

      expect(results.length).toBe(2);
      expect(results.map((r) => r.point.x)).toContain(0);
      expect(results.map((r) => r.point.x)).toContain(10);
    });
  });
});

describe('SegmentIndex', () => {
  let index: SegmentIndex;

  beforeEach(() => {
    index = new SegmentIndex();
  });

  describe('bulkAdd', () => {
    it('should add path segments', () => {
      const segments: PathSegment[] = [
        {
          points: [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
            { x: 100, y: 100 },
          ],
        },
        {
          points: [
            { x: 200, y: 200 },
            { x: 300, y: 300 },
          ],
        },
      ];

      index.bulkAdd(segments);

      // SegmentIndex indexes entire PathSegments, not individual line segments
      expect(index.size).toBe(2);
    });
  });

  describe('search', () => {
    beforeEach(() => {
      const segments: PathSegment[] = [
        {
          points: [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
            { x: 100, y: 100 },
            { x: 0, y: 100 },
            { x: 0, y: 0 },
          ],
        },
      ];
      index.bulkAdd(segments);
    });

    it('should find segments intersecting bbox', () => {
      // This bbox should intersect the top and right edges
      const bbox: BBox = { minX: 50, minY: -10, maxX: 110, maxY: 50 };
      const results = index.search(bbox);

      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('findAtPoint', () => {
    beforeEach(() => {
      const segments: PathSegment[] = [
        {
          points: [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
          ],
        },
      ];
      index.bulkAdd(segments);
    });

    it('should find segment at point with tolerance', () => {
      const results = index.findAtPoint(50, 3, 5);

      expect(results.length).toBe(1);
    });

    it('should not find segment outside tolerance', () => {
      const results = index.findAtPoint(50, 50, 5);

      expect(results.length).toBe(0);
    });
  });
});

describe('BBox Utilities', () => {
  describe('computeSegmentBBox', () => {
    it('should compute bounding box', () => {
      const segment: PathSegment = {
        points: [
          { x: 10, y: 20 },
          { x: 100, y: 5 },
          { x: 50, y: 150 },
        ],
      };

      const bbox = computeSegmentBBox(segment);

      expect(bbox.minX).toBe(10);
      expect(bbox.minY).toBe(5);
      expect(bbox.maxX).toBe(100);
      expect(bbox.maxY).toBe(150);
    });
  });

  describe('bboxIntersects', () => {
    it('should detect overlapping boxes', () => {
      const a: BBox = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
      const b: BBox = { minX: 50, minY: 50, maxX: 150, maxY: 150 };

      expect(bboxIntersects(a, b)).toBe(true);
    });

    it('should detect non-overlapping boxes', () => {
      const a: BBox = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
      const b: BBox = { minX: 200, minY: 200, maxX: 300, maxY: 300 };

      expect(bboxIntersects(a, b)).toBe(false);
    });

    it('should detect touching boxes', () => {
      const a: BBox = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
      const b: BBox = { minX: 100, minY: 0, maxX: 200, maxY: 100 };

      expect(bboxIntersects(a, b)).toBe(true);
    });
  });

  describe('bboxContainsPoint', () => {
    const bbox: BBox = { minX: 0, minY: 0, maxX: 100, maxY: 100 };

    it('should detect point inside', () => {
      expect(bboxContainsPoint(bbox, 50, 50)).toBe(true);
    });

    it('should detect point outside', () => {
      expect(bboxContainsPoint(bbox, 150, 50)).toBe(false);
    });

    it('should detect point on edge', () => {
      expect(bboxContainsPoint(bbox, 0, 50)).toBe(true);
    });
  });
});

describe('Distance Functions', () => {
  describe('pointToSegmentDistance', () => {
    it('should calculate distance to line segment', () => {
      // Point at (50, 10), line from (0,0) to (100,0)
      const dist = pointToSegmentDistance(50, 10, 0, 0, 100, 0);

      expect(dist).toBeCloseTo(10, 5);
    });

    it('should handle point projection outside segment', () => {
      // Point at (150, 0), line from (0,0) to (100,0)
      const dist = pointToSegmentDistance(150, 0, 0, 0, 100, 0);

      expect(dist).toBeCloseTo(50, 5);
    });

    it('should handle point on segment', () => {
      // Point at (50, 0), line from (0,0) to (100,0)
      const dist = pointToSegmentDistance(50, 0, 0, 0, 100, 0);

      expect(dist).toBeCloseTo(0, 5);
    });
  });

  describe('pointToPathDistance', () => {
    it('should find minimum distance to path', () => {
      const segment: PathSegment = {
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 100 },
        ],
      };

      const dist = pointToPathDistance(50, 10, segment);

      expect(dist).toBeCloseTo(10, 5);
    });
  });
});
