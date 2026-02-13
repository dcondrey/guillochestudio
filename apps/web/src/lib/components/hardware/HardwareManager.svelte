<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import {
    getHardwareManager,
    DEVICE_PROFILES,
    type HardwareDevice,
    type HardwareJob,
    type ConnectionStatus,
  } from '$lib/services/hardware-integration';

  // Props
  export let compact = false;

  // State
  let devices: HardwareDevice[] = [];
  let activeJobs: HardwareJob[] = [];
  let selectedDeviceId: string | null = null;
  let showAddDevice = false;
  let newDeviceProfile = '';
  let newDeviceName = '';
  let isConnecting = false;
  let connectionError: string | null = null;
  let unsubscribeDevices: (() => void) | null = null;
  let unsubscribeJobs: (() => void) | null = null;

  const dispatch = createEventDispatcher<{
    deviceConnected: HardwareDevice;
    deviceDisconnected: string;
    jobComplete: HardwareJob;
  }>();

  const manager = getHardwareManager();

  onMount(() => {
    unsubscribeDevices = manager.devicesStore.subscribe((d) => {
      devices = d;
    });

    unsubscribeJobs = manager.activeJobs.subscribe((j) => {
      activeJobs = j;
    });

    // Listen for events
    manager.on('connected', (event) => {
      const device = manager.getDevice(event.deviceId);
      if (device) dispatch('deviceConnected', device);
    });

    manager.on('disconnected', (event) => {
      dispatch('deviceDisconnected', event.deviceId);
    });

    manager.on('job_complete', (event) => {
      // Job is in event.data
    });
  });

  onDestroy(() => {
    unsubscribeDevices?.();
    unsubscribeJobs?.();
  });

  async function connectDevice() {
    if (!newDeviceProfile) return;

    isConnecting = true;
    connectionError = null;

    try {
      const deviceId = `device_${Date.now()}`;
      const device = await manager.connectSerial(
        deviceId,
        newDeviceProfile,
        {}
      );

      if (newDeviceName) {
        device.name = newDeviceName;
      }

      selectedDeviceId = deviceId;
      showAddDevice = false;
      newDeviceProfile = '';
      newDeviceName = '';
    } catch (error) {
      connectionError = (error as Error).message;
    } finally {
      isConnecting = false;
    }
  }

  async function disconnectDevice(deviceId: string) {
    await manager.disconnect(deviceId);
    if (selectedDeviceId === deviceId) {
      selectedDeviceId = null;
    }
  }

  function removeDevice(deviceId: string) {
    manager.removeDevice(deviceId);
    if (selectedDeviceId === deviceId) {
      selectedDeviceId = null;
    }
  }

  function getStatusColor(status: ConnectionStatus): string {
    switch (status) {
      case 'connected': return '#22c55e';
      case 'connecting': return '#f59e0b';
      case 'busy': return '#3b82f6';
      case 'paused': return '#a855f7';
      case 'error': return '#ef4444';
      default: return '#94a3b8';
    }
  }

  function getStatusIcon(status: ConnectionStatus): string {
    switch (status) {
      case 'connected': return '✓';
      case 'connecting': return '◌';
      case 'busy': return '⏳';
      case 'paused': return '⏸';
      case 'error': return '!';
      default: return '○';
    }
  }

  function getDeviceIcon(type: HardwareDevice['type']): string {
    switch (type) {
      case 'plotter': return '🖊';
      case 'cnc': return '⚙';
      case 'laser': return '🔴';
      case 'engraver': return '✒';
      case 'printer': return '🖨';
      default: return '📟';
    }
  }

  function formatTime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  }

  $: selectedDevice = devices.find((d) => d.id === selectedDeviceId);
  $: selectedDeviceJob = activeJobs.find((j) => j.deviceId === selectedDeviceId);
  $: isSerialSupported = manager.isSerialSupported();
</script>

