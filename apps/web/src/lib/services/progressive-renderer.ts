/**
 * Progressive Rendering System
 * Handles chunked rendering with visual progress feedback
 * Supports both JS and WASM engines with automatic fallback
 */

import type { PatternParams } from '@guilloche/shared';
import { WasmPatternEngine, createWasmEngine, detectCapabilities } from './wasm-engine';
import { writable, derived, type Readable, type Writable } from 'svelte/store';

// ============================================================================
// Types
// ============================================================================

export interface RenderConfig {
  /** Chunk size for progressive rendering */
  chunkSize: number;
  /** Target frame rate for smooth animation */
  targetFPS: number;
  /** Whether to use WASM if available */
  preferWasm: boolean;
  /** Canvas anti-aliasing */
  antiAlias: boolean;
  /** Line width multiplier */
  lineWidthScale: number;
  /** Whether to show render progress visually */
  showProgress: boolean;
  /** Background color */
  backgroundColor: string;
  /** Stroke color */
  strokeColor: string;
  /** Stroke width */
  strokeWidth: number;
  /** Quality level (affects step count) */
  quality: 'draft' | 'normal' | 'high' | 'ultra';
}

export interface RenderState {
  /** Current render status */
  status: 'idle' | 'initializing' | 'rendering' | 'paused' | 'completed' | 'error';
  /** Progress percentage (0-100) */
  progress: number;
  /** Total points to render */
  totalPoints: number;
  /** Points rendered so far */
  renderedPoints: number;
  /** Current chunk being rendered */
  currentChunk: number;
  /** Total chunks */
  totalChunks: number;
  /** Time elapsed in ms */
  elapsedTime: number;
  /** Estimated time remaining in ms */
  estimatedTimeRemaining: number;
  /** Render FPS */
  fps: number;
  /** Points per second */
  pointsPerSecond: number;
  /** Whether using WASM engine */
  usingWasm: boolean;
  /** Error message if any */
  error: string | null;
}

export interface RenderResult {
  /** SVG path data */
  svgPath: string;
  /** Optimized SVG path */
  optimizedSvgPath: string;
  /** Computed points */
  points: Float64Array;
  /** Bounding box */
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  /** Path length in units */
  pathLength: number;
  /** Total points */
  pointCount: number;
  /** Render statistics */
  stats: {
    totalTime: number;
    engineType: 'js' | 'wasm';
    averageFps: number;
    peakFps: number;
  };
}

export interface RenderFrame {
  /** Frame number */
  frame: number;
  /** Points in this frame */
  points: Float64Array;
  /** Frame progress (0-1) */
  progress: number;
  /** Time taken for this frame in ms */
  frameTime: number;
}

// ============================================================================
// Default Configuration
// ============================================================================

export const DEFAULT_RENDER_CONFIG: RenderConfig = {
  chunkSize: 2000,
  targetFPS: 60,
  preferWasm: true,
  antiAlias: true,
  lineWidthScale: 1,
  showProgress: true,
  backgroundColor: '#ffffff',
  strokeColor: '#000000',
  strokeWidth: 1,
  quality: 'normal',
};

const QUALITY_MULTIPLIERS: Record<RenderConfig['quality'], number> = {
  draft: 0.25,
  normal: 1,
  high: 2,
  ultra: 4,
};

// ============================================================================
// Progressive Renderer Class
// ============================================================================

export class ProgressiveRenderer {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private offscreenCanvas: OffscreenCanvas | null = null;
  private offscreenCtx: OffscreenCanvasRenderingContext2D | null = null;
  private wasmEngine: WasmPatternEngine | null = null;
  private config: RenderConfig;
  private params: PatternParams | null = null;
  private abortController: AbortController | null = null;
  private animationFrameId: number | null = null;
  private renderStartTime: number = 0;
  private frameCount: number = 0;
  private frameTimes: number[] = [];
  private allPoints: number[] = [];

  // Stores for reactive state
  private _state: Writable<RenderState>;
  private _result: Writable<RenderResult | null>;

