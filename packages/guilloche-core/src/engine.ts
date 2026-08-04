import type {
  PatternParams,
  PatternLayer,
  RosetteConfig,
  BorderConfig,
  GridConfig,
} from '@guilloche/shared';
import { getDefaultParams, getTMax, pointFor, rotate, deepClone } from '@guilloche/shared';
import {
  DEFAULT_ROSETTE_CONFIG,
  DEFAULT_BORDER_CONFIG,
  DEFAULT_GRID_CONFIG,
} from '@guilloche/shared';

/** Fraction of the pattern radius that a noise value of 1.0 displaces a point by. */
const NOISE_SCALE = 0.02;

/**
 * Liang-Barsky: trim a line segment to the part inside an axis-aligned rectangle,
 * or null when it misses entirely. Returning the exact crossing points (rather
 * than the nearest sample) is what keeps a cropped pattern inside its own edge.
 */
function clipToRect(
  p1: Point,
  p2: Point,
  xMin: number,
  yMin: number,
  xMax: number,
  yMax: number
): [Point, Point] | null {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  let t0 = 0;
  let t1 = 1;

  const edges: Array<[number, number]> = [
    [-dx, p1.x - xMin],
    [dx, xMax - p1.x],
    [-dy, p1.y - yMin],
    [dy, yMax - p1.y],
  ];

  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return null; // Parallel to this edge and wholly outside it.
      continue;
    }
    const t = q / p;
    if (p < 0) {
      if (t > t1) return null;
      if (t > t0) t0 = t;
    } else {
      if (t < t0) return null;
      if (t < t1) t1 = t;
    }
  }

  return [
    { x: p1.x + dx * t0, y: p1.y + dy * t0 },
    { x: p1.x + dx * t1, y: p1.y + dy * t1 },
  ];
}

/**
 * Bounding box of a set of segments. The SVG viewBox, EPS bounding box and PDF
 * page box all derive from this, so a transform that moves or removes points has
 * to refresh it or the export gains phantom margins.
 */
function boundsOf(segments: PathSegment[]): GeneratedPath['bounds'] {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const segment of segments) {
    for (const point of segment.points) {
      if (point.x < minX) minX = point.x;
      if (point.y < minY) minY = point.y;
      if (point.x > maxX) maxX = point.x;
      if (point.y > maxY) maxY = point.y;
    }
  }

  // An empty path has no extent; a zero box stops consumers propagating Infinity
  // into a viewBox.
  if (minX === Infinity) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return { minX, minY, maxX, maxY };
}

/**
 * A 2D coordinate point
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * A segment of a path containing multiple points
 * Can include styling information for rendering
 */
export interface PathSegment {
  /** Array of points making up this segment */
  points: Point[];
  /** Optional stroke color override */
  color?: string;
  /** Line width in pixels */
  strokeWidth?: number;
  /** Opacity from 0 (transparent) to 1 (opaque) */
  opacity?: number;
  /** Blend mode for compositing */
  blendMode?: string;
  /** Whether this segment contains bezier control points */
  isBezier?: boolean;
}

/**
 * The result of computing a guilloche pattern
 * Contains all path segments, bounding box, and the parameters used
 */
export interface GeneratedPath {
  /** All segments making up the pattern */
  segments: PathSegment[];
  /** Bounding box of all points */
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  /** Copy of the parameters used to generate this path */
  params: PatternParams;
  /**
   * Identity of the inputs that produced this geometry. Renderers key their own
   * caches off this rather than re-deriving one from `params`, which previously
   * drifted and let changes to symmetry, reflection, mode and noise redraw a
   * stale path.
   */
  cacheKey?: string;
}

/**
 * Core engine for computing guilloche patterns
 *
 * Supports multiple pattern modes:
 * - **curve**: Basic parametric curve with symmetry and modulation
 * - **rosette**: Circular pattern with concentric rings and envelope clipping
 * - **border**: Linear repeating pattern for edges and frames
 * - **grid**: Tiled background pattern
 *
 * @example
 * ```typescript
 * const engine = new GuillocheEngine({ R: 100, r: 50 });
 * engine.setParams({ family: 'rose', symmetry: 5 });
 * const path = engine.computePath();
 * // Render path.segments to canvas or SVG
 * ```
 */
