/**
 * Contextual Learning Components
 * Export all learning-related components
 */

export { default as SuggestionsPanel } from './SuggestionsPanel.svelte';
export { default as InsightsCard } from './InsightsCard.svelte';

// Re-export types and service
export {
  getContextualLearning,
  initContextualLearning,
  ContextualLearningService,
  type UserInteraction,
  type InteractionType,
  type LearningProfile,
  type UserPreferences,
  type Suggestion,
  type SuggestionType,
  type LearningInsight,
  type SkillLevel,
} from '$lib/services/contextual-learning';