  public readonly state: Readable<RenderState>;
  public readonly result: Readable<RenderResult | null>;
  public readonly isRendering: Readable<boolean>;
  public readonly canPause: Readable<boolean>;

  constructor(config: Partial<RenderConfig> = {}) {
    this.config = { ...DEFAULT_RENDER_CONFIG, ...config };

    // Initialize stores
    this._state = writable<RenderState>(this.getInitialState());
    this._result = writable<RenderResult | null>(null);

    this.state = this._state;
    this.result = this._result;

    this.isRendering = derived(this._state, ($state) =>
      ['initializing', 'rendering'].includes($state.status)
    );

    this.canPause = derived(this._state, ($state) => $state.status === 'rendering');
  }

  private getInitialState(): RenderState {
    return {
      status: 'idle',
      progress: 0,
      totalPoints: 0,
      renderedPoints: 0,
      currentChunk: 0,
      totalChunks: 0,
      elapsedTime: 0,
      estimatedTimeRemaining: 0,
      fps: 0,
      pointsPerSecond: 0,
      usingWasm: false,
      error: null,
    };
  }

  /**
   * Attach to a canvas element
   */
  attach(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', {
      alpha: false,
      desynchronized: true,
    });

    if (this.ctx) {
      this.ctx.imageSmoothingEnabled = this.config.antiAlias;
    }

    // Create offscreen canvas for double buffering
    if (typeof OffscreenCanvas !== 'undefined') {
      this.offscreenCanvas = new OffscreenCanvas(canvas.width, canvas.height);
      this.offscreenCtx = this.offscreenCanvas.getContext('2d', {
        alpha: false,
      }) as OffscreenCanvasRenderingContext2D;
    }
  }

  /**
   * Detach from canvas
   */
  detach(): void {
    this.abort();
    this.canvas = null;
    this.ctx = null;
    this.offscreenCanvas = null;
    this.offscreenCtx = null;
  }

  /**
   * Update configuration
   */
  configure(config: Partial<RenderConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Initialize the WASM engine if available
   */
  async initEngine(): Promise<boolean> {
    if (!this.config.preferWasm) {
      return false;
    }

    const capabilities = await detectCapabilities();
    if (!capabilities.wasm) {
      return false;
    }

    this.wasmEngine = await createWasmEngine();
    return this.wasmEngine !== null;
  }

  /**
   * Start progressive rendering
   */
  async render(params: PatternParams): Promise<RenderResult | null> {
    // Abort any existing render
    this.abort();

    this.params = params;
    this.abortController = new AbortController();
    this.renderStartTime = performance.now();
    this.frameCount = 0;
    this.frameTimes = [];
    this.allPoints = [];

    this._state.set({
      ...this.getInitialState(),
      status: 'initializing',
    });

    try {
      // Initialize engine if needed
      const usingWasm = await this.initEngine();

      this._state.update((s) => ({
        ...s,
        status: 'rendering',
        usingWasm,
      }));

      // Clear canvas
      this.clearCanvas();

      let result: RenderResult;

      if (usingWasm && this.wasmEngine) {
        result = await this.renderWithWasm(params);
      } else {
        result = await this.renderWithJS(params);
      }

      this._state.update((s) => ({
        ...s,
        status: 'completed',
        progress: 100,
      }));

      this._result.set(result);
      return result;
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        this._state.update((s) => ({
          ...s,
          status: 'idle',
        }));
        return null;
      }

      this._state.update((s) => ({
        ...s,
        status: 'error',
        error: (error as Error).message,
      }));
      return null;
    }
  }

  /**
   * Render using WASM engine with progressive updates
   */
  private async renderWithWasm(params: PatternParams): Promise<RenderResult> {
    if (!this.wasmEngine || !this.ctx) {
      throw new Error('WASM engine or canvas not initialized');
    }

    this.wasmEngine.setParams(params);
    const totalPoints = this.wasmEngine.getPointCount();
    const totalChunks = Math.ceil(totalPoints / this.config.chunkSize);

    this._state.update((s) => ({
      ...s,
      totalPoints,
      totalChunks,
    }));

    let renderedPoints = 0;
    let peakFps = 0;
    const fpsHistory: number[] = [];

    // Progressive rendering loop
    for await (const frame of this.wasmEngine.computeProgressively(
      this.config.chunkSize,
      (progress) => {
        this._state.update((s) => ({
          ...s,
          progress: progress * 100,
        }));
      }
    )) {
      // Check for abort
      if (this.abortController?.signal.aborted) {
        throw new DOMException('Render aborted', 'AbortError');
      }

      const frameStart = performance.now();

      // Add points to collection
      for (let i = 0; i < frame.chunk.length; i++) {
        this.allPoints.push(frame.chunk[i]);
      }

      // Draw chunk to canvas
      this.drawChunk(frame.chunk, renderedPoints === 0);

      renderedPoints = frame.renderedPoints;
      this.frameCount++;

      const frameTime = performance.now() - frameStart;
      this.frameTimes.push(frameTime);

      const fps = 1000 / Math.max(frameTime, 1);
      fpsHistory.push(fps);
      peakFps = Math.max(peakFps, fps);

      const elapsedTime = performance.now() - this.renderStartTime;
      const pointsPerSecond = renderedPoints / (elapsedTime / 1000);
      const remainingPoints = totalPoints - renderedPoints;
      const estimatedTimeRemaining = (remainingPoints / pointsPerSecond) * 1000;

      this._state.update((s) => ({
        ...s,
        renderedPoints,
        currentChunk: Math.ceil(renderedPoints / this.config.chunkSize),
        elapsedTime,
        estimatedTimeRemaining,
        fps: Math.round(fps),
        pointsPerSecond: Math.round(pointsPerSecond),
      }));

      // Yield to main thread
      await this.yieldToMain();
    }

    // Generate final result
    const averageFps = fpsHistory.reduce((a, b) => a + b, 0) / fpsHistory.length;
    const bounds = this.wasmEngine.getBounds();
    const pathLength = this.wasmEngine.getPathLength();

    return {
      svgPath: this.wasmEngine.toSvgPath(),
      optimizedSvgPath: this.wasmEngine.toOptimizedSvgPath(0.5),
      points: new Float64Array(this.allPoints),
      bounds,
      pathLength,
      pointCount: totalPoints,
      stats: {
        totalTime: performance.now() - this.renderStartTime,
        engineType: 'wasm',
        averageFps: Math.round(averageFps),
        peakFps: Math.round(peakFps),
      },
    };
  }

  /**
   * Render using JavaScript engine with progressive updates
   */
  private async renderWithJS(params: PatternParams): Promise<RenderResult> {
    if (!this.ctx) {
      throw new Error('Canvas not initialized');
    }

    const qualityMultiplier = QUALITY_MULTIPLIERS[this.config.quality];
    const steps = Math.round((params.steps || 3600) * qualityMultiplier);
    const totalPoints = steps;
    const totalChunks = Math.ceil(totalPoints / this.config.chunkSize);

    this._state.update((s) => ({
      ...s,
      totalPoints,
      totalChunks,
    }));

    let renderedPoints = 0;
    let peakFps = 0;
    const fpsHistory: number[] = [];
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    // Progressive rendering loop
    for (let chunk = 0; chunk < totalChunks; chunk++) {
      // Check for abort
      if (this.abortController?.signal.aborted) {
        throw new DOMException('Render aborted', 'AbortError');
      }

      const frameStart = performance.now();
      const startStep = chunk * this.config.chunkSize;
      const endStep = Math.min(startStep + this.config.chunkSize, steps);

      // Compute chunk
      const chunkPoints = this.computeJSChunk(params, startStep, endStep);

      // Track bounds
      for (let i = 0; i < chunkPoints.length; i += 2) {
        const x = chunkPoints[i];
        const y = chunkPoints[i + 1];
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }

      // Add to all points
      for (let i = 0; i < chunkPoints.length; i++) {
        this.allPoints.push(chunkPoints[i]);
      }

      // Draw chunk
      this.drawChunk(new Float64Array(chunkPoints), renderedPoints === 0);

      renderedPoints += endStep - startStep;
      this.frameCount++;

      const frameTime = performance.now() - frameStart;
      this.frameTimes.push(frameTime);

      const fps = 1000 / Math.max(frameTime, 1);
      fpsHistory.push(fps);
      peakFps = Math.max(peakFps, fps);

      const progress = renderedPoints / totalPoints;
      const elapsedTime = performance.now() - this.renderStartTime;
      const pointsPerSecond = renderedPoints / (elapsedTime / 1000);
      const remainingPoints = totalPoints - renderedPoints;
      const estimatedTimeRemaining = (remainingPoints / pointsPerSecond) * 1000;

      this._state.update((s) => ({
        ...s,
        progress: progress * 100,
        renderedPoints,
        currentChunk: chunk + 1,
        elapsedTime,
        estimatedTimeRemaining,
        fps: Math.round(fps),
        pointsPerSecond: Math.round(pointsPerSecond),
      }));

      // Yield to main thread
      await this.yieldToMain();
    }

    // Generate SVG path
    const svgPath = this.generateSVGPath(new Float64Array(this.allPoints));
    const optimizedSvgPath = this.optimizeSVGPath(new Float64Array(this.allPoints), 0.5);
    const pathLength = this.calculatePathLength(new Float64Array(this.allPoints));
    const averageFps = fpsHistory.reduce((a, b) => a + b, 0) / fpsHistory.length;

    return {
      svgPath,
      optimizedSvgPath,
      points: new Float64Array(this.allPoints),
      bounds: { minX, minY, maxX, maxY },
      pathLength,
      pointCount: totalPoints,
      stats: {
        totalTime: performance.now() - this.renderStartTime,
        engineType: 'js',
        averageFps: Math.round(averageFps),
        peakFps: Math.round(peakFps),
      },
    };
  }

  /**
   * Compute a chunk of points using JS engine
   */
  private computeJSChunk(params: PatternParams, start: number, end: number): number[] {
    const points: number[] = [];
    const { R, r, d, m: amplitude, mf: frequency, phase, rot: rotation, k } = params;
    const rotationRad = ((rotation || 0) * Math.PI) / 180;
    // Calculate revolutions from k parameter or default to 10
    const revolutions = k || 10;

    for (let i = start; i < end; i++) {
      const t = (i / params.steps) * Math.PI * 2 * revolutions;

      let x: number, y: number;

      // Calculate base curve based on family
      switch (params.family) {
        case 'epitrochoid':
        case 'epi':
        case 'epicycloid':
          x = (R + r) * Math.cos(t) - d * Math.cos(((R + r) / r) * t);
          y = (R + r) * Math.sin(t) - d * Math.sin(((R + r) / r) * t);
          break;
        case 'rose': {
          const roseK = k || 4;
          const radius = R * Math.cos(roseK * t);
          x = radius * Math.cos(t);
          y = radius * Math.sin(t);
          break;
        }
        case 'liss':
        case 'liss3d': {
          // Lissajous - use k and mf as a and b parameters
          const a = k || 3;
          const b = frequency || 4;
          x = R * Math.sin(a * t + (phase || 0));
          y = R * Math.sin(b * t);
          break;
        }
        case 'spiral':
        case 'fermat': {
          // Fermat spiral
          const spiralRadius = R * Math.sqrt(t);
          x = spiralRadius * Math.cos(t);
          y = spiralRadius * Math.sin(t);
          break;
        }
        case 'hypo':
        case 'hypotrochoid':
        case 'hypocycloid':
        default:
          // Hypotrochoid
          x = (R - r) * Math.cos(t) + d * Math.cos(((R - r) / r) * t);
          y = (R - r) * Math.sin(t) - d * Math.sin(((R - r) / r) * t);
          break;
      }

      // Apply modulation
      if (amplitude && frequency) {
        const mod = 1 + amplitude * Math.sin(frequency * t + (phase || 0));
        x *= mod;
        y *= mod;
      }

      // Apply rotation
      if (rotationRad !== 0) {
        const cos = Math.cos(rotationRad);
        const sin = Math.sin(rotationRad);
        const rx = x * cos - y * sin;
        const ry = x * sin + y * cos;
        x = rx;
        y = ry;
      }

      points.push(x, y);
    }

    return points;
  }

  /**
   * Draw a chunk of points to canvas
   */
  private drawChunk(points: Float64Array, isFirst: boolean): void {
    const ctx = this.ctx;
    if (!ctx || !this.canvas) return;

    const width = this.canvas.width;
    const height = this.canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const scale = Math.min(width, height) / 500;

    ctx.strokeStyle = this.config.strokeColor;
    ctx.lineWidth = this.config.strokeWidth * this.config.lineWidthScale;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (isFirst) {
      ctx.beginPath();
      ctx.moveTo(centerX + points[0] * scale, centerY + points[1] * scale);
    }

    for (let i = 0; i < points.length; i += 2) {
      const x = centerX + points[i] * scale;
      const y = centerY + points[i + 1] * scale;
      ctx.lineTo(x, y);
    }

    ctx.stroke();
  }

  /**
   * Clear the canvas
   */
  private clearCanvas(): void {
    if (!this.ctx || !this.canvas) return;

    this.ctx.fillStyle = this.config.backgroundColor;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Generate SVG path from points
   */
  private generateSVGPath(points: Float64Array): string {
    if (points.length < 4) return '';

    let path = `M ${points[0].toFixed(4)} ${points[1].toFixed(4)}`;

    for (let i = 2; i < points.length; i += 2) {
      path += ` L ${points[i].toFixed(4)} ${points[i + 1].toFixed(4)}`;
    }

    return path;
  }

  /**
   * Optimize SVG path using Douglas-Peucker algorithm
   */
  private optimizeSVGPath(points: Float64Array, tolerance: number): string {
    const simplified = this.douglasPeucker(points, tolerance);
    return this.generateSVGPath(new Float64Array(simplified));
  }

  /**
   * Douglas-Peucker line simplification
   */
  private douglasPeucker(points: Float64Array, tolerance: number): number[] {
    if (points.length < 6) {
      return Array.from(points);
    }

    const result: number[] = [];
    const stack: [number, number][] = [[0, points.length / 2 - 1]];

    const included = new Set<number>([0, points.length / 2 - 1]);

    while (stack.length > 0) {
      const [start, end] = stack.pop()!;
      if (end - start < 2) continue;

      let maxDist = 0;
      let maxIndex = start;

      const x1 = points[start * 2];
      const y1 = points[start * 2 + 1];
      const x2 = points[end * 2];
      const y2 = points[end * 2 + 1];

      for (let i = start + 1; i < end; i++) {
        const x = points[i * 2];
        const y = points[i * 2 + 1];
        const dist = this.perpendicularDistance(x, y, x1, y1, x2, y2);

        if (dist > maxDist) {
          maxDist = dist;
          maxIndex = i;
        }
      }

      if (maxDist > tolerance) {
        included.add(maxIndex);
        stack.push([start, maxIndex]);
        stack.push([maxIndex, end]);
      }
    }

    const sortedIndices = Array.from(included).sort((a, b) => a - b);
    for (const i of sortedIndices) {
      result.push(points[i * 2], points[i * 2 + 1]);
    }

    return result;
  }

  /**
   * Calculate perpendicular distance from point to line
   */
  private perpendicularDistance(
    px: number,
    py: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number
  ): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lengthSquared = dx * dx + dy * dy;

    if (lengthSquared === 0) {
      return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
    }

    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSquared));
    const projX = x1 + t * dx;
    const projY = y1 + t * dy;

    return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
  }

  /**
   * Calculate total path length
   */
  private calculatePathLength(points: Float64Array): number {
    let length = 0;

    for (let i = 2; i < points.length; i += 2) {
      const dx = points[i] - points[i - 2];
      const dy = points[i + 1] - points[i - 1];
      length += Math.sqrt(dx * dx + dy * dy);
    }

    return length;
  }

  /**
   * Yield to main thread for responsiveness
   */
  private yieldToMain(): Promise<void> {
    return new Promise((resolve) => {
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(() => resolve(), { timeout: 1000 / this.config.targetFPS });
      } else {
        requestAnimationFrame(() => resolve());
      }
    });
  }

  /**
   * Pause rendering
   */
  pause(): void {
    this._state.update((s) => ({
      ...s,
      status: s.status === 'rendering' ? 'paused' : s.status,
    }));
  }

  /**
   * Resume rendering
   */
  resume(): void {
    this._state.update((s) => ({
      ...s,
      status: s.status === 'paused' ? 'rendering' : s.status,
    }));
  }

  /**
   * Abort rendering
   */
  abort(): void {
    this.abortController?.abort();
    this.abortController = null;

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    this._state.update((s) => ({
      ...s,
      status: 'idle',
    }));
  }

  /**
   * Get current render statistics
   */
  getStats(): {
    averageFrameTime: number;
    totalFrames: number;
    engineType: 'js' | 'wasm' | 'none';
  } {
    const averageFrameTime =
      this.frameTimes.length > 0
        ? this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length
        : 0;

    return {
      averageFrameTime,
      totalFrames: this.frameCount,
      engineType: this.wasmEngine ? 'wasm' : 'js',
    };
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.abort();
    this.wasmEngine?.dispose();
    this.wasmEngine = null;
    this.detach();
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a progressive renderer with default configuration
 */
export function createProgressiveRenderer(config?: Partial<RenderConfig>): ProgressiveRenderer {
  return new ProgressiveRenderer(config);
}

/**
 * Create a progressive renderer and attach to canvas
 */
export function createCanvasRenderer(
  canvas: HTMLCanvasElement,
  config?: Partial<RenderConfig>
): ProgressiveRenderer {
  const renderer = new ProgressiveRenderer(config);
  renderer.attach(canvas);
  return renderer;
}

// ============================================================================
// Svelte Store Helpers
// ============================================================================

/**
 * Create a render state store with derived helpers
 */
export function createRenderStore() {
  const renderer = writable<ProgressiveRenderer | null>(null);

  const state = derived(renderer, ($renderer): RenderState | null => {
    if (!$renderer) return null;
    let value: RenderState | null = null;
    const unsubscribe = $renderer.state.subscribe((v) => (value = v));
    unsubscribe();
    return value;
  });

  const result = derived(renderer, ($renderer): RenderResult | null => {
    if (!$renderer) return null;
    let value: RenderResult | null = null;
    const unsubscribe = $renderer.result.subscribe((v) => (value = v));
    unsubscribe();
    return value;
  });

  const getRenderer = (): ProgressiveRenderer | null => {
    let r: ProgressiveRenderer | null = null;
    const unsubscribe = renderer.subscribe((v) => (r = v));
    unsubscribe();
    return r;
  };

  return {
    renderer,
    state,
    result,
    init: (config?: Partial<RenderConfig>): void => {
      renderer.set(new ProgressiveRenderer(config));
    },
    attach: (canvas: HTMLCanvasElement): void => {
      const r = getRenderer();
      r?.attach(canvas);
    },
    render: async (params: PatternParams): Promise<RenderResult | null | undefined> => {
      const r = getRenderer();
      return r?.render(params);
    },
    abort: (): void => {
      const r = getRenderer();
      r?.abort();
    },
    dispose: (): void => {
      const r = getRenderer();
      r?.dispose();
      renderer.set(null);
    },
  };
}
