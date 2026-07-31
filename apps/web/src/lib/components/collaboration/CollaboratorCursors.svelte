<script lang="ts">
  import { collaborators } from '$lib/services/collaboration';

  export let currentUserId: string;

  // Filter out current user and users without cursor positions
  $: otherCursors = Array.from($collaborators.values()).filter(
    (c) => c.id !== currentUserId && c.cursor !== null
  );
</script>

{#each otherCursors as collab (collab.id)}
  {#if collab.cursor}
    <div
      class="collaborator-cursor"
      style="
        left: {collab.cursor.x}px;
        top: {collab.cursor.y}px;
        --cursor-color: {collab.color};
      "
    >
      <!-- Cursor icon -->
      <svg width="24" height="24" viewBox="0 0 24 24" fill={collab.color} class="cursor-icon">
        <path d="M3 3l18 9-9 3-3 9-6-21z" />
      </svg>

      <!-- Name label -->
      <div class="cursor-label" style="background-color: {collab.color}">
        {collab.name}
      </div>
    </div>
  {/if}
{/each}

<style>
  .collaborator-cursor {
    position: absolute;
    pointer-events: none;
    z-index: 1000;
    transform: translate(-2px, -2px);
    transition:
      left 0.05s linear,
      top 0.05s linear;
  }

  .cursor-icon {
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));
  }

  .cursor-label {
    position: absolute;
    left: 16px;
    top: 16px;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 500;
    color: white;
    white-space: nowrap;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  }
</style>
