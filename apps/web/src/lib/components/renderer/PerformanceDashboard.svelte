<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import {
    getPerformanceMonitor,
    type PerformanceReport,
    type RenderMetrics,
  } from '$lib/services/performance-monitor';

  // Props
  export let showExport = true;
  export let maxHistoryItems = 20;

  // State
  let report: PerformanceReport | null = null;
  let history: RenderMetrics[] = [];
  let selectedTab: 'overview' | 'history' | 'chart' = 'overview';
  let unsubscribe: (() => void) | null = null;

  const monitor = getPerformanceMonitor();

  onMount(() => {
    // Subscribe to history changes
    unsubscribe = monitor.history.subscribe((h) => {
      history = h.slice(-maxHistoryItems);
      report = monitor.generateReport();
    });

    // Initial report
    report = monitor.generateReport();
  });

  onDestroy(() => {
    unsubscribe?.();
  });

  function exportJSON() {
    const json = monitor.exportJSON();
    downloadFile(json, 'performance-report.json', 'application/json');
  }

  function exportCSV() {
    const csv = monitor.exportCSV();
    downloadFile(csv, 'render-history.csv', 'text/csv');
  }

  function downloadFile(content: string, filename: string, type: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function clearHistory() {
    monitor.clear();
    history = [];
    report = monitor.generateReport();
  }

  function formatTime(ms: number): string {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  }

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }

  // Calculate bar width for history chart
  function getBarWidth(duration: number, maxDuration: number): number {
    return Math.max(5, (duration / maxDuration) * 100);
  }
</script>

