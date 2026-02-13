/**
 * Components Index
 * Export all components from their respective directories
 *
 * Note: Some service modules have overlapping exports (e.g., hexToRgb in both
 * print and accessibility). To avoid conflicts, import those directly from
 * the specific component directory or service file.
 */

// UI Components
export * from './ui';

// Lazy-loaded Components (for better bundle splitting)
export * from './lazy';

// Renderer Components
export * from './renderer';

// Learning Components
export * from './learning';

// Hardware Components
export * from './hardware';

// AI Components
export * from './ai';

// Collaboration Components
export * from './collaboration';

// Sharing Components
export * from './sharing';

// Plotter Components
export * from './plotter';

// CNC Components
export * from './cnc';

// Print Components - export first to establish hexToRgb/rgbToCmyk from print
export * from './print';

// Accessibility Components - selectively re-export to avoid conflicts
export {
  AccessibilityPanel,
  generateAccessibilityReport,
  applyColorBlindSimulation,
  makeAccessible,
  suggestAccessibleAlternative,
  COLOR_BLIND_TYPES,
  calculateLuminance,
  calculateContrastRatio,
  evaluateContrast,
  simulateColorBlindness,
  isColorBlindSafe,
  extractColorsFromSVG,
  analyzeColor,
  type AccessibilityReport,
  type AccessibilityIssue,
  type ColorBlindSimulation,
  type ColorInfo,
  type ContrastResult,
} from './accessibility';

// Feature Flags Components
export * from './feature-flags';
