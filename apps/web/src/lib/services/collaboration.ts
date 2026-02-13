/**
 * Real-time Collaboration Service
 * Multi-user pattern editing with cursor tracking, comments, and version branching
 */

import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/types/database';
import type { PatternParams } from '@guilloche/shared';
import { writable, derived, get } from 'svelte/store';

export interface Collaborator {
  id: string;
  name: string;
  avatar_url: string | null;
  color: string;
  cursor: { x: number; y: number } | null;
  selection: string[] | null; // Selected parameter keys
  lastSeen: Date;
}

export interface Comment {
  id: string;
  user_id: string;
  user_name: string;
  user_avatar: string | null;
  content: string;
  position: { x: number; y: number } | null; // Canvas position for pinned comments
  resolved: boolean;
  created_at: string;
  replies: CommentReply[];
}

export interface CommentReply {
  id: string;
  user_id: string;
  user_name: string;
  user_avatar: string | null;
  content: string;
  created_at: string;
}

export interface PatternVersion {
  id: string;
  name: string;
  params: PatternParams;
  created_by: string;
  created_at: string;
  parent_version_id: string | null;
}

export interface CollaborationSession {
  id: string;
  pattern_id: string;
  host_id: string;
  is_active: boolean;
  created_at: string;
}

// Predefined colors for collaborators
const COLLABORATOR_COLORS = [
  '#EF4444', // Red
  '#F59E0B', // Amber
  '#10B981', // Emerald
  '#3B82F6', // Blue
  '#8B5CF6', // Violet
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#84CC16', // Lime
];

// Stores
export const collaborators = writable<Map<string, Collaborator>>(new Map());
export const comments = writable<Comment[]>([]);
export const versions = writable<PatternVersion[]>([]);
export const currentVersion = writable<string | null>(null);
export const isConnected = writable(false);
export const connectionError = writable<string | null>(null);

