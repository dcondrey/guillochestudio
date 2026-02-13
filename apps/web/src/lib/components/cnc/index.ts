/**
 * CNC Components
 * Export all CNC-related components
 */

export { default as CNCExportPanel } from './CNCExportPanel.svelte';

// Re-export types and service
export {
  MACHINE_PROFILES,
  LASER_MATERIAL_PRESETS,
  CNC_TOOLS,
  generateCNCGCode,
  generateLaserGCode,
  generateDXF,
  estimateJobTime,
  downloadGCode,
  downloadDXF,
  type MachineProfile,
  type CNCSettings,
  type LaserSettings,
  type DXFOptions,
} from '$lib/services/cnc';
