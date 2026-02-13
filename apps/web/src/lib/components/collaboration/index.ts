/**
 * Collaboration Components
 * Export all collaboration-related components
 */

export { default as CollaborationPanel } from './CollaborationPanel.svelte';
export { default as CollaboratorCursors } from './CollaboratorCursors.svelte';

// Re-export types and service
export {
  collaborators,
  comments,
  versions,
  currentVersion,
  isConnected,
  type Comment,
  type PatternVersion,
} from '$lib/services/collaboration';
