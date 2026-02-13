<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import {
    collaborators,
    comments,
    versions,
    currentVersion,
    isConnected,
    type Comment,
    type PatternVersion,
  } from '$lib/services/collaboration';

  const dispatch = createEventDispatcher<{
    addComment: { content: string; position?: { x: number; y: number } };
    resolveComment: { commentId: string };
    createVersion: { name: string };
    switchVersion: { versionId: string };
    share: void;
  }>();

  let activeTab: 'collaborators' | 'comments' | 'versions' = 'collaborators';
  let newComment = '';
  let newVersionName = '';
  let showVersionInput = false;

  function formatTime(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  }

  function handleAddComment() {
    if (newComment.trim()) {
      dispatch('addComment', { content: newComment.trim() });
      newComment = '';
    }
  }

  function handleCreateVersion() {
    if (newVersionName.trim()) {
      dispatch('createVersion', { name: newVersionName.trim() });
      newVersionName = '';
      showVersionInput = false;
    }
  }

  // Keyboard navigation for tabs
  const tabOptions: Array<'collaborators' | 'comments' | 'versions'> = [
    'collaborators',
    'comments',
    'versions',
  ];

  function handleTabKeydown(event: KeyboardEvent) {
    const currentIndex = tabOptions.indexOf(activeTab);

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      activeTab = tabOptions[(currentIndex + 1) % tabOptions.length];
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      activeTab = tabOptions[(currentIndex - 1 + tabOptions.length) % tabOptions.length];
    }
  }
</script>

