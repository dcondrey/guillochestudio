/**
 * AI Components
 * Export all AI-related components
 */

export { default as AIAssistant } from './AIAssistant.svelte';

// Re-export types and service
export {
  suggestParameters,
  recognizePattern,
  textToPattern,
  type ParameterSuggestion,
  type PatternRecognitionResult,
  type TextToPatternResult,
} from '$lib/services/ai';
