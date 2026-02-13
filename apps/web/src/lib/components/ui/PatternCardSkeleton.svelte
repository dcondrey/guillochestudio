<script lang="ts">
  /**
   * Pattern Card Skeleton
   * Loading placeholder for pattern cards
   */

  import Skeleton from './Skeleton.svelte';

  export let count: number = 1;
</script>

<div
  class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
  role="status"
  aria-busy="true"
  aria-label="Loading pattern cards"
>
  <span class="sr-only">Loading {count} pattern {count === 1 ? 'card' : 'cards'}</span>
  {#each Array(count) as _, i}
    <div class="pattern-card-skeleton" aria-hidden="true">
      <div class="thumbnail">
        <Skeleton variant="rectangular" width="100%" height="200px" ariaLabel="Loading pattern thumbnail" />
      </div>
      <div class="content">
        <Skeleton variant="text" width="70%" height="20px" ariaLabel="Loading pattern title" />
        <div class="meta">
          <Skeleton variant="circular" width="24px" height="24px" ariaLabel="Loading author avatar" />
          <Skeleton variant="text" width="100px" height="14px" ariaLabel="Loading author name" />
        </div>
        <div class="stats">
          <Skeleton variant="text" width="60px" height="14px" ariaLabel="Loading stats" />
          <Skeleton variant="text" width="60px" height="14px" ariaLabel="Loading stats" />
        </div>
      </div>
    </div>
  {/each}
</div>

<style>
  .pattern-card-skeleton {
    background: rgba(255, 255, 255, 0.03);
    border-radius: 12px;
    overflow: hidden;
  }

  .content {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .meta {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .stats {
    display: flex;
    gap: 16px;
  }

  /* Screen reader only content */
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
  }
</style>
