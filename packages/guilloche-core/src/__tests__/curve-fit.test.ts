import { describe, it, expect } from 'vitest';
import { fitCurve, evaluateBezier, bezierToSVGPath, flattenBezier } from '../utils/curve-fit.js';
import { simplifyPath, simplifyCombined, pathLength } from '../utils/simplify.js';
import type { BezierSegment } from '../utils/curve-fit.js';
import type { Point } from '../engine.js';

describe('Curve Fitting', () => {
  describe('fitCurve', () => {
    it('should fit a straight line', () => {
      const points: Point[] = [
        { x: 0, y: 0 },
        { x: 50, y: 0 },
        { x: 100, y: 0 },
      ];

      const beziers = fitCurve(points, 1.0);

      expect(beziers.length).toBeGreaterThan(0);
      // Start and end should match original
      expect(beziers[0].p0.x).toBeCloseTo(0);
      expect(beziers[beziers.length - 1].p3.x).toBeCloseTo(100);
    });

    it('should fit a smooth curve', () => {
      // Generate a sine wave
      const points: Point[] = [];
      for (let i = 0; i <= 100; i++) {
        points.push({
          x: i,
          y: Math.sin(i / 10) * 50,
        });
      }

      const beziers = fitCurve(points, 2.0);

      // Should reduce to fewer bezier segments than original points
      expect(beziers.length).toBeLessThan(points.length / 2);
      expect(beziers.length).toBeGreaterThan(0);
    });

    it('should preserve endpoints', () => {
      const points: Point[] = [
        { x: 10, y: 20 },
        { x: 50, y: 80 },
        { x: 90, y: 30 },
      ];

      const beziers = fitCurve(points, 1.0);

      expect(beziers[0].p0.x).toBeCloseTo(10);
      expect(beziers[0].p0.y).toBeCloseTo(20);
      expect(beziers[beziers.length - 1].p3.x).toBeCloseTo(90);
      expect(beziers[beziers.length - 1].p3.y).toBeCloseTo(30);
    });

    it('should handle minimum points', () => {
      const points: Point[] = [
        { x: 0, y: 0 },
        { x: 100, y: 100 },
      ];

      const beziers = fitCurve(points, 1.0);

      // Should produce at least one bezier
      expect(beziers.length).toBeGreaterThanOrEqual(1);
    });

    it('should return empty for single point', () => {
      const points: Point[] = [{ x: 0, y: 0 }];

      const beziers = fitCurve(points, 1.0);

      expect(beziers.length).toBe(0);
    });

    it('should respect error tolerance', () => {
      // Generate noisy data
      const points: Point[] = [];
      for (let i = 0; i <= 50; i++) {
        points.push({
          x: i * 2,
          y: i * 2 + (Math.random() - 0.5) * 5,
        });
      }

      const looseFit = fitCurve(points, 10.0);
      const tightFit = fitCurve(points, 1.0);

      // Tighter tolerance should produce more segments
      expect(tightFit.length).toBeGreaterThanOrEqual(looseFit.length);
    });
  });

  describe('evaluateBezier', () => {
    const bezier: BezierSegment = {
      p0: { x: 0, y: 0 },
      p1: { x: 33, y: 50 },
      p2: { x: 66, y: 50 },
      p3: { x: 100, y: 0 },
    };

    it('should return start point at t=0', () => {
      const point = evaluateBezier(bezier, 0);

      expect(point.x).toBeCloseTo(0);
      expect(point.y).toBeCloseTo(0);
    });

    it('should return end point at t=1', () => {
      const point = evaluateBezier(bezier, 1);

      expect(point.x).toBeCloseTo(100);
      expect(point.y).toBeCloseTo(0);
    });

    it('should return midpoint at t=0.5', () => {
      const point = evaluateBezier(bezier, 0.5);

      // Should be roughly at x=50
      expect(point.x).toBeCloseTo(50, 0);
      // Should be above 0 due to control points
      expect(point.y).toBeGreaterThan(0);
    });

    it('should interpolate smoothly', () => {
      const t1 = evaluateBezier(bezier, 0.25);
      const t2 = evaluateBezier(bezier, 0.5);
      const t3 = evaluateBezier(bezier, 0.75);

      // X should increase monotonically
      expect(t2.x).toBeGreaterThan(t1.x);
      expect(t3.x).toBeGreaterThan(t2.x);
    });
  });

  describe('bezierToSVGPath', () => {
    it('should generate valid SVG path', () => {
      const beziers: BezierSegment[] = [
        {
          p0: { x: 0, y: 0 },
          p1: { x: 33, y: 50 },
          p2: { x: 66, y: 50 },
          p3: { x: 100, y: 0 },
        },
      ];

      const path = bezierToSVGPath(beziers, 2);

      expect(path).toContain('M 0.00 0.00');
      expect(path).toContain('C');
      expect(path).toContain('100.00');
    });

    it('should chain multiple beziers', () => {
      const beziers: BezierSegment[] = [
        {
          p0: { x: 0, y: 0 },
          p1: { x: 10, y: 20 },
          p2: { x: 20, y: 20 },
          p3: { x: 30, y: 0 },
        },
        {
          p0: { x: 30, y: 0 },
          p1: { x: 40, y: -20 },
          p2: { x: 50, y: -20 },
          p3: { x: 60, y: 0 },
        },
      ];

      const path = bezierToSVGPath(beziers, 1);

      // Should start with M and have 2 C commands
      expect(path.match(/M/g)?.length).toBe(1);
      expect(path.match(/C/g)?.length).toBe(2);
    });

    it('should respect precision', () => {
      const beziers: BezierSegment[] = [
        {
          p0: { x: 0.123456789, y: 0.987654321 },
          p1: { x: 10, y: 20 },
          p2: { x: 20, y: 20 },
          p3: { x: 30, y: 0 },
        },
      ];

      const path2 = bezierToSVGPath(beziers, 2);
      const path4 = bezierToSVGPath(beziers, 4);

      expect(path2).toContain('0.12');
      expect(path4).toContain('0.1235');
    });

    it('should handle empty array', () => {
      const path = bezierToSVGPath([], 2);

      expect(path).toBe('');
    });
  });

  describe('flattenBezier', () => {
    const beziers: BezierSegment[] = [
      {
        p0: { x: 0, y: 0 },
        p1: { x: 33, y: 100 },
        p2: { x: 66, y: 100 },
        p3: { x: 100, y: 0 },
      },
    ];

    it('should return points along the curve', () => {
      const points = flattenBezier(beziers, 1.0);

      expect(points.length).toBeGreaterThan(2);
      // First point should be start
      expect(points[0].x).toBeCloseTo(0);
      expect(points[0].y).toBeCloseTo(0);
      // Last point should be end
      expect(points[points.length - 1].x).toBeCloseTo(100);
      expect(points[points.length - 1].y).toBeCloseTo(0);
    });

    it('should produce more points with lower flatness', () => {
      const coarse = flattenBezier(beziers, 10.0);
      const fine = flattenBezier(beziers, 0.5);

      expect(fine.length).toBeGreaterThanOrEqual(coarse.length);
    });

    it('should maintain curve shape', () => {
      const points = flattenBezier(beziers, 1.0);

      // Find highest point (should be in the middle, above 0)
      let maxY = 0;
      for (const p of points) {
        if (p.y > maxY) maxY = p.y;
      }

      expect(maxY).toBeGreaterThan(50);
    });

    it('should handle multiple beziers', () => {
      const multiBeziers: BezierSegment[] = [
        {
          p0: { x: 0, y: 0 },
          p1: { x: 25, y: 50 },
          p2: { x: 50, y: 50 },
          p3: { x: 75, y: 0 },
        },
        {
          p0: { x: 75, y: 0 },
          p1: { x: 100, y: -50 },
          p2: { x: 125, y: -50 },
          p3: { x: 150, y: 0 },
        },
      ];

      const points = flattenBezier(multiBeziers, 1.0);

      // Should start at first curve start
      expect(points[0].x).toBeCloseTo(0);
      // Should end at last curve end
      expect(points[points.length - 1].x).toBeCloseTo(150);
    });
  });
});

