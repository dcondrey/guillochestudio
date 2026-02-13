/**
 * Services Index
 * Export all services for convenient imports
 */

// Core services
export * from './supabase';
export * from './stripe';

// Pattern services
export * from './ai';
export * from './progressive-renderer';
export * from './wasm-engine';
export * from './performance-monitor';
export * from './contextual-learning';

// Hardware services
export * from './hardware-integration';
export * from './plotter';
export * from './cnc';

// Collaboration services
export * from './collaboration';
export * from './sharing';

// Production services
export * from './print';
// Note: accessibility has overlapping exports with print (hexToRgb, rgbToHex)
// Import these directly from the specific service file to avoid conflicts
export {
  generateAccessibilityReport,
  applyColorBlindSimulation,
  makeAccessible,
  suggestAccessibleAlternative,
  COLOR_BLIND_TYPES,
  type AccessibilityReport,
  type AccessibilityIssue,
  type ColorBlindSimulation,
  type ColorInfo,
  type ContrastResult,
  calculateLuminance,
  calculateContrastRatio,
  evaluateContrast,
  simulateColorBlindness,
  isColorBlindSafe,
  extractColorsFromSVG,
  analyzeColor,
} from './accessibility';

// Marketplace
export * from './marketplace';

// Feature Flags
export * from './feature-flags';
