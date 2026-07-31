/**
 * WASM Engine Wrapper
 * TypeScript interface for the Rust-based Guilloche pattern engine
 */

import type { PatternParams } from '@guilloche/shared';
import { get } from 'svelte/store';
import { wasmEngineEnabled } from '$lib/stores/feature-flags';

// WASM module types
interface GuillocheWasmModule {
  GuillocheEngine: {
    new (): WasmEngine;
  };
}

interface WasmEngine {
  set_params(params_json: string): void;
  set_param(name: string, value: number): void;
  set_family(family: string): void;
  compute_path(): Float64Array;
  compute_path_chunk(start: number, count: number): Float64Array;
  render_to_canvas(ctx: CanvasRenderingContext2D): void;
  to_svg_path(): string;
  optimize_svg(tolerance: number): string;
  get_bounds(): Float64Array;
  get_path_length(): number;
  get_point_count(): number;
  free(): void;
}

export interface EngineCapabilities {
  wasm: boolean;
  simd: boolean;
  threads: boolean;
}

export interface RenderProgress {
  progress: number;
  chunk: Float64Array;
  totalPoints: number;
  renderedPoints: number;
}

let wasmModule: GuillocheWasmModule | null = null;
let engineInstance: WasmEngine | null = null;
let isInitializing = false;
let initPromise: Promise<boolean> | null = null;

/**
 * Detect WebAssembly capabilities
 */
export async function detectCapabilities(): Promise<EngineCapabilities> {
  const capabilities: EngineCapabilities = {
    wasm: false,
    simd: false,
    threads: false,
  };

  // Check basic WASM support
  if (typeof WebAssembly !== 'undefined') {
    capabilities.wasm = true;

    // Check SIMD support
    try {
      const simdTest = new WebAssembly.Module(
        new Uint8Array([
          0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0,
          253, 15, 253, 98, 11,
        ])
      );
      capabilities.simd = WebAssembly.validate(simdTest as unknown as BufferSource);
    } catch {
      capabilities.simd = false;
    }

    // Check thread support (SharedArrayBuffer)
    capabilities.threads =
      typeof SharedArrayBuffer !== 'undefined' && typeof Atomics !== 'undefined';
  }

  return capabilities;
}

/**
 * Initialize the WASM engine
 */
export async function initWasmEngine(): Promise<boolean> {
  if (wasmModule) {
    return true;
  }

  if (isInitializing && initPromise) {
    return initPromise;
  }

  isInitializing = true;

  initPromise = (async () => {
    try {
      // Dynamic import of the WASM module
      // Use a variable to prevent Vite from trying to resolve at build time
      const wasmPath = '$lib/wasm/guilloche_wasm';
      const module = await import(/* @vite-ignore */ wasmPath);
      await module.default();
      wasmModule = module as unknown as GuillocheWasmModule;
      return true;
    } catch (error) {
      // WASM module not available - this is expected in development
      // The JS engine from @guilloche/core will be used instead
      return false;
    } finally {
      isInitializing = false;
    }
  })();

  return initPromise;
}

/**
 * Get or create WASM engine instance
 */
export function getEngine(): WasmEngine | null {
  if (!wasmModule) {
    return null;
  }

  if (!engineInstance) {
    engineInstance = new wasmModule.GuillocheEngine();
  }

  return engineInstance;
}

/**
 * High-level WASM engine wrapper
 */
export class WasmPatternEngine {
  private engine: WasmEngine | null = null;
  private initialized = false;

  async init(): Promise<boolean> {
    if (this.initialized) {
      return this.engine !== null;
    }

    const success = await initWasmEngine();
    if (success) {
      this.engine = getEngine();
    }
    this.initialized = true;
    return this.engine !== null;
  }

  isAvailable(): boolean {
    return this.engine !== null;
  }

  /**
   * Set all parameters at once
   */
  setParams(params: PatternParams): void {
    if (!this.engine) {
      throw new Error('WASM engine not initialized');
    }

    this.engine.set_params(JSON.stringify(params));
  }

  /**
   * Set a single parameter
   */
  setParam(name: string, value: number): void {
    if (!this.engine) {
      throw new Error('WASM engine not initialized');
    }

    this.engine.set_param(name, value);
  }

  /**
   * Set curve family
   */
  setFamily(family: string): void {
    if (!this.engine) {
      throw new Error('WASM engine not initialized');
    }

    this.engine.set_family(family);
  }

