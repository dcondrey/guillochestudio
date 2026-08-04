import { writable, derived, get } from 'svelte/store';
import type { PatternParams, PatternLayer, ManualPath } from '@guilloche/shared';
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

// Global parameters (background, etc)
export const params = writable<PatternParams>(getDefaultParams());

// Multi-layer state
export const layers = writable<PatternLayer[]>([
  {
    id: generateId(),
    name: 'Base Pattern',
    type: 'vector',
    visible: true,
    color: '#000000',
    blendMode: 'normal',
    params: getDefaultParams(),
    opacity: 1,
    offsetX: 0,
    offsetY: 0,
  },
]);

export const activeLayerId = writable<string>(get(layers)[0].id);
export const patternLoading = writable(false);
export const patternError = writable<string | null>(null);

// History
export const history = writable<HistoryState[]>([]);
export const historyIndex = writable(-1);

// Engine shared instance
const engine = new GuillocheEngine();

// Image Cache for Reference Layers
const imageCache = new Map<string, HTMLImageElement>();

async function loadImage(url: string): Promise<HTMLImageElement> {
  if (imageCache.has(url)) return imageCache.get(url)!;
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageCache.set(url, img);
      resolve(img);
    };
    img.onerror = reject;
    img.src = url;
  });
}

/**
 * Derived: All paths and images for all visible layers
 */
export const renderedComposition = derived(
  [params, layers],
  ([$params, $layers], set) => {
    const compute = async () => {
      const results: any[] = [];
      for (const layer of $layers) {
        if (!layer.visible) continue;

        if (layer.type === 'vector') {
          const finalParams = { ...$params, ...layer.params };
          engine.setParams(finalParams);
          const path = engine.computePath();
          results.push({
            id: layer.id,
            type: 'vector',
            path,
            layerId: layer.id,
            blendMode: layer.blendMode,
            opacity: layer.opacity,
            color: layer.color,
            offsetX: layer.offsetX ?? 0,
            offsetY: layer.offsetY ?? 0,
          });
        } else if (layer.type === 'path' && layer.manualPath) {
          // Manual path rendering (convert ManualPath format to GeneratedPath for renderer)
          const genPath: GeneratedPath = {
            segments: layer.manualPath.segments.map((seg) => ({
              points: seg.points.map((p) => ({ x: p.x, y: p.y })),
            })),
            bounds: { minX: -1000, minY: -1000, maxX: 1000, maxY: 1000 },
            params: $params,
          };
          results.push({
            id: layer.id,
            type: 'vector',
            path: genPath,
            layerId: layer.id,
            blendMode: layer.blendMode,
            opacity: layer.opacity,
            color: layer.color,
            offsetX: layer.offsetX ?? 0,
            offsetY: layer.offsetY ?? 0,
          });
        } else if (layer.type === 'image' && layer.imageUrl) {
          try {
            const img = await loadImage(layer.imageUrl);
            results.push({
              id: layer.id,
              type: 'image',
              image: img,
              layerId: layer.id,
              blendMode: layer.blendMode,
              opacity: layer.opacity,
              brightness: layer.brightness || 1,
              contrast: layer.contrast || 1,
              offsetX: layer.offsetX ?? 0,
              offsetY: layer.offsetY ?? 0,
            });
          } catch {
            // image load failure is non-fatal; layer renders without image
          }
        }
      }
      set(results);
    };

    compute();
  },
  [] as any[]
);

/**
 * Derived: Active layer's params for the Inspector
 */
export const activeLayer = derived([layers, activeLayerId], ([$layers, $activeLayerId]) => {
  return $layers.find((l) => l.id === $activeLayerId) || null;
});

// Actions

export function updateParams(updates: Partial<PatternParams>): void {
  params.update((p) => ({ ...p, ...updates }));
}

export function setParams(newParams: PatternParams): void {
  params.set(deepClone(newParams));
}

export function updateActiveLayerParam<K extends keyof PatternParams>(
  key: K,
  value: PatternParams[K]
): void {
  const aid = get(activeLayerId);
  layers.update((ls) =>
    ls.map((l) => {
      if (l.id === aid) {
        return { ...l, params: { ...l.params, [key]: value } as PatternParams };
      }
      return l;
    })
  );
}

export function updateLayerStyle(id: string, updates: Partial<PatternLayer>): void {
  layers.update((ls) => ls.map((l) => (l.id === id ? { ...l, ...updates } : l)));
}

/**
 * Nudge a layer's position by a canvas-space delta. Called continuously while
 * dragging, so it does not push history — the caller commits once on drag end.
 */
export function moveLayerBy(id: string, dx: number, dy: number): void {
  layers.update((ls) =>
    ls.map((l) =>
      l.id === id ? { ...l, offsetX: (l.offsetX ?? 0) + dx, offsetY: (l.offsetY ?? 0) + dy } : l
    )
  );
}

