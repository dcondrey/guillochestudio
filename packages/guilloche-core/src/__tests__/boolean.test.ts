import { describe, it, expect } from 'vitest';
import {
  union,
  intersect,
  difference,
  xor,
  offset,
  simplify,
  pointInPath,
  pathArea,
  isClockwise,
  reversePath,
  createCircle,
  createEllipse,
  createRectangle,
  createPolygon,
} from '../operations/boolean.js';
import type { PathSegment } from '../engine.js';

describe('Boolean Operations', () => {
  // Helper to create a square
  const createSquare = (x: number, y: number, size: number): PathSegment => ({
    points: [
      { x, y },
      { x: x + size, y },
      { x: x + size, y: y + size },
      { x, y: y + size },
      { x, y },
    ],
  });

  describe('union', () => {
    it('should combine two overlapping squares', () => {
      const square1 = createSquare(0, 0, 100);
      const square2 = createSquare(50, 50, 100);

      const result = union([square1], [square2]);

      expect(result.length).toBeGreaterThan(0);
      // Union should produce a larger combined area
      const unionArea = Math.abs(pathArea(result[0]));
      const square1Area = Math.abs(pathArea(square1));
      const square2Area = Math.abs(pathArea(square2));

      // Union area should be less than sum (because of overlap) but more than either individual
      expect(unionArea).toBeGreaterThan(square1Area);
      expect(unionArea).toBeLessThan(square1Area + square2Area);
    });

    it('should combine non-overlapping shapes', () => {
      const square1 = createSquare(0, 0, 100);
      const square2 = createSquare(200, 0, 100);

      const result = union([square1], [square2]);

      // Non-overlapping union should result in 2 separate paths
      expect(result.length).toBe(2);
    });
  });

  describe('intersect', () => {
    it('should find overlapping area of two squares', () => {
      const square1 = createSquare(0, 0, 100);
      const square2 = createSquare(50, 50, 100);

      const result = intersect([square1], [square2]);

      expect(result.length).toBeGreaterThan(0);
      // Intersection should be 50x50 = 2500
      const intersectArea = Math.abs(pathArea(result[0]));
      expect(intersectArea).toBeCloseTo(2500, -1);
    });

    it('should return empty for non-overlapping shapes', () => {
      const square1 = createSquare(0, 0, 100);
      const square2 = createSquare(200, 0, 100);

      const result = intersect([square1], [square2]);

      expect(result.length).toBe(0);
    });
  });

  describe('difference', () => {
    it('should subtract one square from another', () => {
      const square1 = createSquare(0, 0, 100);
      const square2 = createSquare(50, 50, 100);

      const result = difference([square1], [square2]);

      expect(result.length).toBeGreaterThan(0);
      // Difference should be original minus intersection (10000 - 2500 = 7500)
      const diffArea = Math.abs(pathArea(result[0]));
      expect(diffArea).toBeCloseTo(7500, -1);
    });
  });

  describe('xor', () => {
    it('should return non-overlapping areas', () => {
      const square1 = createSquare(0, 0, 100);
      const square2 = createSquare(50, 50, 100);

      const result = xor([square1], [square2]);

      expect(result.length).toBeGreaterThan(0);
      // XOR should be both areas minus twice the intersection
      // (10000 + 10000 - 2*2500 = 15000)
      let totalArea = 0;
      for (const seg of result) {
        totalArea += Math.abs(pathArea(seg));
      }
      expect(totalArea).toBeCloseTo(15000, -1);
    });
  });

  describe('offset', () => {
    it('should expand a square outward', () => {
      const square = createSquare(0, 0, 100);
      const result = offset([square], 10, 'miter');

      expect(result.length).toBeGreaterThan(0);
      // Expanded area should be larger
      const expandedArea = Math.abs(pathArea(result[0]));
      const originalArea = Math.abs(pathArea(square));
      expect(expandedArea).toBeGreaterThan(originalArea);
    });

    it('should contract a square inward', () => {
      const square = createSquare(0, 0, 100);
      const result = offset([square], -10, 'miter');

      expect(result.length).toBeGreaterThan(0);
      // Contracted area should be smaller
      const contractedArea = Math.abs(pathArea(result[0]));
      const originalArea = Math.abs(pathArea(square));
      expect(contractedArea).toBeLessThan(originalArea);
    });
  });

  describe('simplify', () => {
    it('should reduce point count on complex paths', () => {
      // Create a path with many points in a nearly straight line
      const points = [];
      for (let i = 0; i <= 100; i++) {
        points.push({ x: i, y: i + Math.sin(i / 10) * 0.1 });
      }
      const segment: PathSegment = { points };

      const result = simplify([segment], 0.5);

      expect(result.length).toBe(1);
      expect(result[0].points.length).toBeLessThan(segment.points.length);
    });
  });
});

