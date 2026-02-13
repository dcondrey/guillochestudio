<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import {
    getContextualLearning,
    type Suggestion,
    type LearningProfile,
    type SkillLevel,
  } from '$lib/services/contextual-learning';
  import type { PatternParams } from '@guilloche/shared';

  // Props
  export let compact = false;
  export let maxSuggestions = 5;

  // State
  let suggestions: Suggestion[] = [];
  let profile: LearningProfile | null = null;
  let skillLevel: SkillLevel = 'beginner';
  let unsubscribeSuggestions: (() => void) | null = null;
  let unsubscribeProfile: (() => void) | null = null;
  let unsubscribeSkill: (() => void) | null = null;
  let dismissedIds: Set<string> = new Set();

  const dispatch = createEventDispatcher<{
    applySuggestion: Partial<PatternParams>;
    dismissSuggestion: string;
  }>();

  const learning = getContextualLearning();

  onMount(async () => {
    await learning.init();

    unsubscribeSuggestions = learning.suggestions.subscribe((s) => {
      suggestions = s.filter((sug) => !dismissedIds.has(sug.id)).slice(0, maxSuggestions);
    });

    unsubscribeProfile = learning.profileStore.subscribe((p) => {
      profile = p;
    });

    unsubscribeSkill = learning.skillLevel.subscribe((s) => {
      skillLevel = s;
    });
  });

  onDestroy(() => {
    unsubscribeSuggestions?.();
    unsubscribeProfile?.();
    unsubscribeSkill?.();
  });

  function applySuggestion(suggestion: Suggestion) {
    if (suggestion.params) {
      dispatch('applySuggestion', suggestion.params);
    }
    if (suggestion.action) {
      suggestion.action();
    }
    dismissSuggestion(suggestion.id);
  }

  function dismissSuggestion(id: string) {
    dismissedIds.add(id);
    dismissedIds = dismissedIds;
    suggestions = suggestions.filter((s) => s.id !== id);
    dispatch('dismissSuggestion', id);
  }

  function refreshSuggestions() {
    dismissedIds.clear();
    dismissedIds = dismissedIds;
    learning.generateSuggestions();
  }

  function getSuggestionIcon(type: Suggestion['type']): string {
    switch (type) {
      case 'parameter_adjustment':
        return '⚙';
      case 'style_exploration':
        return '🎨';
      case 'workflow_tip':
        return '💡';
      case 'similar_pattern':
        return '🔗';
      case 'trending_style':
        return '📈';
      case 'skill_improvement':
        return '📚';
      case 'quick_action':
        return '⚡';
      default:
        return '✨';
    }
  }

  function getSkillLevelColor(level: SkillLevel): string {
    switch (level) {
      case 'beginner':
        return '#22c55e';
      case 'intermediate':
        return '#3b82f6';
      case 'advanced':
        return '#a855f7';
      case 'expert':
        return '#f59e0b';
      default:
        return '#64748b';
    }
  }

  function getSkillProgress(): number {
    if (!profile) return 0;
    const thresholds: Record<SkillLevel, number> = {
      beginner: 50,
      intermediate: 200,
      advanced: 500,
      expert: 1000,
    };
    const threshold = thresholds[skillLevel];
    const prevThreshold =
      skillLevel === 'beginner'
        ? 0
        : skillLevel === 'intermediate'
          ? 50
          : skillLevel === 'advanced'
            ? 200
            : 500;
    return Math.min(
      100,
      ((profile.totalInteractions - prevThreshold) / (threshold - prevThreshold)) * 100
    );
  }
</script>

