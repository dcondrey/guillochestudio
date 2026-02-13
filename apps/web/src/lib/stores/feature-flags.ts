/**
 * Feature Flags Store
 *
 * Reactive Svelte store for feature flag access.
 * Provides automatic re-evaluation when context changes.
 */

import { writable, derived, get, type Readable, type Writable } from 'svelte/store';
import { browser } from '$app/environment';
import {
  type FeatureFlagName,
  type FeatureFlagContext,
  type FeatureFlagEvaluationResult,
  type Environment,
  FEATURE_FLAGS,
  evaluateFlag,
  evaluateAllFlags,
  getOverrides,
  setOverride,
  clearOverride,
  clearAllOverrides,
  getCurrentEnvironment,
} from '$lib/services/feature-flags';
import { user, profile, subscriptionTier, isAuthenticated } from './auth';
import type { SubscriptionTier } from '@guilloche/shared';

// ============================================================================
// Core Context Store
// ============================================================================

/**
 * The current feature flag evaluation context.
 */
export const featureFlagContext: Writable<FeatureFlagContext> = writable({
  environment: 'development' as Environment,
});

/**
 * Initialize the feature flag context.
 * Should be called on app initialization with server data.
 */
export function initializeFeatureFlags(serverContext?: Partial<FeatureFlagContext>): void {
  const environment = serverContext?.environment ?? getCurrentEnvironment();

  featureFlagContext.set({
    environment,
    ...serverContext,
  });
}

/**
 * Update the context when auth state changes.
 * This is automatically called by the derived store below.
 */
function updateContextFromAuth(
  userId: string | undefined,
  tier: SubscriptionTier,
  authenticated: boolean
): void {
  featureFlagContext.update((ctx) => ({
    ...ctx,
    userId,
    subscriptionTier: tier,
    isAuthenticated: authenticated,
  }));
}

// ============================================================================
// Auto-sync with Auth Store
// ============================================================================

// Create a derived store that syncs context with auth state
if (browser) {
  // Subscribe to auth changes and update context
  let previousUserId: string | undefined;
  let previousTier: SubscriptionTier = 'free';
  let previousAuth = false;

  user.subscribe(($user) => {
    const newUserId = $user?.id;
    const newTier = get(subscriptionTier);
    const newAuth = get(isAuthenticated);

    if (newUserId !== previousUserId || newTier !== previousTier || newAuth !== previousAuth) {
      previousUserId = newUserId;
      previousTier = newTier;
      previousAuth = newAuth;
      updateContextFromAuth(newUserId, newTier, newAuth);
    }
  });

  subscriptionTier.subscribe(($tier) => {
    const newUserId = get(user)?.id;
    const newAuth = get(isAuthenticated);

    if ($tier !== previousTier) {
      previousTier = $tier;
      updateContextFromAuth(newUserId, $tier, newAuth);
    }
  });
}

// ============================================================================
// Evaluated Flags Store
// ============================================================================

/**
 * All evaluated flags based on current context.
 * Automatically updates when context changes.
 */
export const evaluatedFlags: Readable<Record<FeatureFlagName, FeatureFlagEvaluationResult>> =
  derived(featureFlagContext, ($context) => evaluateAllFlags($context));

/**
 * Simple boolean flags map for convenience.
 */
export const flags: Readable<Record<FeatureFlagName, boolean>> = derived(
  evaluatedFlags,
  ($evaluated) => {
    const result: Partial<Record<FeatureFlagName, boolean>> = {};
    for (const [name, evaluation] of Object.entries($evaluated)) {
      result[name as FeatureFlagName] = evaluation.enabled;
    }
    return result as Record<FeatureFlagName, boolean>;
  }
);

// ============================================================================
// Individual Flag Stores
// ============================================================================

/**
 * Create a derived store for a specific flag.
 */
export function createFlagStore(name: FeatureFlagName): Readable<boolean> {
  return derived(flags, ($flags) => $flags[name] ?? false);
}

/**
 * Create a detailed evaluation store for a specific flag.
 */
export function createFlagEvaluationStore(
  name: FeatureFlagName
): Readable<FeatureFlagEvaluationResult> {
  return derived(evaluatedFlags, ($evaluated) => $evaluated[name]);
}