export class GuillocheEngine {
  private params: PatternParams;
  private pathCache: Map<string, GeneratedPath> = new Map();

  /**
   * Create a new GuillocheEngine with optional custom parameters
   * @param params - Partial pattern parameters to merge with defaults
   */
  constructor(params?: Partial<PatternParams>) {
    this.params = { ...getDefaultParams(), ...params };
  }

  /**
   * Update pattern parameters and clear the computation cache
   * @param params - Partial parameters to merge with current state
   */
  setParams(params: Partial<PatternParams>): void {
    this.params = { ...this.params, ...params };
    this.pathCache.clear();
  }

  /**
   * Get a deep copy of current parameters
   * @returns Copy of PatternParams that can be safely modified
   */
  getParams(): PatternParams {
    return deepClone(this.params);
  }

  /**
   * Generate an efficient cache key from pattern parameters
   * Uses numeric concatenation instead of JSON.stringify for ~10x performance improvement
   */
  private getCacheKey(): string {
    const p = this.params;
    // Build key from parameters that affect the computed path
    // Using template literals is ~10x faster than JSON.stringify for this use case
    let key = `${p.mode}|${p.family}|${p.R}|${p.r}|${p.d}|${p.k}|${p.m}|${p.mf}|${p.phase}|${p.rot}|${p.s}|${p.steps}|${p.lw}|${p.symmetry}|${p.reflectH ? 1 : 0}|${p.reflectV ? 1 : 0}|${p.adaptiveSteps ? 1 : 0}|${p.noise}|${p.kaleidoscope ? 1 : 0}`;

    // Add mode-specific config
    if (p.mode === 'rosette' && p.rosette) {
      const r = p.rosette;
      key += `|R:${r.envelope}|${r.innerRadius}|${r.outerRadius}|${r.fillDensity}|${r.envelopeSides}|${r.starPointiness}|${r.radialWave}|${r.spiralTwist}`;
    } else if (p.mode === 'border' && p.border) {
      const b = p.border;
      key += `|B:${b.length}|${b.width}|${b.waveAmplitude}|${b.waveFrequency}|${b.repeatCount}|${b.mirrorAlternate ? 1 : 0}|${b.taper}`;
    } else if (p.mode === 'grid' && p.grid) {
      const g = p.grid;
      key += `|G:${g.tileType}|${g.tileWidth}|${g.tileHeight}|${g.rows}|${g.cols}|${g.spacing}|${g.stagger}|${g.rotateAlternate ? 1 : 0}|${g.scaleVariation}|${g.angle}`;
    }

    // Add crop config if active
    if (p.crop?.active) {
      key += `|C:${p.crop.x}|${p.crop.y}|${p.crop.width}|${p.crop.height}`;
    }

    return key;
  }

  /**
   * Compute the pattern path based on current parameters
   *
   * Results are cached - calling with same parameters returns cached result.
   * Use `setParams()` or `clearCache()` to invalidate cache.
   *
   * @returns Generated path with segments, bounds, and params
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
      default:
        result = this.computeCurvePath();
        break;
    }

    if (this.params.kaleidoscope) {
      result = this.applyKaleidoscope(result);
    }

    if (this.params.noise > 0) {
      result = this.applyNoise(result);
    }

    if (this.params.crop?.active) {
      result = this.applyClipping(result);
    }

    result = { ...result, cacheKey };
    this.pathCache.set(cacheKey, result);
    return result;
  }

  /**
   * Fold the pattern into a single quadrant by mirroring every point about both
   * axes. The parameter existed and was surfaced in the studio, but no generator
   * ever read it, so the control did nothing.
   */
  private applyKaleidoscope(path: GeneratedPath): GeneratedPath {
    const segments = path.segments.map((segment) => ({
      ...segment,
      points: segment.points.map((point) => ({
        ...point,
        x: Math.abs(point.x),
        y: Math.abs(point.y),
      })),
    }));

    return { ...path, segments, bounds: boundsOf(segments) };
  }

