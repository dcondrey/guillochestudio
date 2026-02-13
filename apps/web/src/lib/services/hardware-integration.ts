/**
 * Hardware Integration API
 * Unified interface for connecting with plotters, CNC machines, laser cutters, and other hardware
 * Supports Web Serial API, WebUSB, and network connections
 */

import { writable, derived, type Readable, type Writable } from 'svelte/store';
import { browser } from '$app/environment';

// ============================================================================
// Types
// ============================================================================

export type HardwareType = 'plotter' | 'cnc' | 'laser' | 'engraver' | 'printer' | 'custom';

export type ConnectionType = 'serial' | 'usb' | 'network' | 'bluetooth';

export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'busy'
  | 'paused'
  | 'error';

export interface HardwareDevice {
  id: string;
  name: string;
  type: HardwareType;
  connectionType: ConnectionType;
  manufacturer?: string;
  model?: string;
  firmwareVersion?: string;
  capabilities: DeviceCapabilities;
  status: ConnectionStatus;
  lastConnected?: number;
  settings: DeviceSettings;
}

export interface DeviceCapabilities {
  maxWidth: number;
  maxHeight: number;
  maxSpeed: number;
  minSpeed: number;
  maxPower?: number; // For lasers
  toolCount?: number;
  supportsHoming: boolean;
  supportsPause: boolean;
  supportsCancel: boolean;
  supportsProgress: boolean;
  coordinateSystem: 'absolute' | 'relative' | 'both';
  units: 'mm' | 'inch' | 'both';
  protocols: string[];
}

export interface DeviceSettings {
  baudRate?: number;
  dataBits?: number;
  stopBits?: number;
  parity?: ParityType;
  flowControl?: FlowControlType;
  ipAddress?: string;
  port?: number;
  timeout?: number;
  homeOnConnect?: boolean;
  units?: 'mm' | 'inch';
}

export type ParityType = 'none' | 'even' | 'odd' | 'mark' | 'space';
export type FlowControlType = 'none' | 'hardware';

export interface HardwareJob {
  id: string;
  deviceId: string;
  status: JobStatus;
  progress: number;
  startTime?: number;
  endTime?: number;
  estimatedTime?: number;
  commands: string[];
  currentCommand: number;
  error?: string;
  statistics?: JobStatistics;
}

export type JobStatus =
  | 'pending'
  | 'preparing'
  | 'running'
  | 'paused'
  | 'completed'
  | 'cancelled'
  | 'error';

export interface JobStatistics {
  totalCommands: number;
  executedCommands: number;
  totalDistance: number;
  travelDistance: number;
  drawDistance: number;
  penChanges: number;
  elapsedTime: number;
}

export interface HardwareEvent {
  type: HardwareEventType;
  deviceId: string;
  timestamp: number;
  data?: unknown;
}

export type HardwareEventType =
  | 'connected'
  | 'disconnected'
  | 'status_change'
  | 'job_start'
  | 'job_progress'
  | 'job_complete'
  | 'job_error'
  | 'job_pause'
  | 'job_resume'
  | 'job_cancel'
  | 'message'
  | 'error';

export interface CommandResponse {
  success: boolean;
  response?: string;
  error?: string;
  duration?: number;
}

// ============================================================================
// Device Profiles
// ============================================================================