// Pre-defined stores for commonly used flags
export const wasmEngineEnabled = createFlagStore('wasm_engine');
export const aiSuggestionsEnabled = createFlagStore('ai_suggestions');
export const advancedExportEnabled = createFlagStore('advanced_export_formats');
export const betaFeaturesEnabled = createFlagStore('beta_features');
export const maintenanceModeEnabled = createFlagStore('maintenance_mode');
export const collaborationEnabled = createFlagStore('collaboration_realtime');
export const marketplaceV2Enabled = createFlagStore('marketplace_v2');
export const darkModeV2Enabled = createFlagStore('dark_mode_v2');
export const performanceProfilerEnabled = createFlagStore('performance_profiler');
export const experimentalCurvesEnabled = createFlagStore('experimental_curves');

// ============================================================================
// Override Management
// ============================================================================

/**
 * Store for current overrides.
 */
export const featureFlagOverrides = writable<
  Partial<Record<FeatureFlagName, import('$lib/services/feature-flags').FeatureFlagOverride>>
>(browser ? getOverrides() : {});

/**
 * Enable a flag override.
 */
export function enableFlagOverride(
  name: FeatureFlagName,
  options?: { expiresInMs?: number; reason?: string }
): void {
  setOverride(name, true, options);
  featureFlagOverrides.set(getOverrides());
}

/**
 * Disable a flag override.
 */
export function disableFlagOverride(
  name: FeatureFlagName,
  options?: { expiresInMs?: number; reason?: string }
): void {
  setOverride(name, false, options);
  featureFlagOverrides.set(getOverrides());
}

/**
 * Clear a specific flag override.
 */
export function clearFlagOverride(name: FeatureFlagName): void {
  clearOverride(name);
  featureFlagOverrides.set(getOverrides());
}

/**
 * Clear all flag overrides.
 */
export function clearAllFlagOverrides(): void {
  clearAllOverrides();
  featureFlagOverrides.set(
    {} as Partial<
      Record<FeatureFlagName, import('$lib/services/feature-flags').FeatureFlagOverride>
    >
  );
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a flag is enabled (imperative usage).
 */
export function isFlagEnabled(name: FeatureFlagName): boolean {
  return get(flags)[name] ?? false;
}

/**
 * Get all currently enabled flags.
 */
export function getEnabledFlags(): FeatureFlagName[] {
  const $flags = get(flags);
  return (Object.keys(FEATURE_FLAGS) as FeatureFlagName[]).filter((name) => $flags[name]);
}

/**
 * Get flag definition by name.
 */
export function getFlagDefinition(name: FeatureFlagName) {
  return FEATURE_FLAGS[name];
}

/**
 * Get all flag definitions.
 */
export function getAllFlagDefinitions() {
  return FEATURE_FLAGS;
}

// ============================================================================
// Server State Hydration
// ============================================================================

/**
 * Hydrate flag state from server-side evaluation.
 * Call this in +layout.ts or +page.ts with server-computed flags.
 */
export function hydrateFlags(serverFlags: Partial<Record<FeatureFlagName, boolean>>): void {
  // Server flags are used to initialize context hints
  // The actual evaluation still happens client-side for reactivity
  if (browser) {
    console.debug(
      '[Feature Flags] Hydrated from server:',
      Object.keys(serverFlags).length,
      'flags'
    );
  }
}

// ============================================================================
// Debug Utilities
// ============================================================================

/**
 * Log current flag state for debugging.
 */
export function debugFlags(): void {
  if (!browser) return;

  const context = get(featureFlagContext);
  const $flags = get(flags);
  const $evaluated = get(evaluatedFlags);

  console.group('[Feature Flags] Debug Info');
  console.log('Context:', context);
  console.log(
    'Enabled flags:',
    Object.entries($flags)
      .filter(([, v]) => v)
      .map(([k]) => k)
  );
  console.log('All evaluations:', $evaluated);
  console.log('Overrides:', getOverrides());
  console.groupEnd();
}

// Export for testing
if (browser && import.meta.env.DEV) {
  (window as unknown as { __featureFlags?: object }).__featureFlags = {
    debugFlags,
    getEnabledFlags,
    enableFlagOverride,
    disableFlagOverride,
    clearFlagOverride,
    clearAllFlagOverrides,
    isFlagEnabled,
    getAllFlagDefinitions,
  };
}
