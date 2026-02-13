/**
 * Accessibility Components
 * Export all accessibility-related components
 */

export { default as AccessibilityPanel } from './AccessibilityPanel.svelte';

// Re-export types and service (selectively to avoid conflicts with print service)
export {
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
} from '$lib/services/accessibility';
