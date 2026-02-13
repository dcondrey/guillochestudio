import { writable, derived, get, type Readable } from 'svelte/store';
import type { PatternParams, PatternLayer, BlendMode } from '@guilloche/shared';
import { getDefaultParams, deepClone, generateId } from '@guilloche/shared';
import { GuillocheEngine, type GeneratedPath } from '@guilloche/core';

// Maximum history states to keep
const MAX_HISTORY = 50;

// History state
interface HistoryState {
  id: string;
  params: PatternParams;
  layers: PatternLayer[];
  timestamp: Date;
  description: string;
}

// Core pattern state
export const params = writable<PatternParams>(getDefaultParams());
export const layers = writable<PatternLayer[]>([
  {
    id: generateId(),
    name: 'Base Pattern',
    visible: true,
    color: '#4f46e5',
    blendMode: 'normal',
    params: {},
    opacity: 1
  }
]);
export const activeLayerId = writable<string | null>(null);
export const patternLoading = writable(false);
export const patternError = writable<string | null>(null);

// History state
export const history = writable<HistoryState[]>([]);
export const historyIndex = writable(-1);

// Engine instance
let engine: GuillocheEngine | null = null;

// Get or create engine
function getEngine(): GuillocheEngine {
  if (!engine) {
    engine = new GuillocheEngine(get(params));
  }
  return engine;
}

// Derived: current path
export const currentPath = derived<[typeof params, typeof patternLoading], GeneratedPath | null>(
  [params, patternLoading],
  ([$params, $loading], set) => {
    if ($loading) {
      set(null);
      return;
    }

    try {
      const eng = getEngine();
      eng.setParams($params);
      const path = eng.computePath();
      set(path);
      patternError.set(null);
    } catch (err) {
      patternError.set(err instanceof Error ? err.message : 'Failed to generate pattern');
      set(null);
    }
  },
  null as GeneratedPath | null
);

// Derived: active layer
export const activeLayer: Readable<PatternLayer | null> = derived(
  [layers, activeLayerId],
  ([$layers, $activeLayerId]) => {
    if (!$activeLayerId) return $layers[0] || null;
    return $layers.find((l) => l.id === $activeLayerId) || null;
  }
);

// Derived: can undo/redo
export const canUndo: Readable<boolean> = derived(
  historyIndex,
  ($index) => $index > 0
);

export const canRedo: Readable<boolean> = derived(
  [history, historyIndex],
  ([$history, $index]) => $index < $history.length - 1
);

// Actions

/**
 * Update a single parameter
 */
export function updateParam<K extends keyof PatternParams>(key: K, value: PatternParams[K]): void {
  params.update((p) => ({ ...p, [key]: value }));
}

/**
 * Update multiple parameters at once
 */
export function updateParams(updates: Partial<PatternParams>): void {
  params.update((p) => ({ ...p, ...updates }));
}

/**
 * Reset to default parameters
 */
export function resetParams(): void {
  const defaults = getDefaultParams();
  params.set(defaults);
  saveToHistory('Reset to defaults');
}

/**
 * Set all parameters at once (e.g., from preset or loaded pattern)
 */
export function setParams(newParams: PatternParams): void {
  params.set(deepClone(newParams));
}

/**
 * Add a new layer
 */
export function addLayer(name?: string): void {
  const newLayer: PatternLayer = {
    id: generateId(),
    name: name || `Layer ${get(layers).length + 1}`,
    visible: true,
    color: '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0'),
    blendMode: 'normal',
    params: {},
    opacity: 1
  };
  layers.update((l) => [...l, newLayer]);
  activeLayerId.set(newLayer.id);
}

/**
 * Remove a layer
 */
export function removeLayer(id: string): void {
  layers.update((l) => {
    const filtered = l.filter((layer) => layer.id !== id);
    // Ensure at least one layer exists
    if (filtered.length === 0) {
      return l;
    }
    return filtered;
  });

  // Update active layer if needed
  if (get(activeLayerId) === id) {
    const currentLayers = get(layers);
    activeLayerId.set(currentLayers[0]?.id || null);
  }
}

/**
 * Duplicate a layer
 */
export function duplicateLayer(id: string): void {
  const currentLayers = get(layers);
  const layer = currentLayers.find((l) => l.id === id);
  if (!layer) return;

  const newLayer: PatternLayer = {
    ...deepClone(layer),
    id: generateId(),
    name: `${layer.name} (copy)`
  };

  const index = currentLayers.findIndex((l) => l.id === id);
  layers.update((l) => [...l.slice(0, index + 1), newLayer, ...l.slice(index + 1)]);
  activeLayerId.set(newLayer.id);
}

/**
 * Update layer properties
 */
export function updateLayer(id: string, updates: Partial<PatternLayer>): void {
  layers.update((l) => l.map((layer) => (layer.id === id ? { ...layer, ...updates } : layer)));
}

/**
 * Reorder layers
 */
export function reorderLayers(fromIndex: number, toIndex: number): void {
  layers.update((l) => {
    const result = [...l];
    const [removed] = result.splice(fromIndex, 1);
    result.splice(toIndex, 0, removed);
    return result;
  });
}

/**
 * Save current state to history
 */
export function saveToHistory(description: string): void {
  const state: HistoryState = {
    id: generateId(),
    params: deepClone(get(params)),
    layers: deepClone(get(layers)),
    timestamp: new Date(),
    description
  };

  history.update((h) => {
    const currentIndex = get(historyIndex);
    // Remove any future states if we're not at the end
    const newHistory = h.slice(0, currentIndex + 1);
    newHistory.push(state);
    // Limit history size
    if (newHistory.length > MAX_HISTORY) {
      newHistory.shift();
    }
    return newHistory;
  });

  historyIndex.update((i) => Math.min(i + 1, MAX_HISTORY - 1));
}

/**
 * Undo to previous state
 */
export function undo(): void {
  const currentIndex = get(historyIndex);
  if (currentIndex <= 0) return;

  historyIndex.set(currentIndex - 1);
  const state = get(history)[currentIndex - 1];
  if (state) {
    params.set(deepClone(state.params));
    layers.set(deepClone(state.layers));
  }
}

/**
 * Redo to next state
 */
export function redo(): void {
  const currentIndex = get(historyIndex);
  const historyLength = get(history).length;
  if (currentIndex >= historyLength - 1) return;

  historyIndex.set(currentIndex + 1);
  const state = get(history)[currentIndex + 1];
  if (state) {
    params.set(deepClone(state.params));
    layers.set(deepClone(state.layers));
  }
}

/**
 * Jump to specific history state
 */
export function jumpToHistory(index: number): void {
  const h = get(history);
  if (index < 0 || index >= h.length) return;

  historyIndex.set(index);
  const state = h[index];
  if (state) {
    params.set(deepClone(state.params));
    layers.set(deepClone(state.layers));
  }
}

/**
 * Clear engine cache (call when parameters change significantly)
 */
export function clearCache(): void {
  if (engine) {
    engine.clearCache();
  }
}