export const DEVICE_PROFILES: Record<string, Partial<HardwareDevice>> = {
  'axidraw-v3': {
    name: 'AxiDraw V3',
    type: 'plotter',
    manufacturer: 'Evil Mad Scientist',
    capabilities: {
      maxWidth: 218,
      maxHeight: 300,
      maxSpeed: 380,
      minSpeed: 10,
      toolCount: 1,
      supportsHoming: true,
      supportsPause: true,
      supportsCancel: true,
      supportsProgress: true,
      coordinateSystem: 'absolute',
      units: 'mm',
      protocols: ['EBB'],
    },
    settings: {
      baudRate: 9600,
    },
  },
  'hp7475a': {
    name: 'HP 7475A',
    type: 'plotter',
    manufacturer: 'Hewlett-Packard',
    capabilities: {
      maxWidth: 250,
      maxHeight: 180,
      maxSpeed: 381,
      minSpeed: 25,
      toolCount: 6,
      supportsHoming: true,
      supportsPause: true,
      supportsCancel: true,
      supportsProgress: false,
      coordinateSystem: 'absolute',
      units: 'mm',
      protocols: ['HPGL'],
    },
    settings: {
      baudRate: 9600,
      dataBits: 8,
      stopBits: 1,
      parity: 'none',
    },
  },
  'grbl-cnc': {
    name: 'GRBL CNC',
    type: 'cnc',
    capabilities: {
      maxWidth: 300,
      maxHeight: 200,
      maxSpeed: 5000,
      minSpeed: 100,
      supportsHoming: true,
      supportsPause: true,
      supportsCancel: true,
      supportsProgress: true,
      coordinateSystem: 'both',
      units: 'both',
      protocols: ['GRBL'],
    },
    settings: {
      baudRate: 115200,
    },
  },
  'k40-laser': {
    name: 'K40 Laser Cutter',
    type: 'laser',
    capabilities: {
      maxWidth: 300,
      maxHeight: 200,
      maxSpeed: 500,
      minSpeed: 10,
      maxPower: 40,
      supportsHoming: true,
      supportsPause: true,
      supportsCancel: true,
      supportsProgress: true,
      coordinateSystem: 'absolute',
      units: 'mm',
      protocols: ['GRBL', 'LaserGRBL'],
    },
    settings: {
      baudRate: 115200,
    },
  },
  'roland-dxy': {
    name: 'Roland DXY',
    type: 'plotter',
    manufacturer: 'Roland',
    capabilities: {
      maxWidth: 420,
      maxHeight: 297,
      maxSpeed: 420,
      minSpeed: 10,
      toolCount: 8,
      supportsHoming: true,
      supportsPause: true,
      supportsCancel: true,
      supportsProgress: false,
      coordinateSystem: 'absolute',
      units: 'mm',
      protocols: ['RD-GL'],
    },
    settings: {
      baudRate: 9600,
    },
  },
};

// ============================================================================
// Hardware Connection Manager
// ============================================================================

export class HardwareConnectionManager {
  private devices: Map<string, HardwareDevice> = new Map();
  private connections: Map<string, SerialPort | BluetoothDevice | WebSocket> = new Map();
  private readers: Map<string, ReadableStreamDefaultReader<Uint8Array>> = new Map();
  private writers: Map<string, WritableStreamDefaultWriter<Uint8Array>> = new Map();
  private jobs: Map<string, HardwareJob> = new Map();
  private eventListeners: Map<HardwareEventType, Set<(event: HardwareEvent) => void>> = new Map();
  private textDecoder = new TextDecoder();
  private textEncoder = new TextEncoder();

  // Stores
  private _devices: Writable<HardwareDevice[]>;
  private _activeJobs: Writable<HardwareJob[]>;

  public readonly devicesStore: Readable<HardwareDevice[]>;
  public readonly activeJobs: Readable<HardwareJob[]>;

  constructor() {
    this._devices = writable<HardwareDevice[]>([]);
    this._activeJobs = writable<HardwareJob[]>([]);

    this.devicesStore = this._devices;
    this.activeJobs = this._activeJobs;

    // Load saved devices
    this.loadSavedDevices();
  }

  /**
   * Check if Web Serial API is supported
   */
  isSerialSupported(): boolean {
    return browser && 'serial' in navigator;
  }

  /**
   * Check if WebUSB is supported
   */
  isUSBSupported(): boolean {
    return browser && 'usb' in navigator;
  }

  /**
   * Check if Web Bluetooth is supported
   */
  isBluetoothSupported(): boolean {
    return browser && 'bluetooth' in navigator;
  }

  /**
   * Request serial port access
   */
  async requestSerialPort(filters?: SerialPortFilter[]): Promise<SerialPort | null> {
    if (!this.isSerialSupported()) {
      throw new Error('Web Serial API is not supported in this browser');
    }

    try {
      const port = await navigator.serial.requestPort({ filters });
      return port;
    } catch (error) {
      if ((error as Error).name === 'NotFoundError') {
        return null; // User cancelled
      }
      throw error;
    }
  }

