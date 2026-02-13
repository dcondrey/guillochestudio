/**
 * Hardware Integration Components
 * Export all hardware-related components
 */

export { default as HardwareManager } from './HardwareManager.svelte';

// Re-export types and service
export {
  getHardwareManager,
  HardwareConnectionManager,
  DEVICE_PROFILES,
  type HardwareDevice,
  type HardwareJob,
  type HardwareEvent,
  type HardwareEventType,
  type DeviceCapabilities,
  type DeviceSettings,
  type ConnectionType,
  type ConnectionStatus,
  type HardwareType,
  type JobStatus,
  type JobStatistics,
} from '$lib/services/hardware-integration';