<div class="suggestions-panel" class:compact>
  <!-- Skill Level Header -->
  {#if profile && !compact}
    <div class="skill-header">
      <div class="skill-badge" style="--skill-color: {getSkillLevelColor(skillLevel)}">
        <span class="skill-icon">
          {#if skillLevel === 'beginner'}🌱
          {:else if skillLevel === 'intermediate'}🌿
          {:else if skillLevel === 'advanced'}🌲
          {:else}🏆
          {/if}
        </span>
        <span class="skill-label">{skillLevel}</span>
      </div>
      <div class="skill-progress">
        <div class="progress-bar">
          <div
            class="progress-fill"
            style="width: {getSkillProgress()}%; background: {getSkillLevelColor(skillLevel)}"
          />
        </div>
        <span class="progress-text">{profile.totalInteractions} patterns</span>
      </div>
    </div>
  {/if}

  <!-- Suggestions List -->
  <div class="suggestions-header">
    <h4>Suggestions</h4>
    <button class="refresh-btn" on:click={refreshSuggestions} title="Refresh suggestions">
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <path d="M21 12a9 9 0 11-2.52-6.25" />
        <path d="M21 3v6h-6" />
      </svg>
    </button>
  </div>

  {#if suggestions.length === 0}
    <div class="empty-state">
      <span class="empty-icon">✨</span>
      <p>No suggestions right now</p>
      <p class="empty-hint">Keep creating patterns to get personalized tips!</p>
    </div>
  {:else}
    <div class="suggestions-list">
      {#each suggestions as suggestion (suggestion.id)}
        <div
          class="suggestion-card"
          class:has-params={!!suggestion.params}
          role="button"
          tabindex="0"
          on:click={() => applySuggestion(suggestion)}
          on:keydown={(e) => e.key === 'Enter' && applySuggestion(suggestion)}
        >
          <div class="suggestion-icon">
            {getSuggestionIcon(suggestion.type)}
          </div>
          <div class="suggestion-content">
            <div class="suggestion-title">{suggestion.title}</div>
            {#if !compact}
              <div class="suggestion-description">{suggestion.description}</div>
            {/if}
            <div class="suggestion-meta">
              <span class="suggestion-type">{suggestion.type.replace('_', ' ')}</span>
              <span class="suggestion-confidence" title="Confidence">
                {Math.round(suggestion.confidence * 100)}%
              </span>
            </div>
          </div>
          <button
            class="dismiss-btn"
            on:click|stopPropagation={() => dismissSuggestion(suggestion.id)}
            title="Dismiss"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      {/each}
    </div>
  {/if}

  <!-- Quick Stats -->
  {#if profile && !compact}
    <div class="quick-stats">
      <div class="stat">
        <span class="stat-value">{profile.sessionCount}</span>
        <span class="stat-label">Sessions</span>
      </div>
      <div class="stat">
        <span class="stat-value">{profile.styleProfile.dominantStyles.length}</span>
        <span class="stat-label">Styles</span>
      </div>
      <div class="stat">
        <span class="stat-value">{profile.styleProfile.colorPalettes.length}</span>
        <span class="stat-label">Palettes</span>
      </div>
    </div>
  {/if}
</div>

<style>
  .suggestions-panel {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    background: var(--panel-bg, #f8fafc);
    border-radius: 8px;
    border: 1px solid var(--border-color, #e2e8f0);
  }

  .suggestions-panel.compact {
    padding: 12px;
    gap: 8px;
  }

  .skill-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--border-color, #e2e8f0);
  }

  .skill-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    background: white;
    border-radius: 20px;
    border: 2px solid var(--skill-color);
  }

  .skill-icon {
    font-size: 14px;
  }

  .skill-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--skill-color);
  }

  .skill-progress {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .progress-bar {
    height: 4px;
    background: #e2e8f0;
    border-radius: 2px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    border-radius: 2px;
    transition: width 0.3s ease;
  }

  .progress-text {
    font-size: 10px;
    color: #64748b;
    text-align: right;
  }

  .suggestions-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .suggestions-header h4 {
    margin: 0;
    font-size: 12px;
    font-weight: 600;
    color: #475569;
  }

  .refresh-btn {
    padding: 4px;
    background: none;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.15s ease;
  }

  .refresh-btn:hover {
    background: #e2e8f0;
    color: #475569;
  }

  .empty-state {
    text-align: center;
    padding: 24px 16px;
    color: #94a3b8;
  }

  .empty-icon {
    font-size: 24px;
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

  .suggestions-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .suggestion-card {
    display: flex;
    gap: 10px;
    padding: 10px 12px;
    background: white;
    border-radius: 6px;
    border: 1px solid #e2e8f0;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .suggestion-card:hover {
    border-color: #cbd5e1;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  }

  .suggestion-card.has-params:hover {
    border-color: #4f46e5;
    background: #fafafe;
  }

  .suggestion-icon {
    font-size: 16px;
    flex-shrink: 0;
  }

  .suggestion-content {
    flex: 1;
    min-width: 0;
  }

  .suggestion-title {
    font-size: 12px;
    font-weight: 500;
    color: #1e293b;
    margin-bottom: 2px;
  }

  .suggestion-description {
    font-size: 11px;
    color: #64748b;
    line-height: 1.4;
    margin-bottom: 4px;
  }

  .suggestion-meta {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .suggestion-type {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #94a3b8;
    padding: 2px 4px;
    background: #f1f5f9;
    border-radius: 2px;
  }

  .suggestion-confidence {
    font-size: 10px;
    color: #22c55e;
    font-weight: 500;
  }

  .dismiss-btn {
    padding: 4px;
    background: none;
    border: none;
    color: #cbd5e1;
    cursor: pointer;
    border-radius: 4px;
    opacity: 0;
    transition: all 0.15s ease;
  }

  .suggestion-card:hover .dismiss-btn {
    opacity: 1;
  }

  .dismiss-btn:hover {
    background: #fee2e2;
    color: #ef4444;
  }

  .quick-stats {
    display: flex;
    justify-content: space-around;
    padding-top: 12px;
    border-top: 1px solid var(--border-color, #e2e8f0);
  }

  .stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }

  .stat-value {
    font-size: 18px;
    font-weight: 600;
    color: #1e293b;
  }

  .stat-label {
    font-size: 10px;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .compact .suggestion-card {
    padding: 8px 10px;
  }

  .compact .suggestion-icon {
    font-size: 14px;
  }

  .compact .suggestion-title {
    font-size: 11px;
  }
</style>
