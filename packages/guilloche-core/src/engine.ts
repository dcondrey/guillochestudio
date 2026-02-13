import type { PatternParams, PatternLayer } from '@guilloche/shared';
import { getDefaultParams, getTMax, pointFor, rotate, deepClone } from '@guilloche/shared';

export interface Point {
  x: number;
  y: number;
}

export interface PathSegment {
  points: Point[];
  color?: string;
  strokeWidth?: number;
}

export interface GeneratedPath {
  segments: PathSegment[];
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  params: PatternParams;
}

export class GuillocheEngine {
  private params: PatternParams;
  private pathCache: Map<string, GeneratedPath> = new Map();

  constructor(params?: Partial<PatternParams>) {
    this.params = { ...getDefaultParams(), ...params };
  }

  /**
   * Update engine parameters
   */
  setParams(params: Partial<PatternParams>): void {
    this.params = { ...this.params, ...params };
    this.pathCache.clear();
  }

  /**
   * Get current parameters
   */
  getParams(): PatternParams {
    return deepClone(this.params);
  }

  /**
   * Generate the cache key for current parameters
   */
  private getCacheKey(): string {
    const p = this.params;
    return `${p.family}-${p.R}-${p.r}-${p.d}-${p.k}-${p.m}-${p.mf}-${p.phase}-${p.rot}-${p.s}-${p.steps}-${p.symmetry}-${p.reflectH}-${p.reflectV}-${p.kaleidoscope}`;
  }

  /**
   * Compute the complete path with all symmetry transformations
   */
  computePath(): GeneratedPath {
    const cacheKey = this.getCacheKey();
    const cached = this.pathCache.get(cacheKey);
    if (cached) return cached;

    const p = this.params;
    const tMax = getTMax(p.family, p.R, p.r, p.k, p.mf);
    const baseSteps = p.adaptiveSteps
      ? Math.min(40000, Math.max(2000, p.steps * Math.sqrt(p.symmetry)))
      : p.steps;
    const dt = tMax / baseSteps;

    const segments: PathSegment[] = [];
    let minX = Infinity,
      minY = Infinity;
    let maxX = -Infinity,
      maxY = -Infinity;

    // Generate path for each symmetry copy
    for (let sym = 0; sym < p.symmetry; sym++) {
      const symAngle = (2 * Math.PI * sym) / p.symmetry;
      const points: Point[] = [];

      for (let i = 0; i <= baseSteps; i++) {
        const t = i * dt;
        let [x, y] = pointFor(t, p);

        // Apply base rotation
        [x, y] = rotate(x, y, p.rot);

        // Apply symmetry rotation
        [x, y] = rotate(x, y, symAngle);

        // Apply reflections
        if (p.reflectH) x = -x;
        if (p.reflectV) y = -y;

        // Apply kaleidoscope
        if (p.kaleidoscope) {
          x = Math.abs(x);
          y = Math.abs(y);
        }

        // Apply scale
        x *= p.s;
        y *= p.s;

        // Apply noise if any
        if (p.noise > 0) {
          x += (Math.random() - 0.5) * p.noise;
          y += (Math.random() - 0.5) * p.noise;
        }

        points.push({ x, y });

        // Track bounds
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }

      segments.push({ points, strokeWidth: p.lw });
    }

    const result: GeneratedPath = {
      segments,
      bounds: { minX, minY, maxX, maxY },
      params: deepClone(p),
    };

    this.pathCache.set(cacheKey, result);
    return result;
  }

  /**
   * Compute path in chunks for progressive rendering
   */
  *computePathProgressive(chunkSize = 1000): Generator<{ progress: number; segment: PathSegment }> {
    const p = this.params;
    const tMax = getTMax(p.family, p.R, p.r, p.k, p.mf);
    const baseSteps = p.adaptiveSteps
      ? Math.min(40000, Math.max(2000, p.steps * Math.sqrt(p.symmetry)))
      : p.steps;
    const dt = tMax / baseSteps;

    for (let sym = 0; sym < p.symmetry; sym++) {
      const symAngle = (2 * Math.PI * sym) / p.symmetry;

      for (let chunkStart = 0; chunkStart <= baseSteps; chunkStart += chunkSize) {
        const chunkEnd = Math.min(chunkStart + chunkSize, baseSteps);
        const points: Point[] = [];

        for (let i = chunkStart; i <= chunkEnd; i++) {
          const t = i * dt;
          let [x, y] = pointFor(t, p);

          [x, y] = rotate(x, y, p.rot);
          [x, y] = rotate(x, y, symAngle);

          if (p.reflectH) x = -x;
          if (p.reflectV) y = -y;
          if (p.kaleidoscope) {
            x = Math.abs(x);
            y = Math.abs(y);
          }

          x *= p.s;
          y *= p.s;

          if (p.noise > 0) {
            x += (Math.random() - 0.5) * p.noise;
            y += (Math.random() - 0.5) * p.noise;
          }

          points.push({ x, y });
        }

        const totalProgress = (sym * baseSteps + chunkEnd) / (p.symmetry * baseSteps);
        yield { progress: totalProgress, segment: { points, strokeWidth: p.lw } };
      }
    }
  }

  /**
   * Optimize path by removing redundant points (Douglas-Peucker algorithm)
   */
  optimizePath(path: GeneratedPath, tolerance = 0.5): GeneratedPath {
    const optimizedSegments = path.segments.map((segment) => ({
      ...segment,
      points: this.douglasPeucker(segment.points, tolerance),
    }));

    return {
      ...path,
      segments: optimizedSegments,
    };
  }

  /**
   * Douglas-Peucker line simplification algorithm
   */
  private douglasPeucker(points: Point[], tolerance: number): Point[] {
    if (points.length <= 2) return points;

    let maxDistance = 0;
    let maxIndex = 0;
    const end = points.length - 1;

    for (let i = 1; i < end; i++) {
      const d = this.perpendicularDistance(points[i], points[0], points[end]);
      if (d > maxDistance) {
        maxDistance = d;
        maxIndex = i;
      }
    }

    if (maxDistance > tolerance) {
      const left = this.douglasPeucker(points.slice(0, maxIndex + 1), tolerance);
      const right = this.douglasPeucker(points.slice(maxIndex), tolerance);
      return [...left.slice(0, -1), ...right];
    }

    return [points[0], points[end]];
  }

  /**
   * Calculate perpendicular distance from point to line
   */
  private perpendicularDistance(point: Point, lineStart: Point, lineEnd: Point): number {
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;

    if (dx === 0 && dy === 0) {
      return Math.sqrt(Math.pow(point.x - lineStart.x, 2) + Math.pow(point.y - lineStart.y, 2));
    }

    const t = Math.max(
      0,
      Math.min(
        1,
        ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / (dx * dx + dy * dy)
      )
    );

    const projX = lineStart.x + t * dx;
    const projY = lineStart.y + t * dy;

    return Math.sqrt(Math.pow(point.x - projX, 2) + Math.pow(point.y - projY, 2));
  }

  /**
   * Clear the path cache
   */
  clearCache(): void {
    this.pathCache.clear();
  }
}
