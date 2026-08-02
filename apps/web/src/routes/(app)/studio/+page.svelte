<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { CanvasRenderer, SVGRenderer, GuillocheEngine } from '@guilloche/core';
  import {
    CURVE_FAMILIES,
    PATTERN_MODES,
    BLEND_MODES,
    EXPORT_SIZES,
    getPathLength,
    getDefaultParams,
  } from '@guilloche/shared';
  import type { ExportFormat } from '@guilloche/shared';
  import { exportPDF, downloadPDF } from '$lib/services/pdf-export';
  import {
    params,
    layers,
    activeLayerId,
    renderedComposition,
    activeLayer,
    updateActiveLayerParam,
    updateLayerStyle,
    addLayer,
    removeLayer,
    bakeActiveLayer,
    updateManualPath,
    undo,
    redo,
    updateParams,
    resetParams,
  } from '$lib/stores/pattern';
  import ColorPicker from '$lib/components/ui/ColorPicker.svelte';
  import ImportModal from '$lib/components/ui/ImportModal.svelte';
  import TemplateModal from '$lib/components/ui/TemplateModal.svelte';
  import { fade, slide, fly } from 'svelte/transition';

  // State
  let canvas: HTMLCanvasElement;
  let renderer: CanvasRenderer | null = null;
  let showImport = false;
  let showTemplates = false;
  let showExportPanel = false;

  // Export State
  let exportFormat: ExportFormat = 'png';
  let exportSize = 2000;
  let exportTransparent = false;
  let exporting = false;
  let exportError: string | null = null;

  // Export format options
  const exportFormats: { value: ExportFormat; label: string; desc: string }[] = [
    { value: 'png', label: 'PNG', desc: 'Raster image' },
    { value: 'svg', label: 'SVG', desc: 'Vector graphics' },
    { value: 'pdf', label: 'PDF', desc: 'Print ready' },
  ];

  // Viewport State
  let view = { zoom: 1, panX: 0, panY: 0 };
  type ToolType = 'select' | 'pan' | 'text' | 'measure' | 'edit';
  let activeTool: ToolType = 'select';

  // Tool configuration
  const tools: { id: ToolType; label: string; title: string }[] = [
    { id: 'select', label: 'V', title: 'Select (V)' },
    { id: 'pan', label: 'H', title: 'Pan (H)' },
    { id: 'edit', label: 'A', title: 'Direct Edit (A)' },
    { id: 'text', label: 'T', title: 'Microtext (T)' },
    { id: 'measure', label: 'M', title: 'Measure (M)' },
  ];
  let dragging = false;
  let lastMouse = { x: 0, y: 0 };

  // Interaction State
  let measureStart: { x: number; y: number } | null = null;
  let measureCurrent: { x: number; y: number } | null = null;
  let selectedPoint: { segIdx: number; ptIdx: number; type: 'anchor' | 'cp1' | 'cp2' } | null =
    null;

  // UI State
  let navigatorExpanded = true;
  let activeInspectorTab = 'geometry';
  let showAdvancedParams = false;

  // Slider configurations for all parameters
  type ParamConfig = {
    id: keyof import('@guilloche/shared').PatternParams;
    label: string;
    min: number;
    max: number;
    step: number;
  };

  const geometryParams: ParamConfig[] = [
    { id: 'R', label: 'Outer Radius', min: 10, max: 500, step: 1 },
    { id: 'r', label: 'Inner Radius', min: 1, max: 300, step: 1 },
    { id: 'd', label: 'Pen Distance', min: 0, max: 400, step: 1 },
  ];

  const advancedParams: ParamConfig[] = [
    { id: 'k', label: 'Frequency', min: 1, max: 50, step: 1 },
    { id: 'm', label: 'Modulation', min: 0, max: 1, step: 0.01 },
    { id: 'mf', label: 'Mod Frequency', min: 1, max: 50, step: 1 },
    { id: 'phase', label: 'Phase', min: 0, max: 6.28, step: 0.01 },
    { id: 'rot', label: 'Rotation', min: 0, max: 6.28, step: 0.01 },
    { id: 's', label: 'Scale', min: 0.1, max: 3, step: 0.01 },
    { id: 'steps', label: 'Resolution', min: 1000, max: 50000, step: 1000 },
    { id: 'symmetry', label: 'Symmetry', min: 1, max: 24, step: 1 },
  ];

  const styleParams: ParamConfig[] = [
    { id: 'lw', label: 'Line Width', min: 0.1, max: 5, step: 0.1 },
    { id: 'glow', label: 'Glow', min: 0, max: 20, step: 0.5 },
    { id: 'noise', label: 'Noise', min: 0, max: 1, step: 0.01 },
  ];

  function handleBlendModeChange(layerId: string, value: string) {
    updateLayerStyle(layerId, { blendMode: value as import('@guilloche/shared').BlendMode });
  }

  function handleFamilyChange(value: string) {
    updateActiveLayerParam('family', value as import('@guilloche/shared').CurveFamily);
  }

  function getContext() {
    return renderer?.getContext() ?? null;
  }

  function initRenderer() {
    if (!canvas || !browser) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.parentElement?.getBoundingClientRect();
    if (!rect) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    ctx.scale(dpr, dpr);

    renderer = new CanvasRenderer(ctx, rect.width, rect.height);
    render();
  }

  function render() {
    if (!renderer || !canvas) return;
    renderer.clear($params.bgColor);

    const ctx = getContext();
    if (!ctx) return;
    ctx.save();

    ctx.translate(view.panX, view.panY);
    ctx.scale(view.zoom, view.zoom);

    const items = $renderedComposition || [];

    for (const comp of items) {
      if (comp.type === 'vector') {
        renderer.renderPath(comp.path, {
          strokeColor: $params.useGradient ? undefined : comp.color,
          gradient: $params.useGradient ? [$params.startColor, $params.endColor] : undefined,
          opacity: comp.opacity,
          blendMode: comp.blendMode,
          glow: $params.glow,
        });

        if ($activeLayer?.params?.text?.active && comp.layerId === $activeLayerId) {
          renderMicrotext(ctx, comp.path, $activeLayer.params.text);
        }

        if (
          activeTool === 'edit' &&
          comp.layerId === $activeLayerId &&
          $activeLayer?.type === 'path'
        ) {
          drawBezierUI(ctx, $activeLayer.manualPath);
        }
      } else if (comp.type === 'image') {
        renderer.renderImage(comp.image, {
          opacity: comp.opacity,
          blendMode: comp.blendMode,
          brightness: comp.brightness,
          contrast: comp.contrast,
        });
      }
    }

    ctx.restore();

    if (activeTool === 'measure' && measureStart && measureCurrent) {
      drawMeasureTool(ctx);
    }

    if ($params.vignette) {
      renderer.applyVignette();
    }
  }

  function drawBezierUI(ctx: CanvasRenderingContext2D, path: any) {
    if (!path) return;
    const handleSize = 3 / view.zoom;
    const anchorSize = 4 / view.zoom;

    path.segments.forEach((seg: any, sIdx: number) => {
      seg.points.forEach((pt: any, pIdx: number) => {
        const isSelected = selectedPoint?.segIdx === sIdx && selectedPoint?.ptIdx === pIdx;

        if (pt.type === 'bezier' && pt.cp1 && pt.cp2) {
          ctx.strokeStyle = 'rgba(59, 130, 246, 0.4)';
          ctx.lineWidth = 1 / view.zoom;
          ctx.beginPath();
          ctx.moveTo(pt.x, pt.y);
          ctx.lineTo(pt.cp1.x, pt.cp1.y);
          ctx.moveTo(pt.x, pt.y);
          ctx.lineTo(pt.cp2.x, pt.cp2.y);
          ctx.stroke();

          ctx.fillStyle = selectedPoint?.type === 'cp1' && isSelected ? '#3b82f6' : '#fff';
          ctx.strokeStyle = '#3b82f6';
          ctx.beginPath();
          ctx.arc(pt.cp1.x, pt.cp1.y, handleSize, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = selectedPoint?.type === 'cp2' && isSelected ? '#3b82f6' : '#fff';
          ctx.beginPath();
          ctx.arc(pt.cp2.x, pt.cp2.y, handleSize, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }

        ctx.fillStyle = '#3b82f6';
        ctx.beginPath();
        ctx.arc(
          pt.x,
          pt.y,
          isSelected && selectedPoint?.type === 'anchor' ? anchorSize * 1.5 : anchorSize,
          0,
          Math.PI * 2
        );
        ctx.fill();
        if (isSelected && selectedPoint?.type === 'anchor') {
          ctx.strokeStyle = 'white';
          ctx.lineWidth = 1 / view.zoom;
          ctx.stroke();
        }
      });
    });
  }

  function drawMeasureTool(ctx: CanvasRenderingContext2D) {
    if (!measureStart || !measureCurrent) return;
    ctx.save();
    ctx.strokeStyle = '#ef4444';
    ctx.fillStyle = '#ef4444';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 3]);
    ctx.beginPath();
    ctx.moveTo(measureStart.x, measureStart.y);
    ctx.lineTo(measureCurrent.x, measureCurrent.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(measureStart.x, measureStart.y, 3, 0, Math.PI * 2);
    ctx.arc(measureCurrent.x, measureCurrent.y, 3, 0, Math.PI * 2);
    ctx.fill();
    const dx = (measureCurrent.x - measureStart.x) / view.zoom;
    const dy = (measureCurrent.y - measureStart.y) / view.zoom;
    const label = `${Math.sqrt(dx * dx + dy * dy).toFixed(1)} units`;
    ctx.font = '10px monospace';
    ctx.fillText(label, measureCurrent.x + 10, measureCurrent.y);
    ctx.restore();
  }

  function renderMicrotext(ctx: CanvasRenderingContext2D, path: any, textParams: any) {
    const text = textParams.content || 'SECURITY';
    ctx.font = `${textParams.fontSize || 3}px monospace`;
    ctx.fillStyle = textParams.color || '#000';

    path.segments.forEach((seg: any) => {
      const length = getPathLength(seg.points);
      const density = textParams.density || 1;
      const charSpacing = (textParams.fontSize || 3) / density;
      const charCount = Math.floor(length / charSpacing);

      for (let i = 0; i < charCount; i++) {
        const t = i / charCount;
        const ptIdx = Math.floor(t * (seg.points.length - 1));
        const p = seg.points[ptIdx];
        const next = seg.points[ptIdx + 1] || p;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(Math.atan2(next.y - p.y, next.x - p.x));
        ctx.fillText(text[i % text.length], 0, 0);
        ctx.restore();
      }
    });
  }

  function screenToWorld(sx: number, sy: number) {
    const centerX = canvas.width / (window.devicePixelRatio || 1) / 2;
    const centerY = canvas.height / (window.devicePixelRatio || 1) / 2;
    return {
      x: (sx - centerX - view.panX) / view.zoom,
      y: (sy - centerY - view.panY) / view.zoom,
    };
  }

  function handleMouseDown(e: MouseEvent) {
    dragging = true;
    lastMouse = { x: e.clientX, y: e.clientY };
    const rect = canvas.getBoundingClientRect();
    const m = { x: e.clientX - rect.left, y: e.clientY - rect.top };

    if (activeTool === 'measure') {
      measureStart = m;
      measureCurrent = m;
    } else if (activeTool === 'edit' && $activeLayer?.type === 'path') {
      const world = screenToWorld(m.x, m.y);
      const threshold = 15 / view.zoom;
      selectedPoint = null;

      outer: for (let sIdx = 0; sIdx < $activeLayer.manualPath!.segments.length; sIdx++) {
        const seg = $activeLayer.manualPath!.segments[sIdx];
        for (let pIdx = 0; pIdx < seg.points.length; pIdx++) {
          const pt = seg.points[pIdx];
          if (Math.abs(pt.x - world.x) < threshold && Math.abs(pt.y - world.y) < threshold) {
            selectedPoint = { segIdx: sIdx, ptIdx: pIdx, type: 'anchor' };
            break outer;
          } else if (
            pt.cp1 &&
            Math.abs(pt.cp1.x - world.x) < threshold &&
            Math.abs(pt.cp1.y - world.y) < threshold
          ) {
            selectedPoint = { segIdx: sIdx, ptIdx: pIdx, type: 'cp1' };
            break outer;
          } else if (
            pt.cp2 &&
            Math.abs(pt.cp2.x - world.x) < threshold &&
            Math.abs(pt.cp2.y - world.y) < threshold
          ) {
            selectedPoint = { segIdx: sIdx, ptIdx: pIdx, type: 'cp2' };
            break outer;
          }
        }
      }
    } else if (activeTool === 'select') {
      const world = screenToWorld(m.x, m.y);
      const threshold = 15 / view.zoom;
      for (let i = $renderedComposition.length - 1; i >= 0; i--) {
        const comp = $renderedComposition[i];
        if (comp.type !== 'vector') continue;
        let hit = false;
        for (const seg of comp.path.segments) {
          for (const p of seg.points) {
            if (Math.abs(p.x - world.x) < threshold && Math.abs(p.y - world.y) < threshold) {
              hit = true;
              break;
            }
          }
          if (hit) break;
        }
        if (hit) {
          activeLayerId.set(comp.layerId);
          break;
        }
      }
    }
    render();
  }

  function handleMouseMove(e: MouseEvent) {
    if (!dragging) return;
    const dx = e.clientX - lastMouse.x;
    const dy = e.clientY - lastMouse.y;
    const rect = canvas.getBoundingClientRect();
    const m = { x: e.clientX - rect.left, y: e.clientY - rect.top };

    if (activeTool === 'pan' || (e.altKey && dragging)) {
      view.panX += dx;
      view.panY += dy;
    } else if (activeTool === 'measure') {
      measureCurrent = m;
    } else if (activeTool === 'edit' && selectedPoint && $activeLayer?.manualPath) {
      const path = { ...$activeLayer.manualPath };
      const pt = path.segments[selectedPoint.segIdx].points[selectedPoint.ptIdx];

      if (selectedPoint.type === 'anchor') {
        pt.x += dx / view.zoom;
        pt.y += dy / view.zoom;
        if (pt.cp1) {
          pt.cp1.x += dx / view.zoom;
          pt.cp1.y += dy / view.zoom;
        }
        if (pt.cp2) {
          pt.cp2.x += dx / view.zoom;
          pt.cp2.y += dy / view.zoom;
        }
      } else if (selectedPoint.type === 'cp1' && pt.cp1) {
        pt.cp1.x += dx / view.zoom;
        pt.cp1.y += dy / view.zoom;
      } else if (selectedPoint.type === 'cp2' && pt.cp2) {
        pt.cp2.x += dx / view.zoom;
        pt.cp2.y += dy / view.zoom;
      }
      updateManualPath(path);
    }

    lastMouse = { x: e.clientX, y: e.clientY };
    render();
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLSelectElement ||
      e.target instanceof HTMLTextAreaElement
    )
      return;
    switch (e.key.toLowerCase()) {
      case 'v':
        activeTool = 'select';
        break;
      case 'h':
        activeTool = 'pan';
        break;
      case 'a':
        activeTool = 'edit';
        break;
      case 't':
        activeTool = 'text';
        break;
      case 'm':
        activeTool = 'measure';
        break;
      case 'z':
        if (e.metaKey || e.ctrlKey) {
          e.shiftKey ? redo() : undo();
          e.preventDefault();
        }
        break;
      case 'e':
        if (e.metaKey || e.ctrlKey) {
          e.preventDefault();
          showExportPanel = true;
        }
        break;
      case 'backspace':
      case 'delete':
        if ($activeLayerId) {
          removeLayer($activeLayerId);
        }
        break;
    }
  }

  function handleWheel(e: WheelEvent) {
    e.preventDefault();
    const zoomFactor = Math.exp(-e.deltaY * 0.001);
    view.zoom = Math.min(20, Math.max(0.05, view.zoom * zoomFactor));
    render();
  }

  function resetView() {
    view = { zoom: 1, panX: 0, panY: 0 };
    render();
  }

  async function handleExport() {
    if (!renderer || exporting) return;
    exporting = true;
    exportError = null;

    try {
      const engine = new GuillocheEngine();

      if (exportFormat === 'svg') {
        const svgRenderer = new SVGRenderer();
        // Get current layer params
        const layerParams = { ...$params, ...($activeLayer?.params || {}) };
        engine.setParams(layerParams);
        const path = engine.computePath();
        const svg = svgRenderer.render(path, {
          backgroundColor: exportTransparent ? undefined : $params.bgColor,
          strokeColor: $activeLayer?.color || '#000000',
          gradient: $params.useGradient ? [$params.startColor, $params.endColor] : undefined,
          glow: $params.glow,
        });
        downloadFile(svg, 'guilloche-pattern.svg', 'image/svg+xml');
      } else if (exportFormat === 'png') {
        // Create offscreen canvas at export size
        const offCanvas = document.createElement('canvas');
        offCanvas.width = exportSize;
        offCanvas.height = exportSize;
        const offCtx = offCanvas.getContext('2d');
        if (!offCtx) throw new Error('Could not create canvas context');

        const offRenderer = new CanvasRenderer(offCtx, exportSize, exportSize);
        offRenderer.clear(exportTransparent ? 'transparent' : $params.bgColor);

        // Render all layers
        for (const comp of $renderedComposition) {
          if (comp.type === 'vector') {
            offRenderer.renderPath(comp.path, {
              strokeColor: $params.useGradient ? undefined : comp.color,
              gradient: $params.useGradient ? [$params.startColor, $params.endColor] : undefined,
              opacity: comp.opacity,
              blendMode: comp.blendMode,
              glow: $params.glow,
            });
          }
        }

        if ($params.vignette) {
          offRenderer.applyVignette();
        }

        const dataUrl = offCanvas.toDataURL('image/png');
        downloadFile(dataUrl, 'guilloche-pattern.png', 'image/png', true);
      } else if (exportFormat === 'pdf') {
        const layerParams = { ...$params, ...($activeLayer?.params || {}) };
        engine.setParams(layerParams);
        const path = engine.computePath();

        downloadPDF(
          exportPDF(path, {
            pageSize: 'a4',
            orientation: 'portrait',
            margin: 10,
            strokeColor: $activeLayer?.color || '#000000',
          })
        );
      }

      showExportPanel = false;
    } catch (err) {
      exportError = err instanceof Error ? err.message : 'Export failed';
    } finally {
      exporting = false;
    }
  }

  function downloadFile(content: string, filename: string, mimeType: string, isDataUrl = false) {
    const a = document.createElement('a');
    if (isDataUrl) {
      a.href = content;
    } else {
      const blob = new Blob([content], { type: mimeType });
      a.href = URL.createObjectURL(blob);
    }
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    if (!isDataUrl) {
      URL.revokeObjectURL(a.href);
    }
  }

  onMount(() => {
    initRenderer();
    window.addEventListener('resize', initRenderer);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('resize', initRenderer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  });

  $: if (browser && renderer && $renderedComposition && $params && view) {
    render();
  }
</script>

<div class="flex h-screen flex-col bg-[#F5F5F7] text-gray-900 overflow-hidden select-none">
  <!-- Header -->
  <header
    class="fixed top-6 inset-x-6 h-16 bg-white/70 backdrop-blur-2xl rounded-[2rem] shadow-2xl shadow-black/5 flex items-center justify-between px-8 z-50 border border-white/50"
  >
    <div class="flex items-center gap-8">
      <a href="/" class="flex items-center gap-3">
        <img src="/logo.svg" alt="" class="h-6 w-auto" />
        <span class="text-xs font-semibold uppercase tracking-[0.3em]">Studio</span>
      </a>
      <div class="h-4 w-px bg-gray-200"></div>
      <nav class="flex gap-1 bg-gray-100/50 p-1 rounded-2xl">
        {#each tools as tool}
          <button
            on:click={() => (activeTool = tool.id)}
            title={tool.title}
            aria-label={tool.title}
            aria-pressed={activeTool === tool.id}
            class="w-10 h-10 text-[10px] font-semibold uppercase rounded-xl transition-all
                          {activeTool === tool.id
              ? 'bg-white text-black shadow-sm'
              : 'text-gray-400 hover:text-gray-600'}"
          >
            <span aria-hidden="true">{tool.label}</span>
          </button>
        {/each}
      </nav>
    </div>

    <div class="flex items-center gap-6">
      <div class="flex gap-2">
        <button
          on:click={undo}
          title="Undo (Cmd+Z)"
          aria-label="Undo"
          class="w-10 h-10 flex items-center justify-center bg-gray-50 hover:bg-gray-100 rounded-full transition-all text-xs"
          >↶</button
        >
        <button
          on:click={redo}
          title="Redo (Cmd+Shift+Z)"
          aria-label="Redo"
          class="w-10 h-10 flex items-center justify-center bg-gray-50 hover:bg-gray-100 rounded-full transition-all text-xs"
          >↷</button
        >
        <button
          on:click={resetView}
          title="Reset View"
          aria-label="Reset view"
          class="w-10 h-10 flex items-center justify-center bg-gray-50 hover:bg-gray-100 rounded-full transition-all text-xs"
          >⌂</button
        >
      </div>
      <div class="h-4 w-px bg-gray-200"></div>
      <button
        on:click={() => (showTemplates = true)}
        class="text-[10px] font-semibold uppercase tracking-widest text-gray-400 hover:text-black transition-all"
        >Templates</button
      >
      <button
        on:click={() => (showExportPanel = true)}
        class="bg-black text-white px-8 py-3 rounded-full text-[10px] font-semibold uppercase tracking-[0.2em] shadow-xl hover:scale-105 transition-all"
        >Export</button
      >
    </div>
  </header>

  <div class="flex-1 relative mt-24 mb-6 mx-6 overflow-hidden flex gap-6">
    <!-- Navigator Island (Layers) -->
    <aside
      class="w-72 flex flex-col gap-6 shrink-0 transition-all duration-500 {navigatorExpanded
        ? ''
        : '-ml-80'}"
    >
      <div
        class="bg-white/80 backdrop-blur-2xl rounded-[2.5rem] border border-white/50 shadow-2xl shadow-black/5 flex-1 flex flex-col overflow-hidden"
      >
        <div class="px-8 py-6 border-b border-gray-100 flex justify-between items-center">
          <h3 class="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Layers</h3>
          <button
            on:click={() => addLayer()}
            class="text-blue-600 font-bold text-lg hover:scale-110 transition-transform">+</button
          >
        </div>
        <div class="flex-1 overflow-y-auto p-4 space-y-3">
          {#each $layers as layer (layer.id)}
            <div
              role="button"
              tabindex="0"
              aria-pressed={layer.id === $activeLayerId}
              on:click={() => activeLayerId.set(layer.id)}
              on:keydown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  activeLayerId.set(layer.id);
                }
              }}
              class="p-5 rounded-3xl border transition-all cursor-pointer group {layer.id ===
              $activeLayerId
                ? 'bg-white border-blue-100 shadow-xl ring-4 ring-blue-50/50'
                : 'bg-gray-50/50 border-transparent hover:border-gray-200'}"
            >
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-4">
                  <div
                    class="w-3 h-3 rounded-full shrink-0"
                    style="background-color: {layer.color}"
                  ></div>
                  <span
                    class="text-[10px] font-semibold uppercase tracking-widest truncate max-w-[120px]"
                    >{layer.name}</span
                  >
                </div>
                <div class="flex items-center gap-1">
                  <span class="text-[8px] text-gray-300 uppercase">{layer.type}</span>
                  <button
                    on:click|stopPropagation={() => removeLayer(layer.id)}
                    class="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity px-2 text-lg"
                    >×</button
                  >
                </div>
              </div>
            </div>
          {/each}
        </div>
      </div>
    </aside>

    <!-- Canvas Stage -->
    <main
      class="flex-1 relative bg-white rounded-[3.5rem] shadow-2xl shadow-black/5 border border-white/50 overflow-hidden"
    >
      <canvas
        bind:this={canvas}
        on:mousedown={handleMouseDown}
        on:mousemove={handleMouseMove}
        on:mouseup={() => {
          dragging = false;
          if (activeTool === 'measure') {
            measureStart = null;
            render();
          }
        }}
        on:mouseleave={() => (dragging = false)}
        on:wheel={handleWheel}
        class="w-full h-full {activeTool === 'pan'
          ? 'cursor-grab'
          : activeTool === 'edit'
            ? 'cursor-crosshair'
            : 'cursor-default'}"
      />

      <!-- Status Bar -->
      <div class="absolute bottom-10 left-10 flex gap-4 pointer-events-none">
        <div
          class="px-6 py-3 bg-white/90 backdrop-blur-xl rounded-2xl border border-gray-100 shadow-xl flex gap-8 items-center text-[10px] font-bold uppercase tracking-widest"
        >
          <span>Zoom {(view.zoom * 100).toFixed(0)}%</span>
          <div class="w-px h-4 bg-gray-100"></div>
          <span class="text-blue-600 uppercase">{activeTool}</span>
          <div class="w-px h-4 bg-gray-100"></div>
          <span class="text-gray-400">{$layers.length} Layers</span>
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="absolute bottom-10 right-10 flex gap-2">
        <button
          on:click={resetView}
          class="px-4 py-2 bg-white/90 backdrop-blur-xl rounded-xl border border-gray-100 shadow-lg text-[10px] font-semibold uppercase tracking-widest hover:bg-gray-50 transition-all pointer-events-auto"
        >
          Fit
        </button>
      </div>
    </main>

    <!-- Inspector Island -->
    <aside
      class="w-[420px] bg-white/80 backdrop-blur-3xl rounded-[3rem] border border-white/50 shadow-2xl shadow-black/5 shrink-0 flex flex-col transition-all overflow-hidden"
    >
      <!-- Tabs -->
      <div class="flex border-b border-gray-100 p-2 gap-1">
        {#each ['geometry', 'style', 'effects', 'security'] as tab}
          <button
            on:click={() => (activeInspectorTab = tab)}
            class="flex-1 py-3 text-[9px] font-semibold uppercase tracking-widest rounded-2xl transition-all
                          {activeInspectorTab === tab
              ? 'bg-black text-white'
              : 'text-gray-400 hover:bg-gray-50'}"
          >
            {tab}
          </button>
        {/each}
      </div>

      <div class="p-8 space-y-8 overflow-y-auto flex-1 scrollbar-hide">
        {#if !$activeLayer}
          <div
            class="h-full flex flex-col items-center justify-center text-center gap-6 opacity-20"
          >
            <div class="text-4xl">📐</div>
            <p class="text-[10px] font-semibold uppercase tracking-widest">Select a Layer</p>
          </div>
        {:else}
          <!-- GEOMETRY TAB -->
          {#if activeInspectorTab === 'geometry'}
            <section class="space-y-6" transition:fade={{ duration: 150 }}>
              <!-- Pattern Mode -->
              <div role="group" aria-labelledby="studio-pattern-mode-label" class="space-y-3">
                <span
                  id="studio-pattern-mode-label"
                  class="block text-[9px] font-semibold uppercase tracking-widest text-gray-400"
                  >Pattern Mode</span
                >
                <div class="grid grid-cols-4 gap-2">
                  {#each PATTERN_MODES as mode}
                    <button
                      on:click={() => updateActiveLayerParam('mode', mode.value)}
                      class="p-3 rounded-2xl border text-center transition-all {($activeLayer.params
                        .mode || 'curve') === mode.value
                        ? 'bg-black text-white border-black'
                        : 'bg-gray-50 border-gray-100 hover:border-gray-300'}"
                    >
                      <div class="text-lg mb-1">{mode.icon}</div>
                      <div class="text-[8px] font-semibold uppercase">{mode.label}</div>
                    </button>
                  {/each}
                </div>
              </div>

              <!-- Curve Family -->
              <div class="space-y-3">
                <label
                  for="studio-curve-family"
                  class="block text-[9px] font-semibold uppercase tracking-widest text-gray-400"
                  >Curve Family</label
                >
                <select
                  id="studio-curve-family"
                  value={$activeLayer.params.family || 'hypo'}
                  on:change={(e) => handleFamilyChange(e.currentTarget.value)}
                  class="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-100"
                >
                  {#each CURVE_FAMILIES as f}<option value={f.value}>{f.label}</option>{/each}
                </select>
              </div>

              <!-- Main Geometry Params -->
              <div class="space-y-5">
                {#each geometryParams as p}
                  <div class="space-y-3">
                    <div class="flex justify-between items-center">
                      <span class="text-[9px] font-semibold uppercase tracking-widest text-gray-500"
                        >{p.label}</span
                      >
                      <input
                        type="number"
                        min={p.min}
                        max={p.max}
                        step={p.step}
                        value={$activeLayer.params[p.id] ?? getDefaultParams()[p.id]}
                        on:change={(e) => updateActiveLayerParam(p.id, +e.currentTarget.value)}
                        class="w-20 text-right text-sm font-bold bg-transparent outline-none"
                      />
                    </div>
                    <input
                      type="range"
                      min={p.min}
                      max={p.max}
                      step={p.step}
                      value={$activeLayer.params[p.id] ?? getDefaultParams()[p.id]}
                      on:input={(e) => updateActiveLayerParam(p.id, +e.currentTarget.value)}
                      class="w-full h-1.5 bg-gray-100 rounded-full appearance-none cursor-pointer accent-black"
                    />
                  </div>
                {/each}
              </div>

              <!-- Advanced Toggle -->
              <button
                on:click={() => (showAdvancedParams = !showAdvancedParams)}
                class="w-full py-3 text-[9px] font-semibold uppercase tracking-widest text-gray-400 hover:text-black flex items-center justify-center gap-2"
              >
                <span>{showAdvancedParams ? 'Hide' : 'Show'} Advanced</span>
                <span class="text-xs">{showAdvancedParams ? '▲' : '▼'}</span>
              </button>

              <!-- Advanced Params -->
              {#if showAdvancedParams}
                <div
                  class="space-y-5 pt-4 border-t border-gray-100"
                  transition:slide={{ duration: 200 }}
                >
                  {#each advancedParams as p}
                    <div class="space-y-3">
                      <div class="flex justify-between items-center">
                        <span
                          class="text-[9px] font-semibold uppercase tracking-widest text-gray-500"
                          >{p.label}</span
                        >
                        <input
                          type="number"
                          min={p.min}
                          max={p.max}
                          step={p.step}
                          value={$activeLayer.params[p.id] ?? getDefaultParams()[p.id]}
                          on:change={(e) => updateActiveLayerParam(p.id, +e.currentTarget.value)}
                          class="w-20 text-right text-sm font-bold bg-transparent outline-none"
                        />
                      </div>
                      <input
                        type="range"
                        min={p.min}
                        max={p.max}
                        step={p.step}
                        value={$activeLayer.params[p.id] ?? getDefaultParams()[p.id]}
                        on:input={(e) => updateActiveLayerParam(p.id, +e.currentTarget.value)}
                        class="w-full h-1.5 bg-gray-100 rounded-full appearance-none cursor-pointer accent-black"
                      />
                    </div>
                  {/each}

                  <!-- Symmetry Toggles -->
                  <div class="grid grid-cols-3 gap-3 pt-4">
                    <label
                      class="flex items-center gap-2 p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100"
                    >
                      <input
                        type="checkbox"
                        checked={$activeLayer.params.reflectH ?? false}
                        on:change={(e) =>
                          updateActiveLayerParam('reflectH', e.currentTarget.checked)}
                        class="accent-blue-600"
                        aria-label="Horizontal reflection"
                      />
                      <span aria-hidden="true" class="text-[9px] font-semibold uppercase">↔ H</span>
                    </label>
                    <label
                      class="flex items-center gap-2 p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100"
                    >
                      <input
                        type="checkbox"
                        checked={$activeLayer.params.reflectV ?? false}
                        on:change={(e) =>
                          updateActiveLayerParam('reflectV', e.currentTarget.checked)}
                        class="accent-blue-600"
                        aria-label="Vertical reflection"
                      />
                      <span aria-hidden="true" class="text-[9px] font-semibold uppercase">↕ V</span>
                    </label>
                    <label
                      class="flex items-center gap-2 p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100"
                    >
                      <input
                        type="checkbox"
                        checked={$activeLayer.params.kaleidoscope ?? false}
                        on:change={(e) =>
                          updateActiveLayerParam('kaleidoscope', e.currentTarget.checked)}
                        class="accent-blue-600"
                        aria-label="Kaleidoscope"
                      />
                      <span aria-hidden="true" class="text-[9px] font-semibold uppercase">◇ K</span>
                    </label>
                  </div>
                </div>
              {/if}

              <!-- Bake Button -->
              {#if $activeLayer.type === 'vector'}
                <button
                  on:click={bakeActiveLayer}
                  class="w-full py-4 bg-blue-50 text-blue-600 rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all mt-6"
                >
                  Bake to Editable Path
                </button>
              {/if}
            </section>

            <!-- STYLE TAB -->
          {:else if activeInspectorTab === 'style'}
            <section class="space-y-6" transition:fade={{ duration: 150 }}>
              <h4 class="text-[10px] font-semibold uppercase tracking-[0.3em] text-blue-600">
                Stroke & Color
              </h4>

              <!-- Layer Color -->
              <ColorPicker
                label="Stroke Color"
                color={$activeLayer.color}
                on:change={(e) => updateLayerStyle($activeLayer.id, { color: e.detail })}
              />

              <!-- Blend Mode -->
              <div class="space-y-3">
                <label
                  class="block text-[9px] font-semibold uppercase tracking-widest text-gray-400"
                  for="blend-mode">Blend Mode</label
                >
                <select
                  id="blend-mode"
                  value={$activeLayer.blendMode || 'normal'}
                  on:change={(e) => handleBlendModeChange($activeLayer.id, e.currentTarget.value)}
                  class="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 text-sm font-medium outline-none"
                >
                  {#each BLEND_MODES as bm}<option value={bm.value}>{bm.label}</option>{/each}
                </select>
              </div>

              <!-- Style Params -->
              {#each styleParams as p}
                {@const paramValue = Number(
                  $activeLayer.params[p.id] ?? $params[p.id] ?? getDefaultParams()[p.id]
                )}
                <div class="space-y-3">
                  <div class="flex justify-between items-center">
                    <span class="text-[9px] font-semibold uppercase tracking-widest text-gray-500"
                      >{p.label}</span
                    >
                    <span class="text-sm font-bold">{paramValue.toFixed(p.step < 1 ? 2 : 0)}</span>
                  </div>
                  <input
                    type="range"
                    min={p.min}
                    max={p.max}
                    step={p.step}
                    value={paramValue}
                    on:input={(e) => updateActiveLayerParam(p.id, +e.currentTarget.value)}
                    class="w-full h-1.5 bg-gray-100 rounded-full appearance-none cursor-pointer accent-black"
                  />
                </div>
              {/each}

              <!-- Opacity -->
              <div class="space-y-3">
                <div class="flex justify-between items-center">
                  <span class="text-[9px] font-semibold uppercase tracking-widest text-gray-500"
                    >Opacity</span
                  >
                  <span class="text-sm font-bold">{Math.round($activeLayer.opacity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={$activeLayer.opacity}
                  on:input={(e) =>
                    updateLayerStyle($activeLayer.id, { opacity: +e.currentTarget.value })}
                  class="w-full h-1.5 bg-gray-100 rounded-full appearance-none cursor-pointer accent-black"
                />
              </div>

              <!-- Dashed Line -->
              <label
                class="flex items-center justify-between p-4 bg-gray-50 rounded-2xl cursor-pointer hover:bg-gray-100"
              >
                <span class="text-[9px] font-semibold uppercase tracking-widest">Dashed Line</span>
                <input
                  type="checkbox"
                  checked={$activeLayer.params.dashed ?? false}
                  on:change={(e) => updateActiveLayerParam('dashed', e.currentTarget.checked)}
                  class="w-5 h-5 accent-blue-600"
                />
              </label>
            </section>

            <!-- EFFECTS TAB -->
          {:else if activeInspectorTab === 'effects'}
            <section class="space-y-6" transition:fade={{ duration: 150 }}>
              <h4 class="text-[10px] font-semibold uppercase tracking-[0.3em] text-blue-600">
                Global Effects
              </h4>

              <!-- Background Color -->
              <div class="space-y-3">
                <label
                  for="studio-bg-color"
                  class="block text-[9px] font-semibold uppercase tracking-widest text-gray-400"
                  >Background</label
                >
                <div class="flex gap-3">
                  <input
                    id="studio-bg-color"
                    type="color"
                    value={$params.bgColor}
                    on:input={(e) => updateParams({ bgColor: e.currentTarget.value })}
                    class="w-12 h-12 rounded-xl border border-gray-200 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={$params.bgColor}
                    on:change={(e) => updateParams({ bgColor: e.currentTarget.value })}
                    class="flex-1 bg-gray-50 border border-gray-100 rounded-xl px-4 text-sm font-mono"
                  />
                </div>
              </div>

              <!-- Gradient Toggle -->
              <label
                class="flex items-center justify-between p-4 bg-gray-50 rounded-2xl cursor-pointer hover:bg-gray-100"
              >
                <span class="text-[9px] font-semibold uppercase tracking-widest"
                  >Use Gradient Stroke</span
                >
                <input
                  type="checkbox"
                  checked={$params.useGradient}
                  on:change={(e) => updateParams({ useGradient: e.currentTarget.checked })}
                  class="w-5 h-5 accent-blue-600"
                />
              </label>

              {#if $params.useGradient}
                <div
                  class="space-y-4 p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-2xl"
                  transition:slide
                >
                  <div class="flex gap-4">
                    <div class="flex-1 space-y-2">
                      <label
                        for="studio-gradient-start"
                        class="text-[8px] font-semibold uppercase text-gray-400">Start</label
                      >
                      <input
                        id="studio-gradient-start"
                        type="color"
                        value={$params.startColor}
                        on:input={(e) => updateParams({ startColor: e.currentTarget.value })}
                        class="w-full h-10 rounded-lg border border-gray-200 cursor-pointer"
                      />
                    </div>
                    <div class="flex-1 space-y-2">
                      <label
                        for="studio-gradient-end"
                        class="text-[8px] font-semibold uppercase text-gray-400">End</label
                      >
                      <input
                        id="studio-gradient-end"
                        type="color"
                        value={$params.endColor}
                        on:input={(e) => updateParams({ endColor: e.currentTarget.value })}
                        class="w-full h-10 rounded-lg border border-gray-200 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              {/if}

              <!-- Vignette -->
              <label
                class="flex items-center justify-between p-4 bg-gray-50 rounded-2xl cursor-pointer hover:bg-gray-100"
              >
                <span class="text-[9px] font-semibold uppercase tracking-widest">Vignette</span>
                <input
                  type="checkbox"
                  checked={$params.vignette}
                  on:change={(e) => updateParams({ vignette: e.currentTarget.checked })}
                  class="w-5 h-5 accent-blue-600"
                />
              </label>

              <!-- Glow -->
              <div class="space-y-3">
                <div class="flex justify-between items-center">
                  <span class="text-[9px] font-semibold uppercase tracking-widest text-gray-500"
                    >Glow Intensity</span
                  >
                  <span class="text-sm font-bold">{$params.glow}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="20"
                  step="0.5"
                  value={$params.glow}
                  on:input={(e) => updateParams({ glow: +e.currentTarget.value })}
                  class="w-full h-1.5 bg-gray-100 rounded-full appearance-none cursor-pointer accent-black"
                />
              </div>

              <!-- Reset Button -->
              <button
                on:click={() => {
                  resetParams();
                }}
                class="w-full py-4 bg-red-50 text-red-600 rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all mt-6"
              >
                Reset All to Default
              </button>
            </section>

            <!-- SECURITY TAB -->
          {:else if activeInspectorTab === 'security'}
            <section class="space-y-6" transition:fade={{ duration: 150 }}>
              <h4 class="text-[10px] font-semibold uppercase tracking-[0.3em] text-blue-600">
                Security Features
              </h4>

              <!-- Microtext -->
              <div class="p-5 bg-gray-50 border border-gray-100 rounded-[2rem] space-y-5">
                <label class="flex items-center justify-between cursor-pointer">
                  <span class="text-[10px] font-bold uppercase tracking-widest"
                    >Microtext on Path</span
                  >
                  <input
                    type="checkbox"
                    checked={$activeLayer.params.text?.active ?? false}
                    on:change={(e) =>
                      updateActiveLayerParam('text', {
                        ...($activeLayer.params.text || {
                          content: 'SECURITY',
                          fontSize: 3,
                          followPath: true,
                          repeat: true,
                        }),
                        active: e.currentTarget.checked,
                      })}
                    class="w-5 h-5 accent-blue-600"
                  />
                </label>

                {#if $activeLayer.params.text?.active}
                  {@const textDefaults = {
                    content: 'SECURITY',
                    fontSize: 3,
                    followPath: true,
                    repeat: true,
                    active: true,
                  }}
                  <div class="space-y-4 pt-4 border-t border-gray-200" transition:slide>
                    <input
                      type="text"
                      value={$activeLayer.params.text?.content || ''}
                      on:input={(e) =>
                        updateActiveLayerParam('text', {
                          ...textDefaults,
                          ...$activeLayer.params.text,
                          content: e.currentTarget.value,
                        })}
                      placeholder="SECURITY TEXT"
                      class="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-mono outline-none focus:ring-2 focus:ring-blue-100"
                    />

                    <div class="space-y-3">
                      <div class="flex justify-between items-center">
                        <span class="text-[9px] font-semibold uppercase text-gray-400"
                          >Font Size</span
                        >
                        <span class="text-sm font-bold"
                          >{$activeLayer.params.text?.fontSize || 3}pt</span
                        >
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="12"
                        step="0.5"
                        value={$activeLayer.params.text?.fontSize || 3}
                        on:input={(e) =>
                          updateActiveLayerParam('text', {
                            ...textDefaults,
                            ...$activeLayer.params.text,
                            fontSize: +e.currentTarget.value,
                          })}
                        class="w-full h-1.5 bg-gray-200 rounded-full appearance-none accent-black"
                      />
                    </div>

                    <label class="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={$activeLayer.params.text?.repeat ?? true}
                        on:change={(e) =>
                          updateActiveLayerParam('text', {
                            ...textDefaults,
                            ...$activeLayer.params.text,
                            repeat: e.currentTarget.checked,
                          })}
                        class="accent-blue-600"
                      />
                      <span class="text-[9px] font-semibold uppercase">Repeat Text</span>
                    </label>
                  </div>
                {/if}
              </div>

              <!-- Anti-Copy Info -->
              <div class="p-5 bg-blue-50 border border-blue-100 rounded-[2rem]">
                <h5 class="text-[10px] font-bold uppercase tracking-widest text-blue-600 mb-2">
                  Pro Tip
                </h5>
                <p class="text-[10px] text-blue-800 leading-relaxed">
                  Use high symmetry (8+) with fine line widths (0.3-0.5) for anti-copy protection.
                  Microtext should be 2-4pt for optimal security.
                </p>
              </div>
            </section>
          {/if}

          <!-- Path Tab (for baked paths) -->
          {#if $activeLayer.type === 'path' && activeInspectorTab === 'geometry'}
            <section class="space-y-6 mt-8 pt-8 border-t border-gray-100">
              <h4 class="text-[10px] font-semibold uppercase tracking-[0.3em] text-green-600">
                Manual Path Editing
              </h4>
              <p class="text-[10px] text-gray-400 leading-relaxed">
                This layer has been baked to an editable bezier path. Use the Direct Edit tool (A)
                to adjust anchor points and handles.
              </p>
              <div class="p-5 bg-green-50 rounded-2xl border border-green-100">
                <div class="flex justify-between items-center text-[10px] font-bold uppercase">
                  <span>Total Segments</span>
                  <span class="text-green-600"
                    >{$activeLayer.manualPath?.segments?.length || 0}</span
                  >
                </div>
              </div>
            </section>
          {/if}
        {/if}
      </div>
    </aside>
  </div>
</div>

<!-- Export Panel Modal -->
{#if showExportPanel}
  <div
    class="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm"
    role="presentation"
    on:click|self={() => (showExportPanel = false)}
    on:keydown|self={(e) => e.key === 'Escape' && (showExportPanel = false)}
    transition:fade={{ duration: 150 }}
  >
    <div
      class="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl overflow-hidden"
      transition:fly={{ y: 20, duration: 200 }}
    >
      <div class="p-10 space-y-8">
        <div class="flex justify-between items-start">
          <div>
            <h2 class="text-2xl font-bold text-gray-900 mb-2">Export Pattern</h2>
            <p class="text-sm text-gray-400">Choose format and size for your guilloche design.</p>
          </div>
          <button
            on:click={() => (showExportPanel = false)}
            class="text-2xl text-gray-300 hover:text-black">×</button
          >
        </div>

        <!-- Format Selection -->
        <div role="group" aria-labelledby="studio-export-format-label" class="space-y-3">
          <span
            id="studio-export-format-label"
            class="text-[9px] font-semibold uppercase tracking-widest text-gray-400">Format</span
          >
          <div class="grid grid-cols-3 gap-3">
            {#each exportFormats as fmt}
              <button
                on:click={() => (exportFormat = fmt.value)}
                class="p-4 rounded-2xl border-2 text-center transition-all {exportFormat ===
                fmt.value
                  ? 'border-black bg-black text-white'
                  : 'border-gray-100 hover:border-gray-300'}"
              >
                <div class="text-sm font-bold">{fmt.label}</div>
                <div class="text-[9px] opacity-60">{fmt.desc}</div>
              </button>
            {/each}
          </div>
        </div>

        <!-- Size Selection (for PNG) -->
        {#if exportFormat === 'png'}
          <div class="space-y-3">
            <label
              for="studio-export-size"
              class="text-[9px] font-semibold uppercase tracking-widest text-gray-400">Size</label
            >
            <select
              id="studio-export-size"
              bind:value={exportSize}
              class="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 text-sm font-medium outline-none"
            >
              {#each EXPORT_SIZES as size}<option value={size.value}>{size.label}</option>{/each}
            </select>
          </div>

          <label
            class="flex items-center justify-between p-4 bg-gray-50 rounded-2xl cursor-pointer"
          >
            <span class="text-[10px] font-semibold uppercase tracking-widest"
              >Transparent Background</span
            >
            <input
              type="checkbox"
              bind:checked={exportTransparent}
              class="w-5 h-5 accent-blue-600"
            />
          </label>
        {/if}

        {#if exportError}
          <p class="text-sm text-red-600">{exportError}</p>
        {/if}
        <!-- Export Button -->
        <button
          on:click={handleExport}
          disabled={exporting}
          class="w-full py-5 bg-black text-white rounded-2xl text-sm font-bold uppercase tracking-widest hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {exporting ? 'Exporting...' : `Export ${exportFormat.toUpperCase()}`}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Template Modal -->
{#if showTemplates}
  <TemplateModal on:close={() => (showTemplates = false)} />
{/if}

<!-- Import Modal -->
{#if showImport}
  <ImportModal on:close={() => (showImport = false)} />
{/if}

<style>
  :global(body) {
    background-color: #f5f5f7;
    overflow: hidden;
  }
  input[type='range']::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 16px;
    height: 16px;
    background: #000;
    border-radius: 50%;
    cursor: pointer;
    border: 2px solid #fff;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
  input[type='range']::-moz-range-thumb {
    width: 16px;
    height: 16px;
    background: #000;
    border-radius: 50%;
    cursor: pointer;
    border: 2px solid #fff;
  }
  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }
  .scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
</style>