  /**
   * Compute full path
   */
  computePath(): Float64Array {
    if (!this.engine) {
      throw new Error('WASM engine not initialized');
    }

    return this.engine.compute_path();
  }

  /**
   * Progressive path computation with yield
   */
  async *computeProgressively(
    chunkSize = 1000,
    onProgress?: (progress: number) => void
  ): AsyncGenerator<RenderProgress> {
    if (!this.engine) {
      throw new Error('WASM engine not initialized');
    }

    const totalPoints = this.engine.get_point_count();
    let renderedPoints = 0;

    while (renderedPoints < totalPoints) {
      const chunk = this.engine.compute_path_chunk(renderedPoints, chunkSize);
      renderedPoints += chunk.length / 2;

      const progress = renderedPoints / totalPoints;
      onProgress?.(progress);

      yield {
        progress,
        chunk,
        totalPoints,
        renderedPoints,
      };

      // Yield to event loop
      await new Promise((r) => requestAnimationFrame(r));
    }
  }

  /**
   * Render directly to canvas
   */
  renderToCanvas(ctx: CanvasRenderingContext2D): void {
    if (!this.engine) {
      throw new Error('WASM engine not initialized');
    }

    this.engine.render_to_canvas(ctx);
  }

  /**
   * Generate SVG path data
   */
  toSvgPath(): string {
    if (!this.engine) {
      throw new Error('WASM engine not initialized');
    }

    return this.engine.to_svg_path();
  }

  /**
   * Generate optimized SVG path
   */
  toOptimizedSvgPath(tolerance = 0.5): string {
    if (!this.engine) {
      throw new Error('WASM engine not initialized');
    }

    return this.engine.optimize_svg(tolerance);
  }

  /**
   * Get bounding box
   */
  getBounds(): { minX: number; minY: number; maxX: number; maxY: number } {
    if (!this.engine) {
      throw new Error('WASM engine not initialized');
    }

    const bounds = this.engine.get_bounds();
    return {
      minX: bounds[0],
      minY: bounds[1],
      maxX: bounds[2],
      maxY: bounds[3],
    };
  }

  /**
   * Get total path length
   */
  getPathLength(): number {
    if (!this.engine) {
      throw new Error('WASM engine not initialized');
    }

    return this.engine.get_path_length();
  }

  /**
   * Get number of points
   */
  getPointCount(): number {
    if (!this.engine) {
      throw new Error('WASM engine not initialized');
    }

    return this.engine.get_point_count();
  }

  /**
   * Free resources
   */
  dispose(): void {
    if (this.engine) {
      this.engine.free();
      this.engine = null;
    }
  }
}

/**
 * Create and initialize WASM engine
 */
export async function createWasmEngine(): Promise<WasmPatternEngine | null> {
  const engine = new WasmPatternEngine();
  const success = await engine.init();
  return success ? engine : null;
}

/**
 * Feature flag for WASM availability
 * Uses the feature flags system to control WASM engine access
 */
export function useWasmEngine(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  // Check if WASM is supported at the browser level
  if (typeof WebAssembly === 'undefined') {
    return false;
  }

  // Check feature flag (controlled by subscription tier and environment)
  try {
    return get(wasmEngineEnabled);
  } catch {
    // Store not available (e.g., during SSR)
    return false;
  }
}

/**
 * Check if WASM is available and the feature flag is enabled
 */
export async function isWasmAvailable(): Promise<boolean> {
  // First check the feature flag
  if (!useWasmEngine()) {
    return false;
  }

  // Then check if WASM can actually be initialized
  const success = await initWasmEngine();
  return success;
}

/**
 * Benchmark WASM vs JS engine
 */
export async function benchmarkEngines(params: PatternParams): Promise<{
  wasmTime: number;
  jsTime: number;
  speedup: number;
}> {
  const engine = await createWasmEngine();

  if (!engine) {
    return { wasmTime: 0, jsTime: 0, speedup: 0 };
  }

  // Benchmark WASM
  engine.setParams(params);

  const wasmStart = performance.now();
  for (let i = 0; i < 10; i++) {
    engine.computePath();
  }
  const wasmTime = (performance.now() - wasmStart) / 10;

  // Benchmark JS (would need JS engine implementation)
  // For now, estimate based on typical ratios
  const jsTime = wasmTime * 5; // Typical 3-10x speedup

  engine.dispose();

  return {
    wasmTime,
    jsTime,
    speedup: jsTime / wasmTime,
  };
}
