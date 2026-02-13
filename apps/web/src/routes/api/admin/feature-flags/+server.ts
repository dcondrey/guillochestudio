/**
 * Admin Feature Flags API
 *
 * Endpoints for managing feature flags:
 * - GET: List all flags with their current state
 * - POST: Update flag overrides
 * - DELETE: Clear flag overrides
 *
 * Requires admin authentication.
 */

import { json, error, type RequestEvent } from '@sveltejs/kit';
import {
  type FeatureFlagName,
  type AdminFlagUpdate,
  type AdminFlagStatus,
  type Environment,
  FEATURE_FLAGS,
  createContextFromSession,
} from '$lib/services/feature-flags';

// ============================================================================
// Server-Side Override Storage
// ============================================================================

// In-memory storage for server-side overrides (in production, use a database or KV store)
const serverOverrides = new Map<string, {
  enabled: boolean;
  scope: 'global' | 'environment' | 'user';
  targetEnvironment?: Environment;
  targetUserId?: string;
  expiresAt?: number;
  reason?: string;
  updatedAt: number;
  updatedBy: string;
}>();

/**
 * Generate a storage key for an override.
 */
function getOverrideKey(
  name: FeatureFlagName,
  scope: 'global' | 'environment' | 'user',
  target?: string
): string {
  if (scope === 'global') return `global:${name}`;
  if (scope === 'environment') return `env:${target}:${name}`;
  return `user:${target}:${name}`;
}

/**
 * Check if user has admin access.
 */
async function isAdmin(locals: App.Locals): Promise<boolean> {
  const { session, user } = await locals.safeGetSession();

  if (!session || !user) return false;

  // Check profile for admin role
  const { data: profile } = await locals.supabase
    .from('profiles')
    .select('role, subscription_tier')
    .eq('id', user.id)
    .single();

  // Admin access: role is 'admin' or subscription is enterprise
  return profile?.role === 'admin' || profile?.subscription_tier === 'enterprise';
}

// ============================================================================
// GET: List All Flags
// ============================================================================

export async function GET({ locals, url }: RequestEvent) {
  // Check admin access
  const admin = await isAdmin(locals);
  if (!admin) {
    throw error(403, 'Admin access required');
  }

  const { session, user } = await locals.safeGetSession();

  // Get optional query parameters
  const environment = url.searchParams.get('environment') as Environment | null;
  const includeStats = url.searchParams.get('stats') === 'true';

  // Get profile for context
  const { data: profile } = await locals.supabase
    .from('profiles')
    .select('subscription_tier')
    .eq('id', user?.id)
    .single();

  // Create evaluation context
  const context = createContextFromSession(
    session ? { user: { id: user?.id ?? '' } } : null,
    profile,
    environment ?? undefined
  );

  // Build response
  const flags: AdminFlagStatus[] = [];

  for (const [name, definition] of Object.entries(FEATURE_FLAGS)) {
    const flagName = name as FeatureFlagName;

    // Check for global override
    const globalKey = getOverrideKey(flagName, 'global');
    const globalOverride = serverOverrides.get(globalKey);

    // Clean up expired overrides
    if (globalOverride?.expiresAt && globalOverride.expiresAt < Date.now()) {
      serverOverrides.delete(globalKey);
    }

    const status: AdminFlagStatus = {
      name: flagName,
      definition,
      globalOverride: globalOverride && !globalOverride.expiresAt ? {
        name: flagName,
        enabled: globalOverride.enabled,
        reason: globalOverride.reason,
      } : undefined,
    };

    // Add stats if requested
    if (includeStats) {
      // In production, fetch from analytics
      status.stats = {
        totalEvaluations: Math.floor(Math.random() * 10000), // Placeholder
        enabledPercentage: Math.floor(Math.random() * 100), // Placeholder
      };
    }

    flags.push(status);
  }

  return json({
    flags,
    context: {
      environment: context.environment,
      timestamp: Date.now(),
    },
  });
};

// ============================================================================
// POST: Update Flag Override
// ============================================================================