describe('Simplification', () => {
  describe('simplifyPath (RDP)', () => {
    it('should preserve endpoints', () => {
      const points: Point[] = [
        { x: 0, y: 0 },
        { x: 50, y: 1 },
        { x: 100, y: 0 },
      ];

      const simplified = simplifyPath(points, 0.5);

      expect(simplified[0]).toEqual(points[0]);
      expect(simplified[simplified.length - 1]).toEqual(points[points.length - 1]);
    });

    it('should reduce nearly collinear points', () => {
      const points: Point[] = [];
      for (let i = 0; i <= 100; i++) {
        points.push({ x: i, y: i + (Math.random() - 0.5) * 0.1 });
      }

      const simplified = simplifyPath(points, 1.0);

      expect(simplified.length).toBeLessThan(points.length);
    });

    it('should preserve sharp corners', () => {
      const points: Point[] = [
        { x: 0, y: 0 },
        { x: 50, y: 0 },
        { x: 50, y: 50 },
        { x: 100, y: 50 },
      ];

      const simplified = simplifyPath(points, 0.1);

      expect(simplified.length).toBe(4);
    });
  });

  describe('simplifyCombined', () => {
    it('should apply both radial and RDP simplification', () => {
      // Create path with clustered points and noise
      const points: Point[] = [];
      for (let i = 0; i < 100; i++) {
        points.push({
          x: i + (Math.random() - 0.5) * 0.5,
          y: Math.sin(i / 10) * 50 + (Math.random() - 0.5) * 2,
        });
      }

      const simplified = simplifyCombined(points, 1.0, 2.0);

      expect(simplified.length).toBeLessThan(points.length);
      expect(simplified.length).toBeGreaterThan(2);
    });
  });

  describe('pathLength', () => {
    it('should calculate length of straight line', () => {
      const points: Point[] = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ];

      const length = pathLength(points);

      expect(length).toBeCloseTo(100, 5);
    });

    it('should calculate length of L-shaped path', () => {
      const points: Point[] = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
      ];

      const length = pathLength(points);

      expect(length).toBeCloseTo(200, 5);
    });

    it('should return 0 for single point', () => {
      const length = pathLength([{ x: 0, y: 0 }]);

      expect(length).toBe(0);
    });
  });
});