<div class="collaboration-panel bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
  <!-- Header -->
  <div class="px-4 py-3 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
    <div class="flex items-center gap-2">
      <div class="w-2 h-2 rounded-full {$isConnected ? 'bg-green-500' : 'bg-red-500'}"></div>
      <span class="text-white font-medium text-sm">
        {$isConnected ? 'Connected' : 'Disconnected'}
      </span>
    </div>
    <button
      on:click={() => dispatch('share')}
      class="text-sm text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"
        />
      </svg>
      Share
    </button>
  </div>

  <!-- Tabs -->
  <div class="flex border-b border-gray-700" role="tablist" aria-label="Collaboration panel tabs">
    <button
      role="tab"
      id="collab-tab-collaborators"
      aria-controls="collab-panel-collaborators"
      aria-selected={activeTab === 'collaborators'}
      tabindex={activeTab === 'collaborators' ? 0 : -1}
      class="flex-1 px-4 py-2 text-sm font-medium transition-colors relative focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-inset"
      class:text-indigo-400={activeTab === 'collaborators'}
      class:text-gray-400={activeTab !== 'collaborators'}
      on:click={() => (activeTab = 'collaborators')}
      on:keydown={handleTabKeydown}
    >
      People
      {#if $collaborators.size > 0}
        <span
          class="ml-1 text-xs bg-indigo-600 text-white px-1.5 py-0.5 rounded-full"
          aria-label="{$collaborators.size} collaborators"
        >
          {$collaborators.size}
        </span>
      {/if}
    </button>
    <button
      role="tab"
      id="collab-tab-comments"
      aria-controls="collab-panel-comments"
      aria-selected={activeTab === 'comments'}
      tabindex={activeTab === 'comments' ? 0 : -1}
      class="flex-1 px-4 py-2 text-sm font-medium transition-colors relative focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-inset"
      class:text-indigo-400={activeTab === 'comments'}
      class:text-gray-400={activeTab !== 'comments'}
      on:click={() => (activeTab = 'comments')}
      on:keydown={handleTabKeydown}
    >
      Comments
      {#if $comments.filter((c) => !c.resolved).length > 0}
        <span
          class="ml-1 text-xs bg-amber-500 text-white px-1.5 py-0.5 rounded-full"
          aria-label="{$comments.filter((c) => !c.resolved).length} unresolved comments"
        >
          {$comments.filter((c) => !c.resolved).length}
        </span>
      {/if}
    </button>
    <button
      role="tab"
      id="collab-tab-versions"
      aria-controls="collab-panel-versions"
      aria-selected={activeTab === 'versions'}
      tabindex={activeTab === 'versions' ? 0 : -1}
      class="flex-1 px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-inset"
      class:text-indigo-400={activeTab === 'versions'}
      class:text-gray-400={activeTab !== 'versions'}
      on:click={() => (activeTab = 'versions')}
      on:keydown={handleTabKeydown}
    >
      Versions
    </button>
  </div>

  <!-- Content -->
  <div class="p-4 max-h-80 overflow-y-auto">
    {#if activeTab === 'collaborators'}
      <!-- Collaborators List -->
      <div
        role="tabpanel"
        id="collab-panel-collaborators"
        aria-labelledby="collab-tab-collaborators"
      >
        {#if $collaborators.size === 0}
          <div class="text-center py-8 text-gray-500 text-sm">
            <svg
              class="w-10 h-10 mx-auto mb-2 opacity-50"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <p>No collaborators yet</p>
            <p class="text-xs mt-1">Share the link to invite others</p>
          </div>
        {:else}
          <div class="space-y-3">
            {#each Array.from($collaborators.values()) as collab}
              <div class="flex items-center gap-3">
                <div class="relative">
                  {#if collab.avatar_url}
                    <img
                      src={collab.avatar_url}
                      alt={collab.name}
                      class="w-8 h-8 rounded-full"
                      style="border: 2px solid {collab.color}"
                    />
                  {:else}
                    <div
                      class="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                      style="background-color: {collab.color}"
                    >
                      {collab.name[0]?.toUpperCase() || '?'}
                    </div>
                  {/if}
                  <span
                    class="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-900"
                  ></span>
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-white text-sm font-medium truncate">{collab.name}</p>
                  {#if collab.selection && collab.selection.length > 0}
                    <p class="text-xs text-gray-500">Editing: {collab.selection.join(', ')}</p>
                  {:else}
                    <p class="text-xs text-gray-500">Active</p>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {:else if activeTab === 'comments'}
      <!-- Comments Section -->
      <div
        role="tabpanel"
        id="collab-panel-comments"
        aria-labelledby="collab-tab-comments"
        class="space-y-4"
      >
        <!-- New comment input -->
        <div class="flex gap-2">
          <input
            type="text"
            bind:value={newComment}
            placeholder="Add a comment..."
            class="flex-1 bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
            on:keydown={(e) => e.key === 'Enter' && handleAddComment()}
          />
          <button
            on:click={handleAddComment}
            disabled={!newComment.trim()}
            class="px-3 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900"
            aria-label="Submit comment"
          >
            <svg
              class="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
          </button>
        </div>

        <!-- Comments list -->
        {#if $comments.length === 0}
          <div class="text-center py-6 text-gray-500 text-sm">
            <p>No comments yet</p>
          </div>
        {:else}
          <div class="space-y-3">
            {#each $comments.filter((c) => !c.resolved) as comment}
              <div class="p-3 bg-gray-800 rounded-lg">
                <div class="flex items-start gap-2">
                  {#if comment.user_avatar}
                    <img src={comment.user_avatar} alt="" class="w-6 h-6 rounded-full" />
                  {:else}
                    <div
                      class="w-6 h-6 rounded-full bg-gray-600 flex items-center justify-center text-white text-xs"
                    >
                      {comment.user_name[0]?.toUpperCase()}
                    </div>
                  {/if}
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="text-sm font-medium text-white">{comment.user_name}</span>
                      <span class="text-xs text-gray-500">{formatTime(comment.created_at)}</span>
                    </div>
                    <p class="text-sm text-gray-300 mt-1">{comment.content}</p>
                  </div>
                  <button
                    on:click={() => dispatch('resolveComment', { commentId: comment.id })}
                    class="text-gray-500 hover:text-green-400 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 rounded"
                    aria-label="Resolve comment by {comment.user_name}"
                  >
                    <svg
                      class="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            {/each}
          </div>

          <!-- Resolved comments -->
          {#if $comments.filter((c) => c.resolved).length > 0}
            <details class="mt-4">
              <summary class="text-sm text-gray-500 cursor-pointer hover:text-gray-400">
                {$comments.filter((c) => c.resolved).length} resolved
              </summary>
              <div class="mt-2 space-y-2 opacity-60">
                {#each $comments.filter((c) => c.resolved) as comment}
                  <div class="p-2 bg-gray-800/50 rounded text-sm text-gray-400 line-through">
                    {comment.content}
                  </div>
                {/each}
              </div>
            </details>
          {/if}
        {/if}
      </div>
    {:else if activeTab === 'versions'}
      <!-- Versions Section -->
      <div
        role="tabpanel"
        id="collab-panel-versions"
        aria-labelledby="collab-tab-versions"
        class="space-y-4"
      >
        <!-- Create version button -->
        {#if showVersionInput}
          <div class="flex gap-2">
            <input
              type="text"
              bind:value={newVersionName}
              placeholder="Version name..."
              class="flex-1 bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
              on:keydown={(e) => e.key === 'Enter' && handleCreateVersion()}
            />
            <button
              on:click={handleCreateVersion}
              disabled={!newVersionName.trim()}
              class="px-3 py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              Save
            </button>
            <button
              on:click={() => {
                showVersionInput = false;
                newVersionName = '';
              }}
              class="px-3 py-2 text-gray-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-gray-500 rounded"
            >
              Cancel
            </button>
          </div>
        {:else}
          <button
            on:click={() => (showVersionInput = true)}
            class="w-full py-2 border border-dashed border-gray-600 rounded text-sm text-gray-400 hover:border-indigo-500 hover:text-indigo-400 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label="Create a new version"
          >
            + Save Version
          </button>
        {/if}

        <!-- Version list -->
        {#if $versions.length === 0}
          <div class="text-center py-6 text-gray-500 text-sm">
            <p>No saved versions</p>
            <p class="text-xs mt-1">Create versions to track changes</p>
          </div>
        {:else}
          <div class="space-y-2">
            {#each $versions.slice().reverse() as version}
              <button
                on:click={() => dispatch('switchVersion', { versionId: version.id })}
                class="w-full p-3 rounded-lg text-left transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500
                       {$currentVersion === version.id
                  ? 'bg-indigo-600/20 border border-indigo-500'
                  : 'bg-gray-800 hover:bg-gray-700'}"
                aria-label="Switch to version: {version.name}{$currentVersion === version.id
                  ? ' (current)'
                  : ''}"
                aria-current={$currentVersion === version.id ? 'true' : undefined}
              >
                <div class="flex items-center justify-between">
                  <span class="font-medium text-white text-sm">{version.name}</span>
                  {#if $currentVersion === version.id}
                    <span class="text-xs text-indigo-400">Current</span>
                  {/if}
                </div>
                <p class="text-xs text-gray-500 mt-1">{formatTime(version.created_at)}</p>
              </button>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .collaboration-panel {
    width: 320px;
  }
</style>
