<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import {
    getContextualLearning,
    type LearningInsight,
    type LearningProfile,
  } from '$lib/services/contextual-learning';

  // State
  let insights: LearningInsight[] = [];
  let profile: LearningProfile | null = null;
  let unsubscribeInsights: (() => void) | null = null;
  let unsubscribeProfile: (() => void) | null = null;
  let activeInsightIndex = 0;

  const learning = getContextualLearning();
  let rotationInterval: ReturnType<typeof setInterval> | null = null;

  onMount(() => {
    // Initialize learning in a non-blocking way
    learning.init().then(() => {
      learning.generateInsights();
    });

    unsubscribeInsights = learning.insights.subscribe((i) => {
      insights = i;
    });

    unsubscribeProfile = learning.profileStore.subscribe((p) => {
      profile = p;
    });

    // Auto-rotate insights
    rotationInterval = setInterval(() => {
      if (insights.length > 1) {
        activeInsightIndex = (activeInsightIndex + 1) % insights.length;
      }
    }, 5000);
  });

  onDestroy(() => {
    unsubscribeInsights?.();
    unsubscribeProfile?.();
    if (rotationInterval) {
      clearInterval(rotationInterval);
    }
  });

  function getInsightIcon(type: string): string {
    switch (type) {
      case 'session': return '⏱';
      case 'preference': return '❤';
      case 'progress': return '🎯';
      case 'achievement': return '🏆';
      default: return '💡';
    }
  }

  function formatTimeAgo(timestamp: number): string {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }
</script>

<div class="insights-card">
  {#if insights.length === 0}
    <div class="empty-insights">
      <span class="empty-icon">🔮</span>
      <p>Insights will appear as you create more patterns</p>
    </div>
  {:else}
    <div class="insights-carousel">
      {#each insights as insight, index}
        <div
          class="insight"
          class:active={index === activeInsightIndex}
          role="button"
          tabindex="0"
          on:click={() => (activeInsightIndex = index)}
          on:keydown={(e) => e.key === 'Enter' && (activeInsightIndex = index)}
        >
          <span class="insight-icon">{getInsightIcon(insight.type)}</span>
          <div class="insight-content">
            <p class="insight-message">{insight.message}</p>
            <span class="insight-time">{formatTimeAgo(insight.timestamp)}</span>
          </div>
        </div>
      {/each}
    </div>

    {#if insights.length > 1}
      <div class="carousel-dots">
        {#each insights as _, index}
          <button
            class="dot"
            class:active={index === activeInsightIndex}
            on:click={() => (activeInsightIndex = index)}
            aria-label="Go to insight {index + 1}"
          />
        {/each}
      </div>
    {/if}
  {/if}

  {#if profile}
    <div class="profile-summary">
      <div class="summary-item">
        <span class="summary-icon">🎨</span>
        <div class="summary-content">
          <span class="summary-label">Favorite Style</span>
          <span class="summary-value">
            {profile.styleProfile.dominantStyles[0] || 'Exploring...'}
          </span>
        </div>
      </div>

      <div class="summary-item">
        <span class="summary-icon">⚡</span>
        <div class="summary-content">
          <span class="summary-label">Complexity</span>
          <span class="summary-value">
            {profile.styleProfile.complexityScore < 0.33 ? 'Simple' :
             profile.styleProfile.complexityScore < 0.66 ? 'Moderate' : 'Complex'}
          </span>
        </div>
      </div>

      <div class="summary-item">
        <span class="summary-icon">✨</span>
        <div class="summary-content">
          <span class="summary-label">Style Tendency</span>
          <span class="summary-value">
            {profile.styleProfile.organicVsGeometric < -0.3 ? 'Organic' :
             profile.styleProfile.organicVsGeometric > 0.3 ? 'Geometric' : 'Balanced'}
          </span>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .insights-card {
    background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
    border-radius: 12px;
    padding: 16px;
    color: white;
    min-height: 120px;
  }

  .empty-insights {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 20px;
    opacity: 0.9;
  }

  .empty-icon {
    font-size: 32px;
    margin-bottom: 8px;
  }

  .empty-insights p {
    margin: 0;
    font-size: 13px;
    opacity: 0.8;
  }

  .insights-carousel {
    position: relative;
    min-height: 60px;
  }

  .insight {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    padding: 8px;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.3s ease;
    position: absolute;
    width: 100%;
    opacity: 0;
    transform: translateY(10px);
    pointer-events: none;
  }

  .insight.active {
    opacity: 1;
    transform: translateY(0);
    pointer-events: auto;
    position: relative;
  }

  .insight:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .insight-icon {
    font-size: 24px;
    flex-shrink: 0;
  }

  .insight-content {
    flex: 1;
  }

  .insight-message {
    margin: 0;
    font-size: 14px;
    font-weight: 500;
    line-height: 1.4;
  }

  .insight-time {
    font-size: 11px;
    opacity: 0.7;
  }

  .carousel-dots {
    display: flex;
    justify-content: center;
    gap: 6px;
    margin-top: 12px;
  }

  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.3);
    border: none;
    padding: 0;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .dot.active {
    background: white;
    transform: scale(1.2);
  }

  .dot:hover {
    background: rgba(255, 255, 255, 0.6);
  }

  .profile-summary {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid rgba(255, 255, 255, 0.2);
  }

  .summary-item {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .summary-icon {
    font-size: 16px;
    opacity: 0.9;
  }

  .summary-content {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .summary-label {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    opacity: 0.7;
  }

  .summary-value {
    font-size: 11px;
    font-weight: 500;
  }

  @media (max-width: 480px) {
    .profile-summary {
      grid-template-columns: 1fr;
      gap: 8px;
    }
  }
</style>
