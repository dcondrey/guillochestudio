/**
 * Unit tests for @guilloche/core GuillocheEngine
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GuillocheEngine, GeneratedPath, Point, PathSegment } from '../engine.js';
import type { PatternParams } from '@guilloche/shared';

describe('GuillocheEngine', () => {
  let engine: GuillocheEngine;

  beforeEach(() => {
    engine = new GuillocheEngine();
  });

  // ===========================================================================
  // Constructor and Parameter Management
  // ===========================================================================
  describe('constructor', () => {
    it('should create engine with default params', () => {
      const params = engine.getParams();
      expect(params.mode).toBe('curve');
      expect(params.family).toBe('hypo');
      expect(params.R).toBe(240);
      expect(params.r).toBe(79);
    });

    it('should merge custom params with defaults', () => {
      const customEngine = new GuillocheEngine({ R: 100, r: 50 });
      const params = customEngine.getParams();
      expect(params.R).toBe(100);
      expect(params.r).toBe(50);
      expect(params.family).toBe('hypo'); // Default preserved
    });
  });

  describe('setParams', () => {
    it('should update parameters', () => {
      engine.setParams({ R: 150, family: 'rose' });
      const params = engine.getParams();
      expect(params.R).toBe(150);
      expect(params.family).toBe('rose');
    });

    it('should clear cache when params change', () => {
      // Compute path to populate cache
      const path1 = engine.computePath();

      // Change params
      engine.setParams({ R: 100 });

      // Compute again - should not return cached result
      const path2 = engine.computePath();

      // Paths should be different since R changed
      expect(path2.params.R).toBe(100);
      expect(path1.params.R).toBe(240);
    });
  });

  describe('getParams', () => {
    it('should return a deep clone', () => {
      const params1 = engine.getParams();
      params1.R = 999;
      const params2 = engine.getParams();
      expect(params2.R).toBe(240); // Original unchanged
    });
  });

  // ===========================================================================
  // Cache Key Generation
  // ===========================================================================
  describe('cache key optimization', () => {
    it('should return same path from cache on repeated calls', () => {
      const path1 = engine.computePath();
      const path2 = engine.computePath();
      expect(path1).toBe(path2); // Same reference (cached)
    });

    it('should invalidate cache when params change', () => {
      const path1 = engine.computePath();
      engine.setParams({ R: 100 });
      const path2 = engine.computePath();
      expect(path1).not.toBe(path2);
    });

    it('should generate different keys for different modes', () => {
      engine.setParams({ mode: 'curve' });
      const curveKey = engine.computePath();

      engine.setParams({ mode: 'rosette' });
      const rosetteKey = engine.computePath();

      expect(curveKey).not.toBe(rosetteKey);
    });
  });

  // ===========================================================================
  // computePath - Curve Mode
  // ===========================================================================
  describe('computePath - curve mode', () => {
    beforeEach(() => {
      engine.setParams({ mode: 'curve', steps: 1000 });
    });

    it('should generate path with segments', () => {
      const path = engine.computePath();
      expect(path.segments).toBeDefined();
      expect(path.segments.length).toBeGreaterThan(0);
    });

    it('should generate points in each segment', () => {
      const path = engine.computePath();
      expect(path.segments[0].points.length).toBeGreaterThan(0);
    });

    it('should compute valid bounds', () => {
      const path = engine.computePath();
      expect(Number.isFinite(path.bounds.minX)).toBe(true);
      expect(Number.isFinite(path.bounds.maxX)).toBe(true);
      expect(Number.isFinite(path.bounds.minY)).toBe(true);
      expect(Number.isFinite(path.bounds.maxY)).toBe(true);
      expect(path.bounds.maxX).toBeGreaterThan(path.bounds.minX);
      expect(path.bounds.maxY).toBeGreaterThan(path.bounds.minY);
    });

    it('should store params in result', () => {
      engine.setParams({ R: 123, family: 'rose' });
      const path = engine.computePath();
      expect(path.params.R).toBe(123);
      expect(path.params.family).toBe('rose');
    });

    it('should handle symmetry', () => {
      engine.setParams({ symmetry: 4, steps: 500 });
      const path = engine.computePath();
      expect(path.segments.length).toBe(4);
    });

    it('should apply reflectH', () => {
      engine.setParams({ reflectH: true, symmetry: 1, steps: 100 });
      const path = engine.computePath();
      // Points should be reflected horizontally
      const hasNegativeX = path.segments[0].points.some((p) => p.x < 0);
      expect(hasNegativeX).toBe(true);
    });

    it('should apply reflectV', () => {
      engine.setParams({ reflectV: true, symmetry: 1, steps: 100 });
      const path = engine.computePath();
      // Points should be reflected vertically
      const hasNegativeY = path.segments[0].points.some((p) => p.y < 0);
      expect(hasNegativeY).toBe(true);
    });

    it('should apply scale', () => {
      engine.setParams({ s: 2, symmetry: 1, steps: 100 });
      const pathScaled = engine.computePath();

      engine.setParams({ s: 1 });
      const pathNormal = engine.computePath();

      // Scaled path should have larger bounds
      const scaledSize = pathScaled.bounds.maxX - pathScaled.bounds.minX;
      const normalSize = pathNormal.bounds.maxX - pathNormal.bounds.minX;
      expect(scaledSize).toBeGreaterThan(normalSize * 1.5);
    });
  });

  // ===========================================================================
  // computePath - Rosette Mode
  // ===========================================================================
  describe('computePath - rosette mode', () => {
    beforeEach(() => {
      engine.setParams({
        mode: 'rosette',
        steps: 500,
        rosette: {
          envelope: 'circle',
          innerRadius: 0.15,
          outerRadius: 200,
          fillDensity: 4,
          envelopeSides: 6,
          starPointiness: 0.5,
          radialWave: 0,
          spiralTwist: 0,
        },
      });
    });

    it('should generate rosette path', () => {
      const path = engine.computePath();
      expect(path.segments.length).toBeGreaterThan(0);
    });

    it('should create multiple rings based on fillDensity', () => {
      engine.setParams({
        mode: 'rosette',
        symmetry: 1,
        rosette: {
          envelope: 'circle',
          innerRadius: 0.15,
          outerRadius: 200,
          fillDensity: 8,
          envelopeSides: 6,
          starPointiness: 0.5,
          radialWave: 0,
          spiralTwist: 0,
        },
      });
      const path = engine.computePath();
      // With fillDensity=8 and symmetry=1, should have 8 segments (one per ring)
      expect(path.segments.length).toBe(8);
    });

    it('should handle polygon envelope', () => {
      engine.setParams({
        mode: 'rosette',
        rosette: {
          envelope: 'polygon',
          innerRadius: 0.15,
          outerRadius: 200,
          fillDensity: 2,
          envelopeSides: 6,
          starPointiness: 0.5,
          radialWave: 0,
          spiralTwist: 0,
        },
      });
      const path = engine.computePath();
      expect(path.segments.length).toBeGreaterThan(0);
    });

    it('should handle star envelope', () => {
      engine.setParams({
        mode: 'rosette',
        rosette: {
          envelope: 'star',
          innerRadius: 0.15,
          outerRadius: 200,
          fillDensity: 2,
          envelopeSides: 5,
          starPointiness: 0.6,
          radialWave: 0,
          spiralTwist: 0,
        },
      });
      const path = engine.computePath();
      expect(path.segments.length).toBeGreaterThan(0);
    });

    it('should apply radial wave modulation', () => {
      engine.setParams({
        mode: 'rosette',
        rosette: {
          envelope: 'circle',
          innerRadius: 0.15,
          outerRadius: 200,
          fillDensity: 2,
          envelopeSides: 6,
          starPointiness: 0.5,
          radialWave: 0.2,
          spiralTwist: 0,
        },
      });
      const path = engine.computePath();
      expect(path.segments.length).toBeGreaterThan(0);
    });
  });

  // ===========================================================================
  // computePath - Border Mode
  // ===========================================================================
  describe('computePath - border mode', () => {
    beforeEach(() => {
      engine.setParams({
        mode: 'border',
        steps: 500,
        symmetry: 1,
        border: {
          length: 800,
          width: 100,
          waveAmplitude: 0,
          waveFrequency: 1,
          repeatCount: 4,
          mirrorAlternate: true,
          taper: 0,
        },
      });
    });

    it('should generate border path', () => {
      const path = engine.computePath();
      expect(path.segments.length).toBeGreaterThan(0);
    });

    it('should create segments based on repeatCount', () => {
      const path = engine.computePath();
      // With repeatCount=4 and symmetry=1, should have 4 segments
      expect(path.segments.length).toBe(4);
    });

    it('should apply wave amplitude', () => {
      engine.setParams({
        mode: 'border',
        border: {
          length: 800,
          width: 100,
          waveAmplitude: 20,
          waveFrequency: 2,
          repeatCount: 2,
          mirrorAlternate: false,
          taper: 0,
        },
      });
      const path = engine.computePath();
      expect(path.segments.length).toBeGreaterThan(0);
    });

    it('should handle symmetry for borders', () => {
      engine.setParams({
        mode: 'border',
        symmetry: 2,
        border: {
          length: 800,
          width: 100,
          waveAmplitude: 0,
          waveFrequency: 1,
          repeatCount: 2,
          mirrorAlternate: false,
          taper: 0,
        },
      });
      const path = engine.computePath();
      // 2 repeats * 2 symmetry = 4 segments
      expect(path.segments.length).toBe(4);
    });
  });

  // ===========================================================================
  // computePath - Grid Mode
  // ===========================================================================
  describe('computePath - grid mode', () => {
    beforeEach(() => {
      engine.setParams({
        mode: 'grid',
        steps: 500,
        grid: {
          tileType: 'square',
          tileWidth: 100,
          tileHeight: 100,
          rows: 2,
          cols: 2,
          spacing: 10,
          stagger: 0,
          rotateAlternate: false,
          scaleVariation: 0,
          angle: 0,
        },
      });
    });

    it('should generate grid path', () => {
      const path = engine.computePath();
      expect(path.segments.length).toBeGreaterThan(0);
    });

    it('should create tiles based on rows*cols', () => {
      const path = engine.computePath();
      // 2x2 grid = 4 tiles
      expect(path.segments.length).toBe(4);
    });

    it('should handle hex tile type with stagger', () => {
      engine.setParams({
        mode: 'grid',
        grid: {
          tileType: 'hex',
          tileWidth: 100,
          tileHeight: 100,
          rows: 3,
          cols: 3,
          spacing: 10,
          stagger: 0.5,
          rotateAlternate: false,
          scaleVariation: 0,
          angle: 0,
        },
      });
      const path = engine.computePath();
      expect(path.segments.length).toBe(9);
    });

    it('should apply rotate alternate', () => {
      engine.setParams({
        mode: 'grid',
        grid: {
          tileType: 'square',
          tileWidth: 100,
          tileHeight: 100,
          rows: 2,
          cols: 2,
          spacing: 10,
          stagger: 0,
          rotateAlternate: true,
          scaleVariation: 0,
          angle: 0,
        },
      });
      const path = engine.computePath();
      expect(path.segments.length).toBe(4);
    });

    it('should apply grid angle rotation', () => {
      engine.setParams({
        mode: 'grid',
        grid: {
          tileType: 'square',
          tileWidth: 100,
          tileHeight: 100,
          rows: 2,
          cols: 2,
          spacing: 10,
          stagger: 0,
          rotateAlternate: false,
          scaleVariation: 0,
          angle: 45,
        },
      });
      const path = engine.computePath();
      expect(path.segments.length).toBe(4);
    });
  });

  // ===========================================================================
  // Clipping
  // ===========================================================================
  describe('applyClipping', () => {
    it('should clip path to crop region', () => {
      engine.setParams({
        mode: 'curve',
        steps: 500,
        symmetry: 1,
        crop: {
          x: -50,
          y: -50,
          width: 100,
          height: 100,
          active: true,
        },
      });
      const path = engine.computePath();
      // Clipping should produce fewer or smaller segments compared to unclipped
      // The clipping algorithm filters out segments entirely outside the region
      expect(path.segments).toBeDefined();

      // At least some segments should have been generated
      const totalPoints = path.segments.reduce((sum, seg) => sum + seg.points.length, 0);
      expect(totalPoints).toBeGreaterThan(0);
    });

    it('should not clip when crop is inactive', () => {
      engine.setParams({
        mode: 'curve',
        steps: 500,
        symmetry: 1,
        crop: {
          x: -50,
          y: -50,
          width: 100,
          height: 100,
          active: false,
        },
      });
      const path = engine.computePath();
      // Points may be outside crop bounds since clipping is inactive
      const maxAbsX = Math.max(...path.segments[0].points.map((p) => Math.abs(p.x)));
      expect(maxAbsX).toBeGreaterThan(100);
    });
  });

  // ===========================================================================
  // Bezier Baking
  // ===========================================================================
  describe('bakeToBezierPath', () => {
    it('should convert path to bezier format', () => {
      engine.setParams({ mode: 'curve', steps: 100, symmetry: 1 });
      const path = engine.computePath();
      const bezier = engine.bakeToBezierPath(path);

      expect(bezier.segments).toBeDefined();
      expect(bezier.segments.length).toBeGreaterThan(0);
    });

    it('should include control points', () => {
      engine.setParams({ mode: 'curve', steps: 100, symmetry: 1 });
      const path = engine.computePath();
      const bezier = engine.bakeToBezierPath(path);

      const firstPoint = bezier.segments[0].points[0];
      expect(firstPoint.cp1).toBeDefined();
      expect(firstPoint.cp2).toBeDefined();
    });

    it('should handle segments with few points', () => {
      // Create a path with very few points
      const minimalPath: GeneratedPath = {
        segments: [
          {
            points: [
              { x: 0, y: 0 },
              { x: 1, y: 1 },
            ],
          },
        ],
        bounds: { minX: 0, minY: 0, maxX: 1, maxY: 1 },
        params: engine.getParams(),
      };

      const bezier = engine.bakeToBezierPath(minimalPath);
      expect(bezier.segments).toBeDefined();
    });
  });

  // ===========================================================================
  // Segment Stitching
  // ===========================================================================
  describe('stitchSegments', () => {
    it('should stitch adjacent segments', () => {
      const pathWithGaps: GeneratedPath = {
        segments: [
          {
            points: [
              { x: 0, y: 0 },
              { x: 1, y: 0 },
            ],
          },
          {
            points: [
              { x: 1, y: 0 },
              { x: 2, y: 0 },
            ],
          },
        ],
        bounds: { minX: 0, minY: 0, maxX: 2, maxY: 0 },
        params: engine.getParams(),
      };

      const stitched = engine.stitchSegments(pathWithGaps, 0.1);
      expect(stitched.segments.length).toBe(1);
      expect(stitched.segments[0].points.length).toBe(3);
    });

    it('should not stitch distant segments', () => {
      const pathWithGaps: GeneratedPath = {
        segments: [
          {
            points: [
              { x: 0, y: 0 },
              { x: 1, y: 0 },
            ],
          },
          {
            points: [
              { x: 10, y: 0 },
              { x: 11, y: 0 },
            ],
          },
        ],
        bounds: { minX: 0, minY: 0, maxX: 11, maxY: 0 },
        params: engine.getParams(),
      };

      const stitched = engine.stitchSegments(pathWithGaps, 0.1);
      expect(stitched.segments.length).toBe(2);
    });

    it('should return same path for single segment', () => {
      const singleSegment: GeneratedPath = {
        segments: [
          {
            points: [
              { x: 0, y: 0 },
              { x: 1, y: 1 },
            ],
          },
        ],
        bounds: { minX: 0, minY: 0, maxX: 1, maxY: 1 },
        params: engine.getParams(),
      };

      const stitched = engine.stitchSegments(singleSegment);
      expect(stitched.segments.length).toBe(1);
    });
  });

  // ===========================================================================
  // Cache Management
  // ===========================================================================
  describe('clearCache', () => {
    it('should clear the path cache', () => {
      const path1 = engine.computePath();
      engine.clearCache();
      const path2 = engine.computePath();

      // After clearing cache, should compute new path
      expect(path1).not.toBe(path2);
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================
  describe('edge cases', () => {
    it('should handle r=0 without errors', () => {
      engine.setParams({ r: 0, steps: 100, symmetry: 1 });
      const path = engine.computePath();
      expect(path.segments.length).toBeGreaterThan(0);
      // All points should be finite
      for (const point of path.segments[0].points) {
        expect(Number.isFinite(point.x)).toBe(true);
        expect(Number.isFinite(point.y)).toBe(true);
      }
    });

    it('should handle negative R', () => {
      engine.setParams({ R: -100, steps: 100, symmetry: 1 });
      const path = engine.computePath();
      expect(path.segments.length).toBeGreaterThan(0);
    });

    it('should handle very small steps', () => {
      engine.setParams({ steps: 10, symmetry: 1 });
      const path = engine.computePath();
      expect(path.segments[0].points.length).toBeGreaterThan(0);
    });

    it('should handle very large symmetry', () => {
      engine.setParams({ symmetry: 24, steps: 100 });
      const path = engine.computePath();
      expect(path.segments.length).toBe(24);
    });

    it('should handle all curve families', () => {
      const families = [
        'hypo',
        'hypotrochoid',
        'epi',
        'epitrochoid',
        'rose',
        'liss',
        'spiral',
        'hypocycloid',
        'epicycloid',
        'fermat',
        'liss3d',
      ];

      for (const family of families) {
        engine.setParams({ family: family as any, steps: 50, symmetry: 1 });
        const path = engine.computePath();
        expect(path.segments.length).toBeGreaterThan(0);
        // Verify no NaN points
        for (const point of path.segments[0].points) {
          expect(Number.isFinite(point.x)).toBe(true);
          expect(Number.isFinite(point.y)).toBe(true);
        }
      }
    });
  });
  describe('noise', () => {
    // noise is normalised 0..1 and scaled against the radius inside the engine.
    const base = { family: 'hypo' as const, steps: 400, symmetry: 1, R: 240 };
    const maxDisplacement = (noise: number, R: number) => (noise * R * 0.02) / 2;

    it('displaces points when enabled', () => {
      engine.setParams({ ...base, noise: 0 });
      const clean = engine.computePath().segments[0].points[100];

      engine.setParams({ ...base, noise: 0.5 });
      const noisy = engine.computePath().segments[0].points[100];

      expect(noisy.x !== clean.x || noisy.y !== clean.y).toBe(true);
    });

    it('is deterministic, so cached and re-rendered output agree', () => {
      engine.setParams({ ...base, noise: 0.5 });
      const first = engine.computePath().segments[0].points[100];

      engine.clearCache();
      engine.setParams({ ...base, noise: 0.5 });
      const second = engine.computePath().segments[0].points[100];

      expect(second.x).toBe(first.x);
      expect(second.y).toBe(first.y);
    });

    it('scales displacement with the pattern radius', () => {
      engine.setParams({ ...base, noise: 0 });
      const clean = engine.computePath().segments[0].points;

      engine.setParams({ ...base, noise: 1 });
      const noisy = engine.computePath().segments[0].points;

      const bound = maxDisplacement(1, base.R);
      let moved = 0;
      for (let i = 0; i < clean.length; i++) {
        const dx = Math.abs(noisy[i].x - clean[i].x);
        const dy = Math.abs(noisy[i].y - clean[i].y);
        expect(dx).toBeLessThanOrEqual(bound);
        expect(dy).toBeLessThanOrEqual(bound);
        if (dx > 0 || dy > 0) moved++;
      }
      // A full-strength noise value must be visible, not sub-pixel.
      expect(bound).toBeGreaterThan(1);
      expect(moved).toBeGreaterThan(clean.length * 0.9);
    });
  });
  describe('kaleidoscope', () => {
    const base = { family: 'hypo' as const, steps: 400, symmetry: 1, R: 240 };

    it('folds the pattern into a single quadrant', () => {
      engine.setParams({ ...base, kaleidoscope: false });
      const plain = engine.computePath();
      expect(plain.bounds.minX).toBeLessThan(0);

      engine.setParams({ ...base, kaleidoscope: true });
      const folded = engine.computePath();

      expect(folded.bounds.minX).toBeGreaterThanOrEqual(0);
      expect(folded.bounds.minY).toBeGreaterThanOrEqual(0);
      for (const segment of folded.segments) {
        for (const point of segment.points) {
          expect(point.x).toBeGreaterThanOrEqual(0);
          expect(point.y).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it('participates in the cache key so toggling it redraws', () => {
      engine.setParams({ ...base, kaleidoscope: false });
      const off = engine.computePath().cacheKey;
      engine.setParams({ ...base, kaleidoscope: true });
      const on = engine.computePath().cacheKey;
      expect(on).not.toBe(off);
    });
  });

  describe('crop', () => {
    const base = { family: 'hypo' as const, steps: 800, symmetry: 1, R: 240, r: 60, d: 80 };
    // The curve's radius ranges over 100..260, so this box cuts through it.
    const box = { x: -150, y: -140, width: 300, height: 290, active: true };

    it('keeps every point inside the crop rectangle', () => {
      engine.setParams({ ...base, crop: box });
      const cropped = engine.computePath();

      expect(cropped.segments.length).toBeGreaterThan(0);
      for (const segment of cropped.segments) {
        for (const point of segment.points) {
          // Clipping is exact, so allow only floating-point slack.
          expect(point.x).toBeGreaterThanOrEqual(box.x - 1e-9);
          expect(point.x).toBeLessThanOrEqual(box.x + box.width + 1e-9);
          expect(point.y).toBeGreaterThanOrEqual(box.y - 1e-9);
          expect(point.y).toBeLessThanOrEqual(box.y + box.height + 1e-9);
        }
      }
    });

    it('tightens the reported bounds, which drive export viewBoxes', () => {
      engine.setParams({ ...base, crop: { ...box, active: false } });
      const whole = engine.computePath().bounds;
      engine.setParams({ ...base, crop: box });
      const cropped = engine.computePath().bounds;

      expect(cropped.maxX).toBeLessThan(whole.maxX);
      expect(cropped.maxX).toBeLessThanOrEqual(box.x + box.width + 1e-9);
      expect(cropped.minY).toBeGreaterThanOrEqual(box.y - 1e-9);
    });

    it('splits a stroke that leaves and re-enters the rectangle', () => {
      engine.setParams({ ...base, crop: box });
      const cropped = engine.computePath();
      engine.setParams({ ...base, crop: { ...box, active: false } });
      const whole = engine.computePath();

      expect(cropped.segments.length).toBeGreaterThan(whole.segments.length);
    });

    it('drops the pattern entirely when the rectangle misses it', () => {
      engine.setParams({
        ...base,
        crop: { x: 5000, y: 5000, width: 10, height: 10, active: true },
      });
      expect(engine.computePath().segments).toHaveLength(0);
    });

    it('participates in the cache key so resizing it redraws', () => {
      engine.setParams({ ...base, crop: box });
      const small = engine.computePath().cacheKey;
      engine.setParams({ ...base, crop: { ...box, width: 200 } });
      expect(engine.computePath().cacheKey).not.toBe(small);
    });
  });
});