<div class="hardware-manager" class:compact>
  <div class="manager-header">
    <h3>Hardware Devices</h3>
    <button
      class="add-btn"
      on:click={() => (showAddDevice = !showAddDevice)}
      disabled={!isSerialSupported}
      title={isSerialSupported ? 'Add device' : 'Web Serial API not supported'}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 5v14M5 12h14" />
      </svg>
    </button>
  </div>

  {#if !isSerialSupported}
    <div class="warning-banner">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      <span>Hardware connection requires Chrome or Edge browser</span>
    </div>
  {/if}

  {#if showAddDevice}
    <div class="add-device-panel">
      <h4>Connect New Device</h4>

      <div class="form-group">
        <label for="deviceProfile">Device Type</label>
        <select id="deviceProfile" bind:value={newDeviceProfile}>
          <option value="">Select a device...</option>
          {#each Object.entries(DEVICE_PROFILES) as [id, profile]}
            <option value={id}>{profile.name} ({profile.type})</option>
          {/each}
          <option value="custom">Custom Device</option>
        </select>
      </div>

      <div class="form-group">
        <label for="deviceName">Custom Name (optional)</label>
        <input
          id="deviceName"
          type="text"
          bind:value={newDeviceName}
          placeholder="My Plotter"
        />
      </div>

      {#if connectionError}
        <div class="error-message">{connectionError}</div>
      {/if}

      <div class="form-actions">
        <button class="btn secondary" on:click={() => (showAddDevice = false)}>
          Cancel
        </button>
        <button
          class="btn primary"
          on:click={connectDevice}
          disabled={!newDeviceProfile || isConnecting}
        >
          {isConnecting ? 'Connecting...' : 'Connect'}
        </button>
      </div>
    </div>
  {/if}

  <!-- Device List -->
  <div class="device-list">
    {#if devices.length === 0}
      <div class="empty-state">
        <span class="empty-icon">📟</span>
        <p>No devices configured</p>
        <p class="empty-hint">Click + to connect a device</p>
      </div>
    {:else}
      {#each devices as device (device.id)}
        <div
          class="device-card"
          class:selected={selectedDeviceId === device.id}
          class:connected={device.status === 'connected'}
          class:busy={device.status === 'busy'}
          role="button"
          tabindex="0"
          on:click={() => (selectedDeviceId = device.id)}
          on:keydown={(e) => e.key === 'Enter' && (selectedDeviceId = device.id)}
        >
          <div class="device-icon">{getDeviceIcon(device.type)}</div>

          <div class="device-info">
            <div class="device-name">{device.name}</div>
            <div class="device-meta">
              {device.manufacturer || device.type}
              {#if device.model}• {device.model}{/if}
            </div>
          </div>

          <div
            class="device-status"
            style="--status-color: {getStatusColor(device.status)}"
          >
            <span class="status-icon">{getStatusIcon(device.status)}</span>
            <span class="status-text">{device.status}</span>
          </div>

          <div class="device-actions">
            {#if device.status === 'connected' || device.status === 'busy'}
              <button
                class="action-btn"
                on:click|stopPropagation={() => disconnectDevice(device.id)}
                title="Disconnect"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18.36 6.64A9 9 0 015.64 18.36M19.36 19.36A9 9 0 016.64 5.64" />
                </svg>
              </button>
            {:else}
              <button
                class="action-btn"
                on:click|stopPropagation={() => removeDevice(device.id)}
                title="Remove"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                </svg>
              </button>
            {/if}
          </div>
        </div>
      {/each}
    {/if}
  </div>

  <!-- Selected Device Details -->
  {#if selectedDevice && !compact}
    <div class="device-details">
      <h4>Device Details</h4>

      <div class="details-grid">
        <div class="detail-item">
          <span class="detail-label">Work Area</span>
          <span class="detail-value">
            {selectedDevice.capabilities.maxWidth} × {selectedDevice.capabilities.maxHeight} mm
          </span>
        </div>

        <div class="detail-item">
          <span class="detail-label">Speed Range</span>
          <span class="detail-value">
            {selectedDevice.capabilities.minSpeed} - {selectedDevice.capabilities.maxSpeed} mm/s
          </span>
        </div>

        {#if selectedDevice.capabilities.toolCount}
          <div class="detail-item">
            <span class="detail-label">Tools</span>
            <span class="detail-value">{selectedDevice.capabilities.toolCount}</span>
          </div>
        {/if}

        {#if selectedDevice.capabilities.maxPower}
          <div class="detail-item">
            <span class="detail-label">Max Power</span>
            <span class="detail-value">{selectedDevice.capabilities.maxPower}W</span>
          </div>
        {/if}

        <div class="detail-item">
          <span class="detail-label">Protocols</span>
          <span class="detail-value">{selectedDevice.capabilities.protocols.join(', ')}</span>
        </div>
      </div>

      <!-- Capabilities -->
      <div class="capabilities">
        <span class="capability" class:supported={selectedDevice.capabilities.supportsHoming}>
          Homing
        </span>
        <span class="capability" class:supported={selectedDevice.capabilities.supportsPause}>
          Pause
        </span>
        <span class="capability" class:supported={selectedDevice.capabilities.supportsCancel}>
          Cancel
        </span>
        <span class="capability" class:supported={selectedDevice.capabilities.supportsProgress}>
          Progress
        </span>
      </div>

      <!-- Active Job -->
      {#if selectedDeviceJob}
        <div class="active-job">
          <h5>Active Job</h5>
          <div class="job-progress">
            <div class="progress-bar">
              <div class="progress-fill" style="width: {selectedDeviceJob.progress}%" />
            </div>
            <span class="progress-text">{Math.round(selectedDeviceJob.progress)}%</span>
          </div>
          <div class="job-stats">
            <span>
              {selectedDeviceJob.currentCommand} / {selectedDeviceJob.commands.length} commands
            </span>
            {#if selectedDeviceJob.statistics}
              <span>
                {formatTime(selectedDeviceJob.statistics.elapsedTime)} elapsed
              </span>
            {/if}
          </div>
          <div class="job-actions">
            {#if selectedDeviceJob.status === 'running'}
              <button
                class="btn small"
                on:click={() => manager.pauseJob(selectedDeviceJob.id)}
              >
                Pause
              </button>
            {:else if selectedDeviceJob.status === 'paused'}
              <button
                class="btn small primary"
                on:click={() => manager.resumeJob(selectedDeviceJob.id)}
              >
                Resume
              </button>
            {/if}
            <button
              class="btn small danger"
              on:click={() => manager.cancelJob(selectedDeviceJob.id)}
            >
              Cancel
            </button>
          </div>
        </div>
      {/if}

      <!-- Quick Actions -->
      {#if selectedDevice.status === 'connected' && !selectedDeviceJob}
        <div class="quick-actions">
          <button
            class="quick-btn"
            on:click={() => manager.homeDevice(selectedDevice.id)}
            disabled={!selectedDevice.capabilities.supportsHoming}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            </svg>
            Home
          </button>
          <button
            class="quick-btn"
            on:click={() => manager.moveTo(selectedDevice.id, 0, 0, undefined, true)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            Origin
          </button>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .hardware-manager {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    background: var(--panel-bg, #f8fafc);
    border-radius: 8px;
    border: 1px solid var(--border-color, #e2e8f0);
  }

  .hardware-manager.compact {
    padding: 12px;
  }

  .manager-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .manager-header h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: #1e293b;
  }

  .add-btn {
    padding: 6px;
    background: #4f46e5;
    border: none;
    border-radius: 6px;
    color: white;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .add-btn:hover:not(:disabled) {
    background: #4338ca;
  }

  .add-btn:disabled {
    background: #94a3b8;
    cursor: not-allowed;
  }

  .warning-banner {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    background: #fef3c7;
    border: 1px solid #fcd34d;
    border-radius: 6px;
    font-size: 12px;
    color: #92400e;
  }

  .add-device-panel {
    padding: 16px;
    background: white;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
  }

  .add-device-panel h4 {
    margin: 0 0 12px 0;
    font-size: 13px;
    font-weight: 600;
  }

  .form-group {
    margin-bottom: 12px;
  }

  .form-group label {
    display: block;
    margin-bottom: 4px;
    font-size: 11px;
    font-weight: 500;
    color: #64748b;
  }

  .form-group select,
  .form-group input {
    width: 100%;
    padding: 8px 10px;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 13px;
  }

  .form-group select:focus,
  .form-group input:focus {
    outline: none;
    border-color: #4f46e5;
  }

  .error-message {
    padding: 8px 10px;
    background: #fee2e2;
    border-radius: 4px;
    font-size: 12px;
    color: #dc2626;
    margin-bottom: 12px;
  }

  .form-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }

  .btn {
    padding: 8px 16px;
    border: none;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn.primary {
    background: #4f46e5;
    color: white;
  }

  .btn.primary:hover:not(:disabled) {
    background: #4338ca;
  }

  .btn.secondary {
    background: #f1f5f9;
    color: #475569;
  }

  .btn.secondary:hover {
    background: #e2e8f0;
  }

  .btn.danger {
    background: #fee2e2;
    color: #dc2626;
  }

  .btn.danger:hover {
    background: #fecaca;
  }

  .btn.small {
    padding: 4px 10px;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .device-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .empty-state {
    text-align: center;
    padding: 24px;
    color: #94a3b8;
  }

  .empty-icon {
    font-size: 32px;
    display: block;
    margin-bottom: 8px;
  }

  .empty-state p {
    margin: 0;
    font-size: 13px;
  }

  .empty-hint {
    font-size: 11px !important;
    margin-top: 4px !important;
  }

  .device-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    background: white;
    border-radius: 8px;
    border: 2px solid #e2e8f0;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .device-card:hover {
    border-color: #cbd5e1;
  }

  .device-card.selected {
    border-color: #4f46e5;
    background: #fafafe;
  }

  .device-card.connected {
    border-left-color: #22c55e;
  }

  .device-card.busy {
    border-left-color: #3b82f6;
  }

  .device-icon {
    font-size: 24px;
    flex-shrink: 0;
  }

  .device-info {
    flex: 1;
    min-width: 0;
  }

  .device-name {
    font-size: 13px;
    font-weight: 500;
    color: #1e293b;
  }

  .device-meta {
    font-size: 11px;
    color: #64748b;
  }

  .device-status {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    background: #f8fafc;
    border-radius: 12px;
    font-size: 10px;
    color: var(--status-color);
  }

  .status-icon {
    font-size: 10px;
  }

  .status-text {
    text-transform: capitalize;
  }

  .device-actions {
    display: flex;
    gap: 4px;
  }

  .action-btn {
    padding: 6px;
    background: none;
    border: 1px solid #e2e8f0;
    border-radius: 4px;
    color: #64748b;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .action-btn:hover {
    background: #f1f5f9;
    color: #475569;
  }

  .device-details {
    padding: 16px;
    background: white;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
  }

  .device-details h4 {
    margin: 0 0 12px 0;
    font-size: 13px;
    font-weight: 600;
  }

  .details-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
    margin-bottom: 16px;
  }

  .detail-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .detail-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #94a3b8;
  }

  .detail-value {
    font-size: 12px;
    font-weight: 500;
    color: #1e293b;
  }

  .capabilities {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 16px;
  }

  .capability {
    padding: 4px 8px;
    background: #fee2e2;
    border-radius: 4px;
    font-size: 10px;
    color: #dc2626;
  }

  .capability.supported {
    background: #dcfce7;
    color: #166534;
  }

  .active-job {
    padding: 12px;
    background: #f8fafc;
    border-radius: 6px;
    margin-bottom: 12px;
  }

  .active-job h5 {
    margin: 0 0 8px 0;
    font-size: 11px;
    font-weight: 600;
    color: #64748b;
  }

  .job-progress {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  .progress-bar {
    flex: 1;
    height: 6px;
    background: #e2e8f0;
    border-radius: 3px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: #4f46e5;
    border-radius: 3px;
    transition: width 0.3s ease;
  }

  .progress-text {
    font-size: 12px;
    font-weight: 600;
    color: #1e293b;
    min-width: 40px;
    text-align: right;
  }

  .job-stats {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: #64748b;
    margin-bottom: 8px;
  }

  .job-actions {
    display: flex;
    gap: 8px;
  }

  .quick-actions {
    display: flex;
    gap: 8px;
  }

  .quick-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 10px;
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 12px;
    color: #475569;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .quick-btn:hover:not(:disabled) {
    background: #e2e8f0;
    color: #1e293b;
  }

  .quick-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .compact .device-card {
    padding: 8px 10px;
  }

  .compact .device-icon {
    font-size: 18px;
  }

  .compact .device-name {
    font-size: 12px;
  }
</style>