export function resetLayerPosition(id: string): void {
  layers.update((ls) => ls.map((l) => (l.id === id ? { ...l, offsetX: 0, offsetY: 0 } : l)));
  saveToHistory('Reset layer position');
}

export function toggleLayerVisibility(id: string): void {
  layers.update((ls) => ls.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l)));
  saveToHistory('Toggled layer visibility');
}

/**
 * Move a layer within the stack. Composition order follows array order, so
 * swapping entries is what changes which layer draws on top.
 */
export function moveLayer(id: string, direction: 'up' | 'down'): void {
  layers.update((ls) => {
    const index = ls.findIndex((l) => l.id === id);
    if (index === -1) return ls;

    const target = direction === 'up' ? index + 1 : index - 1;
    if (target < 0 || target >= ls.length) return ls;

    const next = [...ls];
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  });
  saveToHistory('Reordered layers');
}

export function addLayer(name?: string, type: 'vector' | 'image' | 'path' = 'vector'): void {
  const newLayer: PatternLayer = {
    id: generateId(),
    name: name || `Layer ${get(layers).length + 1}`,
    type,
    visible: true,
    color: '#3b82f6',
    blendMode: 'normal',
    params: getDefaultParams(),
    opacity: 1,
    offsetX: 0,
    offsetY: 0,
    brightness: 1,
    contrast: 1,
  };
  layers.update((ls) => [...ls, newLayer]);
  activeLayerId.set(newLayer.id);
  saveToHistory('Added layer');
}

export function bakeActiveLayer(): void {
  const aid = get(activeLayerId);
  const al = get(activeLayer);
  if (!al || al.type !== 'vector') return;

  // Compute current path to "bake" it
  const finalParams = { ...get(params), ...al.params };
  engine.setParams(finalParams);
  const path = engine.computePath();
  const manualPath = engine.bakeToManualPath(path);

  layers.update((ls) =>
    ls.map((l) => {
      if (l.id === aid) {
        return {
          ...l,
          type: 'path',
          manualPath,
          name: `${l.name} (Baked)`,
        };
      }
      return l;
    })
  );
  saveToHistory('Baked layer to path');
}

export function updateManualPath(path: ManualPath): void {
  const aid = get(activeLayerId);
  layers.update((ls) =>
    ls.map((l) => {
      if (l.id === aid) return { ...l, manualPath: path };
      return l;
    })
  );
}

export function addImageLayer(url: string, name = 'Reference Image'): void {
  addLayer(name, 'image');
  const aid = get(activeLayerId);
  updateLayerStyle(aid, { imageUrl: url });
}

export function removeLayer(id: string): void {
  layers.update((ls) => {
    if (ls.length <= 1) return ls;
    return ls.filter((l) => l.id !== id);
  });
  const currentLayers = get(layers);
  if (get(activeLayerId) === id) {
    activeLayerId.set(currentLayers[0].id);
  }
  saveToHistory('Removed layer');
}

export function importComposition(data: any): void {
  if (data.layers) {
    layers.set(data.layers);
    if (data.params) params.set(data.params);
    if (data.layers[0]) activeLayerId.set(data.layers[0].id);
    saveToHistory('Imported design');
  }
}

export function resetParams(): void {
  params.set(getDefaultParams());
  layers.set([
    {
      id: generateId(),
      name: 'Base Pattern',
      type: 'vector',
      visible: true,
      color: '#000000',
      blendMode: 'normal',
      params: getDefaultParams(),
      opacity: 1,
      offsetX: 0,
      offsetY: 0,
    },
  ]);
  activeLayerId.set(get(layers)[0].id);
}

export function saveToHistory(description: string): void {
  const state: HistoryState = {
    id: generateId(),
    params: deepClone(get(params)),
    layers: deepClone(get(layers)),
    timestamp: new Date(),
    description,
  };

  history.update((h) => {
    const currentIndex = get(historyIndex);
    const newHistory = h.slice(0, currentIndex + 1);
    newHistory.push(state);
    if (newHistory.length > MAX_HISTORY) newHistory.shift();
    return newHistory;
  });

  historyIndex.update((i) => Math.min(i + 1, MAX_HISTORY - 1));
}

export function undo(): void {
  const idx = get(historyIndex);
  if (idx <= 0) return;
  const state = get(history)[idx - 1];
  params.set(state.params);
  layers.set(state.layers);
  historyIndex.set(idx - 1);
}

export function redo(): void {
  const idx = get(historyIndex);
  const h = get(history);
  if (idx >= h.length - 1) return;
  const state = h[idx + 1];
  params.set(state.params);
  layers.set(state.layers);
  historyIndex.set(idx + 1);
}