<div class="performance-dashboard">
  <div class="dashboard-header">
    <h3>Performance Monitor</h3>
    <div class="header-actions">
      {#if showExport}
        <button class="action-btn" on:click={exportJSON} title="Export as JSON">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
          </svg>
          JSON
        </button>
        <button class="action-btn" on:click={exportCSV} title="Export as CSV">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
          </svg>
          CSV
        </button>
      {/if}
      <button class="action-btn danger" on:click={clearHistory} title="Clear history">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
        </svg>
      </button>
    </div>
  </div>

  <!-- Tabs -->
  <div class="tabs">
    <button
      class="tab"
      class:active={selectedTab === 'overview'}
      on:click={() => (selectedTab = 'overview')}
    >
      Overview
    </button>
    <button
      class="tab"
      class:active={selectedTab === 'history'}
      on:click={() => (selectedTab = 'history')}
    >
      History ({history.length})
    </button>
    <button
      class="tab"
      class:active={selectedTab === 'chart'}
      on:click={() => (selectedTab = 'chart')}
    >
      Chart
    </button>
  </div>

  <!-- Tab Content -->
  <div class="tab-content">
    {#if selectedTab === 'overview' && report}
      <div class="overview-grid">
        <div class="metric-card">
          <div class="metric-label">Total Renders</div>
          <div class="metric-value">{report.totalRenders}</div>
          <div class="metric-sub">
            <span class="success">{report.successfulRenders} success</span>
            {#if report.failedRenders > 0}
              <span class="failure">{report.failedRenders} failed</span>
            {/if}
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-label">Avg Render Time</div>
          <div class="metric-value">{formatTime(report.averageRenderTime)}</div>
          <div class="metric-sub">
            P50: {formatTime(report.medianRenderTime)}
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-label">P95 / P99</div>
          <div class="metric-value">{formatTime(report.p95RenderTime)}</div>
          <div class="metric-sub">
            P99: {formatTime(report.p99RenderTime)}
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-label">Avg FPS</div>
          <div class="metric-value">{report.averageFps.toFixed(0)}</div>
          <div class="metric-sub">
            {report.totalPointsRendered.toLocaleString()} total points
          </div>
        </div>

        <div class="metric-card wide">
          <div class="metric-label">Engine Usage</div>
          <div class="engine-bars">
            <div class="engine-bar wasm" style="width: {report.wasmUsagePercent}%">
              WASM {report.wasmUsagePercent.toFixed(0)}%
            </div>
            <div class="engine-bar js" style="width: {report.jsUsagePercent}%">
              JS {report.jsUsagePercent.toFixed(0)}%
            </div>
          </div>
        </div>

        {#if report.memoryStats}
          <div class="metric-card">
            <div class="metric-label">Memory</div>
            <div class="metric-value">{formatBytes(report.memoryStats.averageUsed)}</div>
            <div class="metric-sub">
              Peak: {formatBytes(report.memoryStats.peakUsed)}
            </div>
          </div>
        {/if}

        {#if Object.keys(report.qualityBreakdown).length > 0}
          <div class="metric-card wide">
            <div class="metric-label">Quality Distribution</div>
            <div class="quality-grid">
              {#each Object.entries(report.qualityBreakdown) as [quality, count]}
                <div class="quality-item">
                  <span class="quality-name">{quality}</span>
                  <span class="quality-count">{count}</span>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    {:else if selectedTab === 'history'}
      <div class="history-list">
        {#if history.length === 0}
          <div class="empty-state">No render history yet</div>
        {:else}
          {#each [...history].reverse() as render}
            <div class="history-item" class:success={render.success} class:failure={!render.success}>
              <div class="history-header">
                <span class="history-engine" class:wasm={render.engineType === 'wasm'}>
                  {render.engineType.toUpperCase()}
                </span>
                <span class="history-quality">{render.quality}</span>
                <span class="history-time">{formatTime(render.duration)}</span>
              </div>
              <div class="history-details">
                <span>{render.pointCount.toLocaleString()} points</span>
                <span>{render.averageFps} FPS avg</span>
                <span>{render.pointsPerSecond.toLocaleString()} pts/s</span>
              </div>
              {#if render.error}
                <div class="history-error">{render.error}</div>
              {/if}
            </div>
          {/each}
        {/if}
      </div>
    {:else if selectedTab === 'chart'}
      <div class="chart-container">
        {#if history.length === 0}
          <div class="empty-state">No render history yet</div>
        {:else}
          {@const maxDuration = Math.max(...history.map((r) => r.duration), 1)}
          <div class="chart-bars">
            {#each history as render, i}
              <div
                class="chart-bar-container"
                title="{render.engineType.toUpperCase()} - {render.quality}: {formatTime(render.duration)}"
              >
                <div
                  class="chart-bar"
                  class:wasm={render.engineType === 'wasm'}
                  class:js={render.engineType === 'js'}
                  class:failure={!render.success}
                  style="height: {getBarWidth(render.duration, maxDuration)}%"
                />
                <span class="chart-label">{i + 1}</span>
              </div>
            {/each}
          </div>
          <div class="chart-legend">
            <div class="legend-item">
              <span class="legend-color wasm" />
              WASM
            </div>
            <div class="legend-item">
              <span class="legend-color js" />
              JavaScript
            </div>
            <div class="legend-item">
              <span class="legend-color failure" />
              Failed
            </div>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .performance-dashboard {
    background: var(--panel-bg, #f8fafc);
    border-radius: 8px;
    border: 1px solid var(--border-color, #e2e8f0);
    overflow: hidden;
  }

  .dashboard-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-color, #e2e8f0);
    background: white;
  }

  .dashboard-header h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: #1e293b;
  }

  .header-actions {
    display: flex;
    gap: 8px;
  }

  .action-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
    border-radius: 4px;
    font-size: 11px;
    color: #64748b;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .action-btn:hover {
    background: #e2e8f0;
    color: #475569;
  }

  .action-btn.danger:hover {
    background: #fee2e2;
    border-color: #fecaca;
    color: #dc2626;
  }

  .tabs {
    display: flex;
    border-bottom: 1px solid var(--border-color, #e2e8f0);
    background: white;
  }

  .tab {
    flex: 1;
    padding: 10px 16px;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    font-size: 12px;
    font-weight: 500;
    color: #64748b;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .tab:hover {
    color: #475569;
    background: #f8fafc;
  }

  .tab.active {
    color: #4f46e5;
    border-bottom-color: #4f46e5;
  }

  .tab-content {
    padding: 16px;
    max-height: 400px;
    overflow-y: auto;
  }

  .overview-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 12px;
  }

  .metric-card {
    background: white;
    border-radius: 6px;
    padding: 12px;
    border: 1px solid #e2e8f0;
  }

  .metric-card.wide {
    grid-column: span 2;
  }

  .metric-label {
    font-size: 10px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #64748b;
    margin-bottom: 4px;
  }

  .metric-value {
    font-size: 20px;
    font-weight: 600;
    color: #1e293b;
    font-family: monospace;
  }

  .metric-sub {
    font-size: 11px;
    color: #94a3b8;
    margin-top: 4px;
  }

  .metric-sub .success {
    color: #22c55e;
  }

  .metric-sub .failure {
    color: #ef4444;
    margin-left: 8px;
  }

  .engine-bars {
    display: flex;
    height: 24px;
    border-radius: 4px;
    overflow: hidden;
    background: #f1f5f9;
  }

  .engine-bar {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: 500;
    color: white;
    min-width: 40px;
  }

  .engine-bar.wasm {
    background: #22c55e;
  }

  .engine-bar.js {
    background: #f59e0b;
  }

  .quality-grid {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-top: 8px;
  }

  .quality-item {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    background: #f1f5f9;
    border-radius: 4px;
    font-size: 11px;
  }

  .quality-name {
    color: #64748b;
  }

  .quality-count {
    font-weight: 600;
    color: #1e293b;
  }

  .history-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .empty-state {
    text-align: center;
    padding: 32px;
    color: #94a3b8;
    font-size: 13px;
  }

  .history-item {
    background: white;
    border-radius: 6px;
    padding: 10px 12px;
    border: 1px solid #e2e8f0;
    border-left-width: 3px;
  }

  .history-item.success {
    border-left-color: #22c55e;
  }

  .history-item.failure {
    border-left-color: #ef4444;
    background: #fef2f2;
  }

  .history-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
  }

  .history-engine {
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 9px;
    font-weight: 600;
    background: #fef3c7;
    color: #92400e;
  }

  .history-engine.wasm {
    background: #dcfce7;
    color: #166534;
  }

  .history-quality {
    font-size: 11px;
    font-weight: 500;
    color: #475569;
  }

  .history-time {
    margin-left: auto;
    font-size: 12px;
    font-weight: 600;
    font-family: monospace;
    color: #1e293b;
  }

  .history-details {
    display: flex;
    gap: 12px;
    font-size: 11px;
    color: #64748b;
  }

  .history-error {
    margin-top: 6px;
    padding: 6px 8px;
    background: #fee2e2;
    border-radius: 4px;
    font-size: 11px;
    color: #dc2626;
  }

  .chart-container {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .chart-bars {
    display: flex;
    align-items: flex-end;
    gap: 4px;
    height: 150px;
    padding: 8px 0;
  }

  .chart-bar-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    height: 100%;
  }

  .chart-bar {
    width: 100%;
    min-height: 4px;
    border-radius: 2px 2px 0 0;
    margin-top: auto;
    transition: height 0.3s ease;
  }

  .chart-bar.wasm {
    background: #22c55e;
  }

  .chart-bar.js {
    background: #f59e0b;
  }

  .chart-bar.failure {
    background: #ef4444;
  }

  .chart-label {
    font-size: 9px;
    color: #94a3b8;
    margin-top: 4px;
  }

  .chart-legend {
    display: flex;
    justify-content: center;
    gap: 16px;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: #64748b;
  }

  .legend-color {
    width: 12px;
    height: 12px;
    border-radius: 2px;
  }

  .legend-color.wasm {
    background: #22c55e;
  }

  .legend-color.js {
    background: #f59e0b;
  }

  .legend-color.failure {
    background: #ef4444;
  }
</style>