export async function POST({ locals, request }: RequestEvent) {
  // Check admin access
  const admin = await isAdmin(locals);
  if (!admin) {
    throw error(403, 'Admin access required');
  }

  const { user } = await locals.safeGetSession();
  if (!user) {
    throw error(401, 'Authentication required');
  }

  // Parse request body
  let update: AdminFlagUpdate;
  try {
    update = await request.json();
  } catch {
    throw error(400, 'Invalid JSON body');
  }

  // Validate flag name
  if (!FEATURE_FLAGS[update.name]) {
    throw error(400, `Unknown flag: ${update.name}`);
  }

  // Validate action
  if (!['enable', 'disable', 'clear_override'].includes(update.action)) {
    throw error(400, `Invalid action: ${update.action}`);
  }

  // Validate scope
  if (!['global', 'environment', 'user'].includes(update.scope)) {
    throw error(400, `Invalid scope: ${update.scope}`);
  }

  // Validate target for non-global scopes
  if (update.scope === 'environment' && !update.targetEnvironment) {
    throw error(400, 'targetEnvironment required for environment scope');
  }
  if (update.scope === 'user' && !update.targetUserId) {
    throw error(400, 'targetUserId required for user scope');
  }

  // Generate storage key
  const target = update.scope === 'environment'
    ? update.targetEnvironment
    : update.scope === 'user'
      ? update.targetUserId
      : undefined;
  const key = getOverrideKey(update.name, update.scope, target);

  // Process action
  if (update.action === 'clear_override') {
    serverOverrides.delete(key);

    return json({
      success: true,
      message: `Cleared override for ${update.name}`,
      key,
    });
  }

  // Set override
  const enabled = update.action === 'enable';
  serverOverrides.set(key, {
    enabled,
    scope: update.scope,
    targetEnvironment: update.targetEnvironment,
    targetUserId: update.targetUserId,
    expiresAt: update.expiresInMs ? Date.now() + update.expiresInMs : undefined,
    reason: update.reason,
    updatedAt: Date.now(),
    updatedBy: user.id,
  });

  return json({
    success: true,
    message: `${enabled ? 'Enabled' : 'Disabled'} ${update.name} for ${update.scope}`,
    override: {
      key,
      enabled,
      scope: update.scope,
      expiresAt: update.expiresInMs ? Date.now() + update.expiresInMs : undefined,
    },
  });
};

// ============================================================================
// DELETE: Clear All Overrides for a Flag
// ============================================================================

export async function DELETE({ locals, url }: RequestEvent) {
  // Check admin access
  const admin = await isAdmin(locals);
  if (!admin) {
    throw error(403, 'Admin access required');
  }

  const flagName = url.searchParams.get('name') as FeatureFlagName | null;
  const clearAll = url.searchParams.get('all') === 'true';

  if (clearAll) {
    // Clear all overrides (dangerous!)
    const count = serverOverrides.size;
    serverOverrides.clear();

    return json({
      success: true,
      message: `Cleared all ${count} overrides`,
      clearedCount: count,
    });
  }

  if (!flagName) {
    throw error(400, 'Flag name required (use ?name=flag_name or ?all=true)');
  }

  if (!FEATURE_FLAGS[flagName]) {
    throw error(400, `Unknown flag: ${flagName}`);
  }

  // Clear all overrides for this flag
  let clearedCount = 0;
  for (const key of serverOverrides.keys()) {
    if (key.endsWith(`:${flagName}`)) {
      serverOverrides.delete(key);
      clearedCount++;
    }
  }

  return json({
    success: true,
    message: `Cleared ${clearedCount} overrides for ${flagName}`,
    clearedCount,
  });
};

// ============================================================================
// PATCH: Bulk Update Flags
// ============================================================================

export async function PATCH({ locals, request }: RequestEvent) {
  // Check admin access
  const admin = await isAdmin(locals);
  if (!admin) {
    throw error(403, 'Admin access required');
  }

  const { user } = await locals.safeGetSession();
  if (!user) {
    throw error(401, 'Authentication required');
  }

  // Parse request body
  let updates: AdminFlagUpdate[];
  try {
    const body = await request.json();
    updates = Array.isArray(body) ? body : [body];
  } catch {
    throw error(400, 'Invalid JSON body');
  }

  const results: Array<{
    name: FeatureFlagName;
    success: boolean;
    message: string;
    error?: string;
  }> = [];

  for (const update of updates) {
    try {
      // Validate flag name
      if (!FEATURE_FLAGS[update.name]) {
        results.push({
          name: update.name,
          success: false,
          message: 'Unknown flag',
          error: `Flag ${update.name} does not exist`,
        });
        continue;
      }

      // Generate storage key
      const target = update.scope === 'environment'
        ? update.targetEnvironment
        : update.scope === 'user'
          ? update.targetUserId
          : undefined;
      const key = getOverrideKey(update.name, update.scope, target);

      if (update.action === 'clear_override') {
        serverOverrides.delete(key);
        results.push({
          name: update.name,
          success: true,
          message: `Cleared override`,
        });
      } else {
        const enabled = update.action === 'enable';
        serverOverrides.set(key, {
          enabled,
          scope: update.scope,
          targetEnvironment: update.targetEnvironment,
          targetUserId: update.targetUserId,
          expiresAt: update.expiresInMs ? Date.now() + update.expiresInMs : undefined,
          reason: update.reason,
          updatedAt: Date.now(),
          updatedBy: user.id,
        });
        results.push({
          name: update.name,
          success: true,
          message: `${enabled ? 'Enabled' : 'Disabled'}`,
        });
      }
    } catch (err) {
      results.push({
        name: update.name,
        success: false,
        message: 'Update failed',
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  const successCount = results.filter(r => r.success).length;

  return json({
    success: successCount === results.length,
    message: `Updated ${successCount}/${results.length} flags`,
    results,
  });
};