  /**
   * Connect to a serial device
   */
  async connectSerial(
    deviceId: string,
    profileId?: string,
    customSettings?: Partial<DeviceSettings>
  ): Promise<HardwareDevice> {
    const profile = profileId ? DEVICE_PROFILES[profileId] : undefined;
    const port = await this.requestSerialPort();

    if (!port) {
      throw new Error('No serial port selected');
    }

    // Create device
    const device: HardwareDevice = {
      id: deviceId,
      name: profile?.name || 'Unknown Device',
      type: profile?.type || 'custom',
      connectionType: 'serial',
      manufacturer: profile?.manufacturer,
      capabilities: profile?.capabilities || this.getDefaultCapabilities(),
      status: 'connecting',
      settings: { ...profile?.settings, ...customSettings },
    };

    this.devices.set(deviceId, device);
    this.updateDevicesStore();

    try {
      // Open port
      await port.open({
        baudRate: device.settings.baudRate || 9600,
        dataBits: (device.settings.dataBits || 8) as 7 | 8,
        stopBits: (device.settings.stopBits || 1) as 1 | 2,
        parity: device.settings.parity || 'none',
        flowControl: device.settings.flowControl || 'none',
      });

      // Setup reader/writer
      if (port.readable && port.writable) {
        const reader = port.readable.getReader();
        const writer = port.writable.getWriter();

        this.connections.set(deviceId, port);
        this.readers.set(deviceId, reader);
        this.writers.set(deviceId, writer);

        // Start reading
        this.startReading(deviceId, reader);
      }

      // Update status
      device.status = 'connected';
      device.lastConnected = Date.now();
      this.updateDevicesStore();
      this.saveDevices();

      this.emitEvent({
        type: 'connected',
        deviceId,
        timestamp: Date.now(),
      });

      // Home if configured
      if (device.settings.homeOnConnect && device.capabilities.supportsHoming) {
        await this.sendCommand(deviceId, 'G28'); // GRBL home command
      }

      return device;
    } catch (error) {
      device.status = 'error';
      this.updateDevicesStore();
      throw error;
    }
  }