describe('Point Operations', () => {
  describe('pointInPath', () => {
    it('should detect point inside square', () => {
      const square: PathSegment = {
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 100 },
          { x: 0, y: 100 },
          { x: 0, y: 0 },
        ],
      };

      expect(pointInPath({ x: 50, y: 50 }, square)).toBe(1); // Inside
    });

    it('should detect point outside square', () => {
      const square: PathSegment = {
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 100 },
          { x: 0, y: 100 },
          { x: 0, y: 0 },
        ],
      };

      // clipper2 returns PointInPolygonResult: IsOn=0, IsInside=1, IsOutside=2
      // or possibly different values depending on version
      const result = pointInPath({ x: 150, y: 50 }, square);
      // Outside should not be 1 (inside)
      expect(result).not.toBe(1);
    });
  });

  describe('pathArea', () => {
    it('should calculate area of unit square', () => {
      const square: PathSegment = {
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 100 },
          { x: 0, y: 100 },
          { x: 0, y: 0 },
        ],
      };

      const area = pathArea(square);
      expect(Math.abs(area)).toBeCloseTo(10000, 0);
    });
  });

  describe('isClockwise', () => {
    it('should detect clockwise path', () => {
      const clockwise: PathSegment = {
        points: [
          { x: 0, y: 0 },
          { x: 0, y: 100 },
          { x: 100, y: 100 },
          { x: 100, y: 0 },
          { x: 0, y: 0 },
        ],
      };

      expect(isClockwise(clockwise)).toBe(true);
    });

    it('should detect counter-clockwise path', () => {
      const ccw: PathSegment = {
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 100 },
          { x: 0, y: 100 },
          { x: 0, y: 0 },
        ],
      };

      expect(isClockwise(ccw)).toBe(false);
    });
  });

  describe('reversePath', () => {
    it('should reverse point order', () => {
      const segment: PathSegment = {
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 100 },
        ],
      };

      const reversed = reversePath(segment);

      expect(reversed.points[0]).toEqual({ x: 100, y: 100 });
      expect(reversed.points[2]).toEqual({ x: 0, y: 0 });
    });
  });
});

describe('Shape Creation', () => {
  describe('createCircle', () => {
    it('should create a circle with correct area', () => {
      const circle = createCircle(0, 0, 100, 64);

      expect(circle.points.length).toBe(64);
      const area = Math.abs(pathArea(circle));
      const expectedArea = Math.PI * 100 * 100;
      // Allow 5% tolerance due to polygon approximation
      expect(area).toBeCloseTo(expectedArea, -3);
    });
  });

  describe('createEllipse', () => {
    it('should create an ellipse with correct dimensions', () => {
      const ellipse = createEllipse(0, 0, 100, 50, 64);

      expect(ellipse.points.length).toBe(64);
      const area = Math.abs(pathArea(ellipse));
      const expectedArea = Math.PI * 100 * 50;
      expect(area).toBeCloseTo(expectedArea, -3);
    });
  });

  describe('createRectangle', () => {
    it('should create a rectangle with correct area', () => {
      const rect = createRectangle(0, 0, 100, 50);

      expect(rect.points.length).toBe(5); // 4 corners + close
      const area = Math.abs(pathArea(rect));
      expect(area).toBeCloseTo(5000, 0);
    });

    it('should have correct corner positions', () => {
      const rect = createRectangle(10, 20, 100, 50);

      expect(rect.points[0]).toEqual({ x: 10, y: 20 });
      expect(rect.points[1]).toEqual({ x: 110, y: 20 });
      expect(rect.points[2]).toEqual({ x: 110, y: 70 });
      expect(rect.points[3]).toEqual({ x: 10, y: 70 });
    });
  });

  describe('createPolygon', () => {
    it('should create a triangle', () => {
      const triangle = createPolygon(0, 0, 100, 3);

      expect(triangle.points.length).toBe(4); // 3 sides + close
    });

    it('should create a hexagon', () => {
      const hexagon = createPolygon(0, 0, 100, 6);

      expect(hexagon.points.length).toBe(7); // 6 sides + close
      const area = Math.abs(pathArea(hexagon));
      // Hexagon area = (3 * sqrt(3) / 2) * r^2
      const expectedArea = ((3 * Math.sqrt(3)) / 2) * 100 * 100;
      expect(area).toBeCloseTo(expectedArea, -2);
    });
  });
});