export class CollaborationManager {
  private supabase: SupabaseClient<Database>;
  private channel: RealtimeChannel | null = null;
  private sessionId: string | null = null;
  private patternId: string | null = null;
  private userId: string;
  private userName: string;
  private userAvatar: string | null;
  private userColor: string;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    supabase: SupabaseClient<Database>,
    userId: string,
    userName: string,
    userAvatar: string | null = null
  ) {
    this.supabase = supabase;
    this.userId = userId;
    this.userName = userName;
    this.userAvatar = userAvatar;
    this.userColor = COLLABORATOR_COLORS[Math.floor(Math.random() * COLLABORATOR_COLORS.length)];
  }

  /**
   * Start or join a collaboration session
   */
  async joinSession(patternId: string, sessionId?: string): Promise<string> {
    this.patternId = patternId;

    // Create or get session
    if (sessionId) {
      this.sessionId = sessionId;
    } else {
      // Create new session
      const { data: session, error } = await this.supabase
        .from('collaboration_sessions')
        .insert({
          pattern_id: patternId,
          host_id: this.userId,
          is_active: true,
        })
        .select('id')
        .single();

      if (error || !session) {
        console.error('Failed to create collaboration session:', error);
        throw new Error('Failed to create collaboration session');
      }

      this.sessionId = session.id;
    }

    // Subscribe to realtime channel
    this.channel = this.supabase.channel(`collaboration:${this.sessionId}`, {
      config: {
        presence: {
          key: this.userId,
        },
      },
    });

    // Handle presence (collaborators joining/leaving)
    this.channel
      .on('presence', { event: 'sync' }, () => {
        const state = this.channel?.presenceState() || {};
        const newCollaborators = new Map<string, Collaborator>();

        Object.entries(state).forEach(([userId, presences]) => {
          const presence = (presences as any[])[0];
          if (presence) {
            newCollaborators.set(userId, {
              id: userId,
              name: presence.name,
              avatar_url: presence.avatar_url,
              color: presence.color,
              cursor: presence.cursor,
              selection: presence.selection,
              lastSeen: new Date(),
            });
          }
        });

        collaborators.set(newCollaborators);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('User joined:', key, newPresences);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('User left:', key, leftPresences);
      });

    // Handle broadcast messages
    this.channel
      .on('broadcast', { event: 'cursor_move' }, ({ payload }) => {
        this.handleCursorMove(payload);
      })
      .on('broadcast', { event: 'param_change' }, ({ payload }) => {
        this.handleParamChange(payload);
      })
      .on('broadcast', { event: 'selection_change' }, ({ payload }) => {
        this.handleSelectionChange(payload);
      })
      .on('broadcast', { event: 'comment_add' }, ({ payload }) => {
        this.handleCommentAdd(payload);
      })
      .on('broadcast', { event: 'comment_resolve' }, ({ payload }) => {
        this.handleCommentResolve(payload);
      })
      .on('broadcast', { event: 'version_create' }, ({ payload }) => {
        this.handleVersionCreate(payload);
      });

    // Subscribe and track presence
    await this.channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await this.channel?.track({
          name: this.userName,
          avatar_url: this.userAvatar,
          color: this.userColor,
          cursor: null,
          selection: null,
          online_at: new Date().toISOString(),
        });

        isConnected.set(true);
        connectionError.set(null);
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
        isConnected.set(false);
        connectionError.set('Connection lost. Reconnecting...');
      }
    });

    // Load existing comments and versions
    await this.loadComments();
    await this.loadVersions();

    // Start heartbeat
    this.startHeartbeat();

    return this.sessionId;
  }

  /**
   * Leave collaboration session
   */
  async leaveSession(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.channel) {
      await this.channel.untrack();
      await this.supabase.removeChannel(this.channel);
      this.channel = null;
    }

    this.sessionId = null;
    this.patternId = null;
    isConnected.set(false);
    collaborators.set(new Map());
    comments.set([]);
    versions.set([]);
  }

  /**
   * Update cursor position
   */
  async updateCursor(x: number, y: number): Promise<void> {
    if (!this.channel) return;

    await this.channel.send({
      type: 'broadcast',
      event: 'cursor_move',
      payload: {
        user_id: this.userId,
        cursor: { x, y },
      },
    });
  }

  /**
   * Broadcast parameter change
   */
  async broadcastParamChange(key: string, value: unknown): Promise<void> {
    if (!this.channel) return;

    await this.channel.send({
      type: 'broadcast',
      event: 'param_change',
      payload: {
        user_id: this.userId,
        user_name: this.userName,
        key,
        value,
        timestamp: Date.now(),
      },
    });
  }

  /**
   * Update selection
   */
  async updateSelection(keys: string[]): Promise<void> {
    if (!this.channel) return;

    await this.channel.send({
      type: 'broadcast',
      event: 'selection_change',
      payload: {
        user_id: this.userId,
        selection: keys,
      },
    });
  }

  /**
   * Add comment
   */
  async addComment(content: string, position?: { x: number; y: number }): Promise<void> {
    if (!this.sessionId || !this.patternId) return;

    const comment: Comment = {
      id: crypto.randomUUID(),
      user_id: this.userId,
      user_name: this.userName,
      user_avatar: this.userAvatar,
      content,
      position: position || null,
      resolved: false,
      created_at: new Date().toISOString(),
      replies: [],
    };

    // Save to database
    await this.supabase.from('pattern_comments').insert({
      id: comment.id,
      pattern_id: this.patternId,
      session_id: this.sessionId,
      user_id: this.userId,
      content,
      position_x: position?.x ?? null,
      position_y: position?.y ?? null,
    });

    // Broadcast to collaborators
    await this.channel?.send({
      type: 'broadcast',
      event: 'comment_add',
      payload: comment,
    });

    // Update local store
    comments.update((c) => [...c, comment]);
  }

  /**
   * Reply to comment
   */
  async replyToComment(commentId: string, content: string): Promise<void> {
    const reply: CommentReply = {
      id: crypto.randomUUID(),
      user_id: this.userId,
      user_name: this.userName,
      user_avatar: this.userAvatar,
      content,
      created_at: new Date().toISOString(),
    };

    // Save to database
    await this.supabase.from('comment_replies').insert({
      id: reply.id,
      comment_id: commentId,
      user_id: this.userId,
      content,
    });

    // Update local store
    comments.update((c) =>
      c.map((comment) => {
        if (comment.id === commentId) {
          return { ...comment, replies: [...comment.replies, reply] };
        }
        return comment;
      })
    );
  }

  /**
   * Resolve comment
   */
  async resolveComment(commentId: string): Promise<void> {
    await this.supabase
      .from('pattern_comments')
      .update({ resolved: true })
      .eq('id', commentId);

    await this.channel?.send({
      type: 'broadcast',
      event: 'comment_resolve',
      payload: { comment_id: commentId },
    });

    comments.update((c) =>
      c.map((comment) => {
        if (comment.id === commentId) {
          return { ...comment, resolved: true };
        }
        return comment;
      })
    );
  }

  /**
   * Create version branch
   */
  async createVersion(name: string, params: PatternParams): Promise<string> {
    if (!this.patternId) throw new Error('No active session');

    const currentVersionId = get(currentVersion);

    const version: PatternVersion = {
      id: crypto.randomUUID(),
      name,
      params,
      created_by: this.userId,
      created_at: new Date().toISOString(),
      parent_version_id: currentVersionId,
    };

    // Save to database
    await this.supabase.from('pattern_versions').insert({
      id: version.id,
      pattern_id: this.patternId,
      name: version.name,
      parameters: version.params as any,
      created_by: version.created_by,
      parent_version_id: version.parent_version_id,
    });

    // Broadcast
    await this.channel?.send({
      type: 'broadcast',
      event: 'version_create',
      payload: version,
    });

    // Update stores
    versions.update((v) => [...v, version]);
    currentVersion.set(version.id);

    return version.id;
  }

  /**
   * Switch to version
   */
  async switchToVersion(versionId: string): Promise<PatternParams | null> {
    const versionList = get(versions);
    const version = versionList.find((v) => v.id === versionId);

    if (version) {
      currentVersion.set(versionId);
      return version.params;
    }

    return null;
  }

  /**
   * Generate shareable session link
   */
  getShareLink(): string {
    if (!this.sessionId) return '';
    return `${window.location.origin}/studio?collaborate=${this.sessionId}`;
  }

  // Private methods

  private handleCursorMove(payload: { user_id: string; cursor: { x: number; y: number } }) {
    collaborators.update((c) => {
      const collab = c.get(payload.user_id);
      if (collab) {
        c.set(payload.user_id, { ...collab, cursor: payload.cursor, lastSeen: new Date() });
      }
      return new Map(c);
    });
  }

  private handleParamChange(payload: {
    user_id: string;
    user_name: string;
    key: string;
    value: unknown;
    timestamp: number;
  }) {
    // Emit event for the pattern store to handle
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('collab:param_change', {
          detail: payload,
        })
      );
    }
  }

  private handleSelectionChange(payload: { user_id: string; selection: string[] }) {
    collaborators.update((c) => {
      const collab = c.get(payload.user_id);
      if (collab) {
        c.set(payload.user_id, { ...collab, selection: payload.selection });
      }
      return new Map(c);
    });
  }

  private handleCommentAdd(payload: Comment) {
    comments.update((c) => [...c, payload]);
  }

  private handleCommentResolve(payload: { comment_id: string }) {
    comments.update((c) =>
      c.map((comment) => {
        if (comment.id === payload.comment_id) {
          return { ...comment, resolved: true };
        }
        return comment;
      })
    );
  }

  private handleVersionCreate(payload: PatternVersion) {
    versions.update((v) => [...v, payload]);
  }

  private async loadComments() {
    if (!this.patternId) return;

    const { data } = await this.supabase
      .from('pattern_comments')
      .select(`
        id,
        user_id,
        content,
        position_x,
        position_y,
        resolved,
        created_at
      `)
      .eq('pattern_id', this.patternId)
      .order('created_at', { ascending: true });

    if (data) {
      // Fetch profile info separately for each user
      const userIds = [...new Set(data.map(c => c.user_id))];
      const { data: profiles } = await this.supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      comments.set(
        data.map((c) => {
          const profile = profileMap.get(c.user_id);
          return {
            id: c.id,
            user_id: c.user_id,
            user_name: profile?.display_name || 'Unknown',
            user_avatar: profile?.avatar_url || null,
            content: c.content,
            position: c.position_x != null && c.position_y != null ? { x: c.position_x, y: c.position_y } : null,
            resolved: c.resolved,
            created_at: c.created_at,
            replies: [], // Load replies separately if needed
          };
        })
      );
    }
  }

  private async loadVersions() {
    if (!this.patternId) return;

    const { data } = await this.supabase
      .from('pattern_versions')
      .select('*')
      .eq('pattern_id', this.patternId)
      .order('created_at', { ascending: true });

    if (data) {
      versions.set(
        data.map((v) => ({
          id: v.id,
          name: v.name,
          params: v.parameters as unknown as PatternParams,
          created_by: v.created_by,
          created_at: v.created_at,
          parent_version_id: v.parent_version_id,
        }))
      );

      // Set current to latest
      if (data.length > 0) {
        currentVersion.set(data[data.length - 1].id);
      }
    }
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(async () => {
      if (this.channel) {
        await this.channel.track({
          name: this.userName,
          avatar_url: this.userAvatar,
          color: this.userColor,
          online_at: new Date().toISOString(),
        });
      }
    }, 30000); // Every 30 seconds
  }
}

// Singleton instance
let collaborationManager: CollaborationManager | null = null;

export function getCollaborationManager(
  supabase: SupabaseClient<Database>,
  userId: string,
  userName: string,
  userAvatar?: string
): CollaborationManager {
  if (!collaborationManager) {
    collaborationManager = new CollaborationManager(supabase, userId, userName, userAvatar || null);
  }
  return collaborationManager;
}

export function resetCollaborationManager() {
  if (collaborationManager) {
    collaborationManager.leaveSession();
    collaborationManager = null;
  }
}