  /**
   * Jitter every point by up to ±noise. Applied once here rather than inside each
   * mode generator so it covers curve, rosette, border and grid alike.
   *
   * The offsets come from a seeded generator, not Math.random: results are cached
   * by parameter key, so an unseeded jitter would hand back one frozen realisation
   * while making identical inputs render differently run to run.
   */
  private applyNoise(path: GeneratedPath): GeneratedPath {
    // noise is a normalised 0..1 amount (the API schema bounds it there), so it is
    // scaled against the pattern radius. Used raw it is sub-pixel on a default
    // 240-unit pattern, which made the studio's slider look like it did nothing.
    const amount = this.params.noise * Math.max(this.params.R, 1) * NOISE_SCALE;
    let seed = 0x9e3779b9;
    const random = () => {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    const segments = path.segments.map((segment) => ({
      ...segment,
      points: segment.points.map((point) => ({
        ...point,
        x: point.x + (random() - 0.5) * amount,
        y: point.y + (random() - 0.5) * amount,
      })),
    }));

    return { ...path, segments, bounds: boundsOf(segments) };
  }

  /**
   * Bakes a parametric path into a list of cubic Bezier segments
   * Uses basic control point estimation for a smooth starting point
   */
  bakeToBezierPath(path: GeneratedPath): any {
    return {
      segments: path.segments.map((seg) => {
        // Sample points at lower density for handles (every 10th point)
        const sampledPoints = seg.points.filter((_, i) => i % 10 === 0);
        if (sampledPoints.length < 2) {
          return {
            points: seg.points.map((p) => ({ x: p.x, y: p.y, type: 'corner' })),
            closed: true,
          };
        }

        return {
          points: sampledPoints.map((p, i) => {
            const next = sampledPoints[i + 1] || sampledPoints[0];
            const prev = sampledPoints[i - 1] || sampledPoints[sampledPoints.length - 1];

            // Simple handle estimation: tangent-based
            const dx = next.x - prev.x;
            const dy = next.y - prev.y;
            const dist = Math.sqrt(dx * dx + dy * dy) * 0.15;
            const angle = Math.atan2(dy, dx);

            return {
              x: p.x,
              y: p.y,
              type: 'bezier' as const,
              cp1: { x: p.x - Math.cos(angle) * dist, y: p.y - Math.sin(angle) * dist },
              cp2: { x: p.x + Math.cos(angle) * dist, y: p.y + Math.sin(angle) * dist },
            };
          }),
          closed: true,
        };
      }),
    };
  }

  /**
   * Alias for bakeToBezierPath - converts path to manual editing format
   * @param path - Generated path to convert
   * @returns Path with bezier control points suitable for manual editing
   */
  bakeToManualPath(path: GeneratedPath): any {
    return this.bakeToBezierPath(path);
  }

  /**
   * Stitch adjacent segments together based on endpoint proximity
   * Useful for creating continuous paths for CNC/plotter output
   *
   * @param path - Path with potentially disconnected segments
   * @param tolerance - Maximum distance to consider endpoints adjacent (default 0.01)
   * @returns New path with stitched segments
   */
  stitchSegments(path: GeneratedPath, tolerance = 0.01): GeneratedPath {
    if (path.segments.length <= 1) return path;
    const stitched: PathSegment[] = [];
    const used = new Set<number>();
    const segments = path.segments.map((s) => ({ ...s, points: [...s.points] }));

    for (let i = 0; i < segments.length; i++) {
      if (used.has(i)) continue;
      let current = segments[i];
      used.add(i);
      let extended = true;
      while (extended) {
        extended = false;
        const last = current.points[current.points.length - 1];
        for (let j = 0; j < segments.length; j++) {
          if (used.has(j)) continue;
          const next = segments[j];
          const first = next.points[0];
          const dist = Math.sqrt(Math.pow(last.x - first.x, 2) + Math.pow(last.y - first.y, 2));
          if (dist <= tolerance) {
            current.points.push(...next.points.slice(1));
            used.add(j);
            extended = true;
            break;
          }
        }
      }
      stitched.push(current);
    }
    return { ...path, segments: stitched };
  }

  private applyClipping(path: GeneratedPath): GeneratedPath {
    const { x: xMin, y: yMin, width, height } = this.params.crop!;
    const xMax = xMin + width;
    const yMax = yMin + height;
    const clippedSegments: PathSegment[] = [];

    for (const segment of path.segments) {
      let run: Point[] = [];
      const flush = () => {
        if (run.length > 1) clippedSegments.push({ ...segment, points: run });
        run = [];
      };

      for (let i = 0; i < segment.points.length - 1; i++) {
        const p1 = segment.points[i];
        const p2 = segment.points[i + 1];
        const span = clipToRect(p1, p2, xMin, yMin, xMax, yMax);
        if (!span) {
          flush();
          continue;
        }

        // Consecutive spans belong to the same stroke only while they stay
        // joined; a span starting away from the previous one means the curve
        // left the rectangle and came back.
        const [entry, exit] = span;
        const last = run[run.length - 1];
        if (!last || last.x !== entry.x || last.y !== entry.y) {
          flush();
          run.push(entry);
        }
        run.push(exit);
        if (exit.x !== p2.x || exit.y !== p2.y) flush();
      }
      flush();
    }
    return { ...path, segments: clippedSegments, bounds: boundsOf(clippedSegments) };
  }

  private computeCurvePath(): GeneratedPath {
    const p = this.params;
    const tMax = getTMax(p.family, p.R, p.r, p.k, p.mf);
    const baseSteps = p.adaptiveSteps ? Math.min(40000, p.steps * Math.sqrt(p.symmetry)) : p.steps;
    const dt = tMax / baseSteps;
    const segments: PathSegment[] = [];
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    for (let sym = 0; sym < p.symmetry; sym++) {
      const symAngle = (2 * Math.PI * sym) / p.symmetry;
      const points: Point[] = [];
      for (let i = 0; i <= baseSteps; i++) {
        const t = i * dt;
        let [x, y] = pointFor(t, p);
        [x, y] = rotate(x, y, p.rot + symAngle);
        if (p.reflectH) x = -x;
        if (p.reflectV) y = -y;
        x *= p.s;
        y *= p.s;
        points.push({ x, y });
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
      segments.push({ points, strokeWidth: p.lw, blendMode: p.blendMode });
    }
    return { segments, bounds: { minX, minY, maxX, maxY }, params: deepClone(p) };
  }

  /**
   * Compute a rosette pattern - closed circular guilloche with radial fill
   * Creates concentric rings of the base curve within an envelope
   */
  private computeRosettePath(): GeneratedPath {
    const p = this.params;
    const config = { ...DEFAULT_ROSETTE_CONFIG, ...p.rosette };
    const segments: PathSegment[] = [];
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    const {
      innerRadius,
      outerRadius,
      fillDensity,
      envelope,
      envelopeSides,
      starPointiness,
      radialWave,
      spiralTwist,
    } = config;
    const rings = Math.max(1, Math.floor(fillDensity));

    // Generate concentric rings
    for (let ring = 0; ring < rings; ring++) {
      const ringRatio = rings > 1 ? ring / (rings - 1) : 0.5;
      const ringRadius = innerRadius + (outerRadius - innerRadius) * ringRatio;

      // Scale the curve parameters based on ring position
      const scaledR = p.R * (ringRadius / outerRadius);
      const scaledR2 = p.r * (ringRadius / outerRadius);
      const scaledD = p.d * (ringRadius / outerRadius);

      // Apply spiral twist for this ring
      const twistAngle = spiralTwist * ringRatio * Math.PI * 2;

      const tMax = getTMax(p.family, scaledR, scaledR2, p.k, p.mf);
      const baseSteps = p.adaptiveSteps ? Math.min(20000, p.steps) : p.steps;
      const dt = tMax / baseSteps;

      for (let sym = 0; sym < p.symmetry; sym++) {
        const symAngle = (2 * Math.PI * sym) / p.symmetry;
        const points: Point[] = [];

        for (let i = 0; i <= baseSteps; i++) {
          const t = i * dt;
          const ringParams = { ...p, R: scaledR, r: scaledR2, d: scaledD };
          let [x, y] = pointFor(t, ringParams);

          // Apply radial wave modulation
          if (radialWave > 0) {
            const waveAngle = Math.atan2(y, x);
            const waveMod = 1 + radialWave * Math.sin(waveAngle * 8);
            x *= waveMod;
            y *= waveMod;
          }

          // Apply envelope clipping
          const angle = Math.atan2(y, x);
          let envelopeRadius = outerRadius;

          if (envelope === 'polygon' || envelope === 'star') {
            const segmentAngle = (2 * Math.PI) / envelopeSides;
            const normalizedAngle = ((angle % segmentAngle) + segmentAngle) % segmentAngle;
            const halfSegment = segmentAngle / 2;

            if (envelope === 'polygon') {
              envelopeRadius =
                (outerRadius * Math.cos(halfSegment)) / Math.cos(normalizedAngle - halfSegment);
            } else {
              // Star shape
              const innerStar = outerRadius * (1 - starPointiness);
              const t = normalizedAngle / segmentAngle;
              envelopeRadius =
                t < 0.5
                  ? innerStar + (outerRadius - innerStar) * (t * 2)
                  : outerRadius - (outerRadius - innerStar) * ((t - 0.5) * 2);
            }
          } else if (envelope === 'ellipse') {
            const a = outerRadius;
            const b = outerRadius * 0.7; // Aspect ratio
            envelopeRadius =
              (a * b) /
              Math.sqrt(Math.pow(b * Math.cos(angle), 2) + Math.pow(a * Math.sin(angle), 2));
          }

          // Clip to envelope
          const dist = Math.sqrt(x * x + y * y);
          if (dist > envelopeRadius) {
            const scale = envelopeRadius / dist;
            x *= scale;
            y *= scale;
          }

          // Apply rotation and twist
          [x, y] = rotate(x, y, p.rot + symAngle + twistAngle);
          if (p.reflectH) x = -x;
          if (p.reflectV) y = -y;
          x *= p.s;
          y *= p.s;

          points.push({ x, y });
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }

        segments.push({ points, strokeWidth: p.lw, blendMode: p.blendMode });
      }
    }

    return { segments, bounds: { minX, minY, maxX, maxY }, params: deepClone(p) };
  }

  /**
   * Compute a border pattern - linear repeating guilloche for edges
   * Creates a horizontal band that can be repeated
   */
  private computeBorderPath(): GeneratedPath {
    const p = this.params;
    const config = { ...DEFAULT_BORDER_CONFIG, ...p.border };
    const segments: PathSegment[] = [];
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    const { length, width, waveAmplitude, waveFrequency, repeatCount, mirrorAlternate, taper } =
      config;
    const unitWidth = length / repeatCount;

    // Generate repeated units along the border
    for (let unit = 0; unit < repeatCount; unit++) {
      const unitStartX = -length / 2 + unit * unitWidth;
      const shouldMirror = mirrorAlternate && unit % 2 === 1;

      // Calculate taper factor for this unit (tapers at edges)
      const unitCenter = (unit + 0.5) / repeatCount;
      const taperFactor = 1 - taper * Math.pow(2 * Math.abs(unitCenter - 0.5), 2);

      const tMax = getTMax(p.family, p.R, p.r, p.k, p.mf);
      const baseSteps = p.adaptiveSteps
        ? Math.min(10000, p.steps / repeatCount)
        : p.steps / repeatCount;
      const dt = tMax / baseSteps;

      const points: Point[] = [];

      for (let i = 0; i <= baseSteps; i++) {
        const t = i * dt;
        const [, curveY] = pointFor(t, p);

        // Normalize curve to unit dimensions
        const normalizedT = i / baseSteps;
        let x = unitStartX + normalizedT * unitWidth;
        let y = curveY * (width / (p.R * 2)) * taperFactor;

        // Apply wave baseline
        if (waveAmplitude > 0) {
          y += Math.sin(normalizedT * Math.PI * 2 * waveFrequency) * waveAmplitude;
        }

        // Mirror alternate units
        if (shouldMirror) {
          y = -y;
        }

        // Apply global transforms
        [x, y] = rotate(x, y, p.rot);
        if (p.reflectH) x = -x;
        if (p.reflectV) y = -y;
        x *= p.s;
        y *= p.s;

        points.push({ x, y });
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }

      segments.push({ points, strokeWidth: p.lw, blendMode: p.blendMode });
    }

    // Add symmetry copies (for vertical reflection into a full frame)
    if (p.symmetry > 1) {
      const originalSegments = [...segments];
      for (let sym = 1; sym < p.symmetry; sym++) {
        const symAngle = (2 * Math.PI * sym) / p.symmetry;
        for (const seg of originalSegments) {
          const rotatedPoints = seg.points.map((pt) => {
            let [x, y] = rotate(pt.x, pt.y, symAngle);
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
            return { x, y };
          });
          segments.push({ ...seg, points: rotatedPoints });
        }
      }
    }

    return { segments, bounds: { minX, minY, maxX, maxY }, params: deepClone(p) };
  }

  /**
   * Compute a grid pattern - tiled background guilloche
   * Creates a repeating tile pattern for document backgrounds
   */
  private computeGridPath(): GeneratedPath {
    const p = this.params;
    const config = { ...DEFAULT_GRID_CONFIG, ...p.grid };
    const segments: PathSegment[] = [];
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    const {
      tileType,
      tileWidth,
      tileHeight,
      rows,
      cols,
      spacing,
      stagger,
      rotateAlternate,
      scaleVariation,
      angle,
    } = config;

    // Calculate total grid dimensions
    const totalWidth = cols * (tileWidth + spacing);
    const totalHeight = rows * (tileHeight + spacing);
    const offsetX = -totalWidth / 2;
    const offsetY = -totalHeight / 2;

    // Generate single tile curve
    const tMax = getTMax(p.family, p.R, p.r, p.k, p.mf);
    const baseSteps = p.adaptiveSteps
      ? Math.min(5000, p.steps / (rows * cols))
      : Math.max(500, p.steps / (rows * cols));
    const dt = tMax / baseSteps;

    // Pre-compute the base tile points
    const baseTilePoints: Point[] = [];
    for (let i = 0; i <= baseSteps; i++) {
      const t = i * dt;
      let [x, y] = pointFor(t, p);
      // Scale to fit within tile dimensions
      const scaleFactor = Math.min(tileWidth, tileHeight) / (p.R * 2.5);
      x *= scaleFactor;
      y *= scaleFactor;
      baseTilePoints.push({ x, y });
    }

    // Place tiles in grid
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        let tileX = offsetX + col * (tileWidth + spacing) + tileWidth / 2;
        let tileY = offsetY + row * (tileHeight + spacing) + tileHeight / 2;

        // Apply stagger for hex-like patterns
        if (tileType === 'hex' && row % 2 === 1) {
          tileX += (tileWidth + spacing) * stagger;
        } else if (stagger > 0 && row % 2 === 1) {
          tileX += (tileWidth + spacing) * stagger;
        }

        // Deterministic per-tile scale: same params → same output, preserving the cache
        const scaleRand = (((Math.sin(row * 127.1 + col * 311.7) * 43758.5453) % 1) + 1) % 1;
        const tileScale = 1 + (scaleRand - 0.5) * scaleVariation * 2;
        const tileRotation = rotateAlternate && (row + col) % 2 === 1 ? Math.PI / 4 : 0;

        const points: Point[] = [];

        for (const basePt of baseTilePoints) {
          let x = basePt.x * tileScale;
          let y = basePt.y * tileScale;

          // Apply tile rotation
          if (tileRotation !== 0) {
            [x, y] = rotate(x, y, tileRotation);
          }

          // Apply grid angle rotation
          if (angle !== 0) {
            [x, y] = rotate(x, y, (angle * Math.PI) / 180);
          }

          // Translate to tile position
          x += tileX;
          y += tileY;

          // Apply global transforms
          [x, y] = rotate(x, y, p.rot);
          if (p.reflectH) x = -x;
          if (p.reflectV) y = -y;
          x *= p.s;
          y *= p.s;

          points.push({ x, y });
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }

        segments.push({ points, strokeWidth: p.lw, blendMode: p.blendMode });
      }
    }

    return { segments, bounds: { minX, minY, maxX, maxY }, params: deepClone(p) };
  }

  /**
   * Clear the computation cache
   * Call this to force re-computation on next computePath() call
   */
  clearCache(): void {
    this.pathCache.clear();
  }
}
