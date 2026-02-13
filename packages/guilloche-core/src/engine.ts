import type { PatternParams, PatternLayer, RosetteConfig, BorderConfig, GridConfig } from '@guilloche/shared';
import { getDefaultParams, getTMax, pointFor, rotate, deepClone } from '@guilloche/shared';
import {
  DEFAULT_ROSETTE_CONFIG,
  DEFAULT_BORDER_CONFIG,
  DEFAULT_GRID_CONFIG,
} from '@guilloche/shared';

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
    const baseKey = `${p.mode || 'curve'}-${p.family}-${p.R}-${p.r}-${p.d}-${p.k}-${p.m}-${p.mf}-${p.phase}-${p.rot}-${p.s}-${p.steps}-${p.symmetry}-${p.reflectH}-${p.reflectV}-${p.kaleidoscope}`;

    // Add mode-specific config to cache key
    if (p.mode === 'rosette' && p.rosette) {
      return `${baseKey}-ros:${JSON.stringify(p.rosette)}`;
    }
    if (p.mode === 'border' && p.border) {
      return `${baseKey}-bor:${JSON.stringify(p.border)}`;
    }
    if (p.mode === 'grid' && p.grid) {
      return `${baseKey}-grd:${JSON.stringify(p.grid)}`;
    }
    return baseKey;
  }

  /**
   * Compute the complete path with all symmetry transformations
   * Dispatches to mode-specific methods based on params.mode
   */
  computePath(): GeneratedPath {
    const cacheKey = this.getCacheKey();
    const cached = this.pathCache.get(cacheKey);
    if (cached) return cached;

    const mode = this.params.mode || 'curve';
    let result: GeneratedPath;

    switch (mode) {
      case 'rosette':
        result = this.computeRosettePath();
        break;
      case 'border':
        result = this.computeBorderPath();
        break;
      case 'grid':
        result = this.computeGridPath();
        break;
      case 'curve':
      default:
        result = this.computeCurvePath();
        break;
    }

    this.pathCache.set(cacheKey, result);
    return result;
  }

  /**
   * Classic single curve with symmetry (original behavior)
   */
  private computeCurvePath(): GeneratedPath {
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

    return {
      segments,
      bounds: { minX, minY, maxX, maxY },
      params: deepClone(p),
    };
  }

  /**
   * Rosette mode: Closed circular patterns with concentric rings
   * Creates security-printing style circular guilloches with envelope shapes
   */
  private computeRosettePath(): GeneratedPath {
    const p = this.params;
    const config: RosetteConfig = { ...DEFAULT_ROSETTE_CONFIG, ...p.rosette };
    const tMax = getTMax(p.family, p.R, p.r, p.k, p.mf);

    const segments: PathSegment[] = [];
    let minX = Infinity,
      minY = Infinity;
    let maxX = -Infinity,
      maxY = -Infinity;

    // Calculate envelope function based on shape
    const getEnvelopeRadius = (angle: number, baseRadius: number): number => {
      switch (config.envelope) {
        case 'ellipse':
          // Elliptical envelope
          const a = baseRadius;
          const b = baseRadius * 0.7;
          return (a * b) / Math.sqrt(Math.pow(b * Math.cos(angle), 2) + Math.pow(a * Math.sin(angle), 2));
        case 'polygon': {
          // Polygon envelope
          const n = config.envelopeSides;
          const theta = angle % (2 * Math.PI / n);
          const halfAngle = Math.PI / n;
          return baseRadius * Math.cos(halfAngle) / Math.cos(theta - halfAngle);
        }
        case 'star': {
          // Star envelope
          const n = config.envelopeSides;
          const innerRatio = 1 - config.starPointiness * 0.6;
          const segmentAngle = Math.PI / n;
          const normalizedAngle = angle % (2 * segmentAngle);
          const t = Math.abs(normalizedAngle - segmentAngle) / segmentAngle;
          return baseRadius * (innerRatio + (1 - innerRatio) * t);
        }
        case 'circle':
        default:
          return baseRadius;
      }
    };

    // Generate concentric rings from inner to outer radius
    const innerRadius = config.outerRadius * config.innerRadius;
    const ringCount = config.fillDensity;

    for (let ring = 0; ring < ringCount; ring++) {
      const ringProgress = ring / Math.max(1, ringCount - 1);
      const ringRadius = innerRadius + (config.outerRadius - innerRadius) * ringProgress;

      // Apply spiral twist
      const twistOffset = (config.spiralTwist * Math.PI / 180) * ringProgress;

      // Calculate steps for this ring (more steps for outer rings)
      const ringSteps = Math.floor(p.steps * (0.3 + 0.7 * ringProgress));
      const dt = tMax / ringSteps;

      // For each symmetry fold
      for (let sym = 0; sym < p.symmetry; sym++) {
        const symAngle = (2 * Math.PI * sym) / p.symmetry;
        const points: Point[] = [];

        for (let i = 0; i <= ringSteps; i++) {
          const t = i * dt;
          let [x, y] = pointFor(t, p);

          // Normalize to unit circle and apply ring scale
          const dist = Math.sqrt(x * x + y * y);
          if (dist > 0) {
            const angle = Math.atan2(y, x) + twistOffset;

            // Apply radial wave modulation
            const waveOffset = config.radialWave * Math.sin(p.mf * angle) * ringRadius * 0.1;
            const envelopeRadius = getEnvelopeRadius(angle, ringRadius + waveOffset);

            // Scale point to fit within envelope
            const scaleFactor = envelopeRadius / (p.R * 1.5);
            x = (x / dist) * dist * scaleFactor;
            y = (y / dist) * dist * scaleFactor;
          }

          // Apply rotations
          [x, y] = rotate(x, y, p.rot + twistOffset);
          [x, y] = rotate(x, y, symAngle);

          // Apply reflections
          if (p.reflectH) x = -x;
          if (p.reflectV) y = -y;
          if (p.kaleidoscope) {
            x = Math.abs(x);
            y = Math.abs(y);
          }

          // Apply scale
          x *= p.s;
          y *= p.s;

          if (p.noise > 0) {
            x += (Math.random() - 0.5) * p.noise;
            y += (Math.random() - 0.5) * p.noise;
          }

          points.push({ x, y });

          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }

        segments.push({ points, strokeWidth: p.lw });
      }
    }

    return {
      segments,
      bounds: { minX, minY, maxX, maxY },
      params: deepClone(p),
    };
  }

  /**
   * Border mode: Linear repeating patterns for edges and frames
   * Creates security-printing style border guilloches
   */
  private computeBorderPath(): GeneratedPath {
    const p = this.params;
    const config: BorderConfig = { ...DEFAULT_BORDER_CONFIG, ...p.border };
    const tMax = getTMax(p.family, p.R, p.r, p.k, p.mf);

    const segments: PathSegment[] = [];
    let minX = Infinity,
      minY = Infinity;
    let maxX = -Infinity,
      maxY = -Infinity;

    const unitWidth = config.length / config.repeatCount;

    // Generate each repeat unit
    for (let repeat = 0; repeat < config.repeatCount; repeat++) {
      const offsetX = repeat * unitWidth - config.length / 2;
      const mirror = config.mirrorAlternate && repeat % 2 === 1;

      // Apply taper at ends
      let taperScale = 1;
      if (config.taper > 0) {
        const edgeDist = Math.min(repeat, config.repeatCount - 1 - repeat);
        const taperZone = config.repeatCount * config.taper * 0.5;
        if (edgeDist < taperZone) {
          taperScale = edgeDist / taperZone;
        }
      }

      const baseSteps = Math.floor(p.steps / config.repeatCount);
      const dt = tMax / baseSteps;

      const points: Point[] = [];

      for (let i = 0; i <= baseSteps; i++) {
        const t = i * dt;
        let [x, y] = pointFor(t, p);

        // Map curve to border unit
        const progress = i / baseSteps;
        const localX = progress * unitWidth;

        // Scale y to fit within border width
        const yScale = (config.width / 2) / Math.max(p.R, 100);
        y = y * yScale * taperScale;

        // Apply wave to baseline
        if (config.waveAmplitude > 0) {
          const waveY = config.waveAmplitude * Math.sin(progress * Math.PI * 2 * config.waveFrequency);
          y += waveY;
        }

        // Mirror if needed
        if (mirror) {
          y = -y;
        }

        x = localX + offsetX;

        // Apply reflections
        if (p.reflectH) x = -x;
        if (p.reflectV) y = -y;

        // Apply scale
        x *= p.s;
        y *= p.s;

        if (p.noise > 0) {
          x += (Math.random() - 0.5) * p.noise;
          y += (Math.random() - 0.5) * p.noise;
        }

        points.push({ x, y });

        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }

      segments.push({ points, strokeWidth: p.lw });
    }

    return {
      segments,
      bounds: { minX, minY, maxX, maxY },
      params: deepClone(p),
    };
  }

  /**
   * Grid mode: 2D tiled background patterns
   * Creates security-printing style background guilloches
   */
  private computeGridPath(): GeneratedPath {
    const p = this.params;
    const config: GridConfig = { ...DEFAULT_GRID_CONFIG, ...p.grid };
    const tMax = getTMax(p.family, p.R, p.r, p.k, p.mf);

    const segments: PathSegment[] = [];
    let minX = Infinity,
      minY = Infinity;
    let maxX = -Infinity,
      maxY = -Infinity;

    // Calculate grid dimensions
    const totalWidth = config.cols * config.tileWidth + (config.cols - 1) * config.spacing;
    const totalHeight = config.rows * config.tileHeight + (config.rows - 1) * config.spacing;

    // Scale curve to fit in tile
    const tileScale = Math.min(config.tileWidth, config.tileHeight) / (p.R * 2.5);
    const baseSteps = Math.floor(p.steps / (config.rows * config.cols));
    const dt = tMax / baseSteps;

    // Generate each tile
    for (let row = 0; row < config.rows; row++) {
      for (let col = 0; col < config.cols; col++) {
        // Calculate tile center position
        let tileCenterX = col * (config.tileWidth + config.spacing) + config.tileWidth / 2 - totalWidth / 2;
        let tileCenterY = row * (config.tileHeight + config.spacing) + config.tileHeight / 2 - totalHeight / 2;

        // Apply stagger for brick-like patterns
        if (config.stagger > 0 && row % 2 === 1) {
          tileCenterX += config.tileWidth * config.stagger;
        }

        // Random scale variation
        let localScale = tileScale;
        if (config.scaleVariation > 0) {
          localScale *= 1 + (Math.random() - 0.5) * config.scaleVariation * 2;
        }

        // Alternate rotation
        let localRotation = (config.angle * Math.PI) / 180;
        if (config.rotateAlternate && (row + col) % 2 === 1) {
          localRotation += Math.PI / 2;
        }

        // Hex grid offset
        if (config.tileType === 'hex') {
          if (row % 2 === 1) {
            tileCenterX += config.tileWidth * 0.5;
          }
          tileCenterY *= 0.866; // cos(30°) for hex packing
        }

        // Diamond grid rotation
        if (config.tileType === 'diamond') {
          localRotation += Math.PI / 4;
        }

        // Generate curve for this tile with symmetry
        for (let sym = 0; sym < p.symmetry; sym++) {
          const symAngle = (2 * Math.PI * sym) / p.symmetry;
          const points: Point[] = [];

          for (let i = 0; i <= baseSteps; i++) {
            const t = i * dt;
            let [x, y] = pointFor(t, p);

            // Scale to tile
            x *= localScale;
            y *= localScale;

            // Apply tile rotation and symmetry
            [x, y] = rotate(x, y, localRotation);
            [x, y] = rotate(x, y, symAngle);

            // Apply reflections
            if (p.reflectH) x = -x;
            if (p.reflectV) y = -y;
            if (p.kaleidoscope) {
              x = Math.abs(x);
              y = Math.abs(y);
            }

            // Translate to tile position
            x += tileCenterX;
            y += tileCenterY;

            // Apply global scale
            x *= p.s;
            y *= p.s;

            if (p.noise > 0) {
              x += (Math.random() - 0.5) * p.noise;
              y += (Math.random() - 0.5) * p.noise;
            }

            points.push({ x, y });

            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
          }

          segments.push({ points, strokeWidth: p.lw });
        }
      }
    }

    return {
      segments,
      bounds: { minX, minY, maxX, maxY },
      params: deepClone(p),
    };
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