  /**
   * Connect via network (WebSocket)
   */
  async connectNetwork(
    deviceId: string,
    ipAddress: string,
    port: number,
    profileId?: string
  ): Promise<HardwareDevice> {
    const profile = profileId ? DEVICE_PROFILES[profileId] : undefined;

    const device: HardwareDevice = {
      id: deviceId,
      name: profile?.name || 'Network Device',
      type: profile?.type || 'custom',
      connectionType: 'network',
      capabilities: profile?.capabilities || this.getDefaultCapabilities(),
      status: 'connecting',
      settings: {
        ...profile?.settings,
        ipAddress,
        port,
      },
    };

    this.devices.set(deviceId, device);
    this.updateDevicesStore();

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://${ipAddress}:${port}`);

      ws.onopen = () => {
        this.connections.set(deviceId, ws);
        device.status = 'connected';
        device.lastConnected = Date.now();
        this.updateDevicesStore();
        this.saveDevices();

        this.emitEvent({
          type: 'connected',
          deviceId,
          timestamp: Date.now(),
        });

        resolve(device);
      };

      ws.onmessage = (event) => {
        this.handleMessage(deviceId, event.data);
      };

      ws.onerror = () => {
        device.status = 'error';
        this.updateDevicesStore();
        reject(new Error('WebSocket connection failed'));
      };

      ws.onclose = () => {
        this.handleDisconnect(deviceId);
      };

      // Timeout
      setTimeout(() => {
        if (device.status === 'connecting') {
          ws.close();
          reject(new Error('Connection timeout'));
        }
      }, device.settings.timeout || 10000);
    });
  }

  /**
   * Disconnect from a device
   */
  async disconnect(deviceId: string): Promise<void> {
    const device = this.devices.get(deviceId);
    if (!device) return;

    // Cancel any running job
    const job = this.getActiveJob(deviceId);
    if (job) {
      await this.cancelJob(job.id);
    }

    // Close connection
    const connection = this.connections.get(deviceId);
    if (connection) {
      if (connection instanceof WebSocket) {
        connection.close();
      } else if ('close' in connection) {
        // Serial port
        const reader = this.readers.get(deviceId);
        const writer = this.writers.get(deviceId);

        try {
          await reader?.cancel();
          reader?.releaseLock();
        } catch { /* ignore */ }

        try {
          await writer?.close();
        } catch { /* ignore */ }

        try {
          await (connection as SerialPort).close();
        } catch { /* ignore */ }
      }
    }

    this.connections.delete(deviceId);
    this.readers.delete(deviceId);
    this.writers.delete(deviceId);

    device.status = 'disconnected';
    this.updateDevicesStore();

    this.emitEvent({
      type: 'disconnected',
      deviceId,
      timestamp: Date.now(),
    });
  }

  /**
   * Send a command to a device
   */
  async sendCommand(deviceId: string, command: string): Promise<CommandResponse> {
    const device = this.devices.get(deviceId);
    if (!device || device.status !== 'connected') {
      return { success: false, error: 'Device not connected' };
    }

    const startTime = performance.now();

    try {
      const connection = this.connections.get(deviceId);

      if (connection instanceof WebSocket) {
        connection.send(command + '\n');
      } else {
        const writer = this.writers.get(deviceId);
        if (!writer) {
          return { success: false, error: 'No writer available' };
        }

        const data = this.textEncoder.encode(command + '\n');
        await writer.write(data);
      }

      return {
        success: true,
        duration: performance.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        duration: performance.now() - startTime,
      };
    }
  }

  /**
   * Create and start a job
   */
  async createJob(deviceId: string, commands: string[]): Promise<HardwareJob> {
    const device = this.devices.get(deviceId);
    if (!device || device.status !== 'connected') {
      throw new Error('Device not connected');
    }

    const job: HardwareJob = {
      id: `job_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      deviceId,
      status: 'pending',
      progress: 0,
      commands,
      currentCommand: 0,
      statistics: {
        totalCommands: commands.length,
        executedCommands: 0,
        totalDistance: 0,
        travelDistance: 0,
        drawDistance: 0,
        penChanges: 0,
        elapsedTime: 0,
      },
    };

    this.jobs.set(job.id, job);
    this.updateJobsStore();

    return job;
  }

  /**
   * Start executing a job
   */
  async startJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error('Job not found');
    }

    const device = this.devices.get(job.deviceId);
    if (!device || device.status !== 'connected') {
      throw new Error('Device not connected');
    }

    job.status = 'preparing';
    job.startTime = Date.now();
    device.status = 'busy';
    this.updateDevicesStore();
    this.updateJobsStore();

    this.emitEvent({
      type: 'job_start',
      deviceId: job.deviceId,
      timestamp: Date.now(),
      data: { jobId },
    });

    // Estimate time
    job.estimatedTime = this.estimateJobTime(job.commands, device.capabilities.maxSpeed);

    job.status = 'running';
    this.updateJobsStore();

    // Execute commands
    await this.executeJobCommands(job);
  }

  /**
   * Execute job commands sequentially
   */
  private async executeJobCommands(job: HardwareJob): Promise<void> {
    const device = this.devices.get(job.deviceId);
    if (!device) return;

    for (let i = job.currentCommand; i < job.commands.length; i++) {
      // Check for pause/cancel
      if (job.status === 'paused') {
        return; // Will be resumed later
      }
      if (job.status === 'cancelled') {
        return;
      }

      const command = job.commands[i];
      const response = await this.sendCommand(job.deviceId, command);

      if (!response.success) {
        job.status = 'error';
        job.error = response.error;
        device.status = 'error';
        this.updateDevicesStore();
        this.updateJobsStore();

        this.emitEvent({
          type: 'job_error',
          deviceId: job.deviceId,
          timestamp: Date.now(),
          data: { jobId: job.id, error: response.error },
        });
        return;
      }

      job.currentCommand = i + 1;
      job.progress = ((i + 1) / job.commands.length) * 100;
      if (job.statistics) {
        job.statistics.executedCommands = i + 1;
        job.statistics.elapsedTime = Date.now() - (job.startTime || 0);
      }
      this.updateJobsStore();

      this.emitEvent({
        type: 'job_progress',
        deviceId: job.deviceId,
        timestamp: Date.now(),
        data: { jobId: job.id, progress: job.progress },
      });

      // Small delay between commands for stability
      await this.delay(10);
    }

    // Job completed
    job.status = 'completed';
    job.progress = 100;
    job.endTime = Date.now();
    device.status = 'connected';
    this.updateDevicesStore();
    this.updateJobsStore();

    this.emitEvent({
      type: 'job_complete',
      deviceId: job.deviceId,
      timestamp: Date.now(),
      data: { jobId: job.id },
    });
  }

  /**
   * Pause a running job
   */
  async pauseJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== 'running') return;

    job.status = 'paused';
    this.updateJobsStore();

    // Send pause command if supported
    const device = this.devices.get(job.deviceId);
    if (device?.capabilities.supportsPause) {
      await this.sendCommand(job.deviceId, '!'); // GRBL feed hold
    }

    this.emitEvent({
      type: 'job_pause',
      deviceId: job.deviceId,
      timestamp: Date.now(),
      data: { jobId },
    });
  }

  /**
   * Resume a paused job
   */
  async resumeJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== 'paused') return;

    job.status = 'running';
    this.updateJobsStore();

    // Send resume command if supported
    const device = this.devices.get(job.deviceId);
    if (device?.capabilities.supportsPause) {
      await this.sendCommand(job.deviceId, '~'); // GRBL cycle resume
    }

    this.emitEvent({
      type: 'job_resume',
      deviceId: job.deviceId,
      timestamp: Date.now(),
      data: { jobId },
    });

    // Continue execution
    await this.executeJobCommands(job);
  }

  /**
   * Cancel a job
   */
  async cancelJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.status = 'cancelled';
    job.endTime = Date.now();
    this.updateJobsStore();

    // Send cancel/reset command
    const device = this.devices.get(job.deviceId);
    if (device) {
      if (device.capabilities.supportsCancel) {
        await this.sendCommand(job.deviceId, '\x18'); // GRBL soft reset
      }
      device.status = 'connected';
      this.updateDevicesStore();
    }

    this.emitEvent({
      type: 'job_cancel',
      deviceId: job.deviceId,
      timestamp: Date.now(),
      data: { jobId },
    });
  }

  /**
   * Get active job for a device
   */
  getActiveJob(deviceId: string): HardwareJob | undefined {
    for (const job of this.jobs.values()) {
      if (job.deviceId === deviceId && ['running', 'paused'].includes(job.status)) {
        return job;
      }
    }
    return undefined;
  }

  /**
   * Home the device
   */
  async homeDevice(deviceId: string): Promise<boolean> {
    const device = this.devices.get(deviceId);
    if (!device || !device.capabilities.supportsHoming) {
      return false;
    }

    const response = await this.sendCommand(deviceId, 'G28');
    return response.success;
  }

  /**
   * Move to position
   */
  async moveTo(
    deviceId: string,
    x: number,
    y: number,
    speed?: number,
    rapid = false
  ): Promise<boolean> {
    const gcode = rapid
      ? `G0 X${x.toFixed(3)} Y${y.toFixed(3)}`
      : `G1 X${x.toFixed(3)} Y${y.toFixed(3)}${speed ? ` F${speed}` : ''}`;

    const response = await this.sendCommand(deviceId, gcode);
    return response.success;
  }

  /**
   * Register event listener
   */
  on(eventType: HardwareEventType, callback: (event: HardwareEvent) => void): () => void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, new Set());
    }
    this.eventListeners.get(eventType)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.eventListeners.get(eventType)?.delete(callback);
    };
  }

  /**
   * Emit event to listeners
   */
  private emitEvent(event: HardwareEvent): void {
    const listeners = this.eventListeners.get(event.type);
    if (listeners) {
      for (const callback of listeners) {
        try {
          callback(event);
        } catch (error) {
          console.error('Hardware event listener error:', error);
        }
      }
    }
  }

  /**
   * Start reading from serial port
   */
  private async startReading(
    deviceId: string,
    reader: ReadableStreamDefaultReader<Uint8Array>
  ): Promise<void> {
    let buffer = '';

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += this.textDecoder.decode(value, { stream: true });

        // Process complete lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            this.handleMessage(deviceId, line.trim());
          }
        }
      }
    } catch (error) {
      if ((error as Error).name !== 'CancelError') {
        this.handleDisconnect(deviceId);
      }
    }
  }

  /**
   * Handle incoming message
   */
  private handleMessage(deviceId: string, message: string): void {
    this.emitEvent({
      type: 'message',
      deviceId,
      timestamp: Date.now(),
      data: { message },
    });

    // Parse common responses
    if (message === 'ok') {
      // Command acknowledged
    } else if (message.startsWith('error:')) {
      this.emitEvent({
        type: 'error',
        deviceId,
        timestamp: Date.now(),
        data: { message },
      });
    }
  }

  /**
   * Handle device disconnect
   */
  private handleDisconnect(deviceId: string): void {
    const device = this.devices.get(deviceId);
    if (device) {
      device.status = 'disconnected';
      this.updateDevicesStore();
    }

    this.connections.delete(deviceId);
    this.readers.delete(deviceId);
    this.writers.delete(deviceId);

    this.emitEvent({
      type: 'disconnected',
      deviceId,
      timestamp: Date.now(),
    });
  }

  /**
   * Get default capabilities
   */
  private getDefaultCapabilities(): DeviceCapabilities {
    return {
      maxWidth: 200,
      maxHeight: 200,
      maxSpeed: 1000,
      minSpeed: 10,
      supportsHoming: false,
      supportsPause: false,
      supportsCancel: false,
      supportsProgress: false,
      coordinateSystem: 'absolute',
      units: 'mm',
      protocols: [],
    };
  }

  /**
   * Estimate job time based on commands
   */
  private estimateJobTime(commands: string[], maxSpeed: number): number {
    // Simple estimation based on command count and average speed
    const avgTimePerCommand = 50; // ms
    return commands.length * avgTimePerCommand;
  }

  /**
   * Update devices store
   */
  private updateDevicesStore(): void {
    this._devices.set(Array.from(this.devices.values()));
  }

  /**
   * Update jobs store
   */
  private updateJobsStore(): void {
    const activeJobs = Array.from(this.jobs.values())
      .filter((j) => !['completed', 'cancelled', 'error'].includes(j.status));
    this._activeJobs.set(activeJobs);
  }

  /**
   * Save devices to storage
   */
  private saveDevices(): void {
    if (!browser) return;

    const deviceData = Array.from(this.devices.values()).map((d) => ({
      id: d.id,
      name: d.name,
      type: d.type,
      connectionType: d.connectionType,
      manufacturer: d.manufacturer,
      capabilities: d.capabilities,
      settings: d.settings,
      lastConnected: d.lastConnected,
    }));

    localStorage.setItem('guilloche_hardware_devices', JSON.stringify(deviceData));
  }

  /**
   * Load saved devices
   */
  private loadSavedDevices(): void {
    if (!browser) return;

    try {
      const saved = localStorage.getItem('guilloche_hardware_devices');
      if (saved) {
        const deviceData = JSON.parse(saved);
        for (const data of deviceData) {
          const device: HardwareDevice = {
            ...data,
            status: 'disconnected',
          };
          this.devices.set(device.id, device);
        }
        this.updateDevicesStore();
      }
    } catch (error) {
      console.warn('Failed to load saved devices:', error);
    }
  }

  /**
   * Remove a device
   */
  removeDevice(deviceId: string): void {
    this.disconnect(deviceId);
    this.devices.delete(deviceId);
    this.updateDevicesStore();
    this.saveDevices();
  }

  /**
   * Get device by ID
   */
  getDevice(deviceId: string): HardwareDevice | undefined {
    return this.devices.get(deviceId);
  }

  /**
   * Get all devices
   */
  getAllDevices(): HardwareDevice[] {
    return Array.from(this.devices.values());
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Dispose manager
   */
  async dispose(): Promise<void> {
    for (const deviceId of this.devices.keys()) {
      await this.disconnect(deviceId);
    }
    this.devices.clear();
    this.jobs.clear();
    this.eventListeners.clear();
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let instance: HardwareConnectionManager | null = null;

export function getHardwareManager(): HardwareConnectionManager {
  if (!instance) {
    instance = new HardwareConnectionManager();
  }
  return instance;
}
