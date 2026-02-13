/**
 * Feature Flags Service
 *
 * Provides a comprehensive feature flags system with:
 * - User-based flag evaluation (by subscription tier, user ID)
 * - Environment-based flags (dev/staging/prod)
 * - Percentage rollout support
 * - A/B testing capabilities
 */

import { browser } from '$app/environment';
import type { SubscriptionTier } from '@guilloche/shared';

// ============================================================================
// Types
// ============================================================================

export type Environment = 'development' | 'staging' | 'production';

export type FeatureFlagName =
  | 'wasm_engine'
  | 'ai_suggestions'
  | 'advanced_export_formats'
  | 'beta_features'
  | 'maintenance_mode'
  | 'collaboration_realtime'
  | 'marketplace_v2'
  | 'dark_mode_v2'
  | 'performance_profiler'
  | 'experimental_curves';

export interface FeatureFlagRule {
  /** Rule type */
  type: 'subscription' | 'user_id' | 'percentage' | 'environment' | 'always' | 'never';
  /** Subscription tiers that have access (for subscription type) */
  tiers?: SubscriptionTier[];
  /** Specific user IDs that have access (for user_id type) */
  userIds?: string[];
  /** Percentage of users (0-100) for gradual rollout */
  percentage?: number;
  /** Environments where flag is enabled */
  environments?: Environment[];
}

export interface FeatureFlagDefinition {
  /** Flag name identifier */
  name: FeatureFlagName;
  /** Human-readable description */
  description: string;
  /** Default enabled state if no rules match */
  defaultEnabled: boolean;
  /** Evaluation rules (evaluated in order, first match wins) */
  rules: FeatureFlagRule[];
  /** Optional metadata */
  metadata?: {
    /** Jira/issue tracking reference */
    ticket?: string;
    /** Owner/team responsible */
    owner?: string;
    /** When the flag was created */
    createdAt?: string;
    /** Expected removal date */
    expiresAt?: string;
    /** Tags for categorization */
    tags?: string[];
  };
}

export interface FeatureFlagContext {
  /** Current user ID (if authenticated) */
  userId?: string;
  /** User's subscription tier */
  subscriptionTier?: SubscriptionTier;
  /** Current environment */
  environment: Environment;
  /** Whether user is authenticated */
  isAuthenticated?: boolean;
  /** Additional custom attributes for targeting */
  attributes?: Record<string, unknown>;
}

export interface FeatureFlagOverride {
  /** Flag name */
  name: FeatureFlagName;
  /** Override value */
  enabled: boolean;
  /** Override expiration timestamp */
  expiresAt?: number;
  /** Reason for override */
  reason?: string;
}

export interface FeatureFlagEvaluationResult {
  /** Whether the flag is enabled */
  enabled: boolean;
  /** Which rule caused the match (for debugging) */
  matchedRule?: string;
  /** Whether this was an override */
  isOverride?: boolean;
  /** Source of the evaluation */
  source: 'rule' | 'override' | 'default';
}

// ============================================================================
// Feature Flag Definitions
// ============================================================================

export const FEATURE_FLAGS: Record<FeatureFlagName, FeatureFlagDefinition> = {
  wasm_engine: {
    name: 'wasm_engine',
    description: 'Use WebAssembly engine for high-performance pattern rendering',
    defaultEnabled: false,
    rules: [
      { type: 'subscription', tiers: ['pro', 'enterprise'] },
      { type: 'environment', environments: ['development'] },
    ],
    metadata: {
      owner: 'performance-team',
      tags: ['performance', 'pro-feature'],
    },
  },

  ai_suggestions: {
    name: 'ai_suggestions',
    description: 'AI-powered pattern suggestions and generation',
    defaultEnabled: false,
    rules: [
      { type: 'subscription', tiers: ['pro', 'enterprise'] },
      { type: 'environment', environments: ['development'] },
    ],
    metadata: {
      owner: 'ai-team',
      tags: ['ai', 'pro-feature'],
    },
  },

  advanced_export_formats: {
    name: 'advanced_export_formats',
    description: 'Advanced export formats (PDF, DXF, GCODE) for professional use',
    defaultEnabled: false,
    rules: [
      { type: 'subscription', tiers: ['pro', 'enterprise'] },
    ],
    metadata: {
      owner: 'export-team',
      tags: ['export', 'pro-feature'],
    },
  },

  beta_features: {
    name: 'beta_features',
    description: 'Access to beta features before general release',
    defaultEnabled: false,
    rules: [
      { type: 'subscription', tiers: ['enterprise'] },
      { type: 'percentage', percentage: 10 },
      { type: 'environment', environments: ['development', 'staging'] },
    ],
    metadata: {
      owner: 'product-team',
      tags: ['beta'],
    },
  },

  maintenance_mode: {
    name: 'maintenance_mode',
    description: 'Enable maintenance mode for the application',
    defaultEnabled: false,
    rules: [
      { type: 'never' }, // Controlled via admin override only
    ],
    metadata: {
      owner: 'platform-team',
      tags: ['ops', 'critical'],
    },
  },

  collaboration_realtime: {
    name: 'collaboration_realtime',
    description: 'Real-time collaboration features for shared pattern editing',
    defaultEnabled: false,
    rules: [
      { type: 'subscription', tiers: ['pro', 'enterprise'] },
      { type: 'environment', environments: ['development', 'staging'] },
    ],
    metadata: {
      owner: 'collaboration-team',
      tags: ['collaboration', 'pro-feature'],
    },
  },

  marketplace_v2: {
    name: 'marketplace_v2',
    description: 'New marketplace design and features',
    defaultEnabled: false,
    rules: [
      { type: 'percentage', percentage: 25 },
      { type: 'environment', environments: ['development'] },
    ],
    metadata: {
      owner: 'marketplace-team',
      tags: ['marketplace', 'ab-test'],
    },
  },

  dark_mode_v2: {
    name: 'dark_mode_v2',
    description: 'Enhanced dark mode with improved contrast and accessibility',
    defaultEnabled: false,
    rules: [
      { type: 'percentage', percentage: 50 },
      { type: 'environment', environments: ['development', 'staging'] },
    ],
    metadata: {
      owner: 'design-team',
      tags: ['ui', 'accessibility'],
    },
  },

  performance_profiler: {
    name: 'performance_profiler',
    description: 'Built-in performance profiler for pattern rendering',
    defaultEnabled: false,
    rules: [
      { type: 'subscription', tiers: ['enterprise'] },
      { type: 'environment', environments: ['development'] },
    ],
    metadata: {
      owner: 'performance-team',
      tags: ['performance', 'enterprise-feature'],
    },
  },

  experimental_curves: {
    name: 'experimental_curves',
    description: 'Experimental curve families and mathematical functions',
    defaultEnabled: false,
    rules: [
      { type: 'environment', environments: ['development'] },
      { type: 'percentage', percentage: 5 },
    ],
    metadata: {
      owner: 'research-team',
      tags: ['experimental', 'curves'],
    },
  },
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate a deterministic hash from a string for percentage rollouts.
 * This ensures the same user always gets the same result.
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Check if a user falls within a percentage rollout.
 */
function isInPercentage(userId: string, flagName: string, percentage: number): boolean {
  const combined = `${userId}:${flagName}`;
  const hash = hashString(combined);
  const bucket = hash % 100;
  return bucket < percentage;
}

/**
 * Get current environment from platform or default.
 */
export function getCurrentEnvironment(): Environment {
  if (browser) {
    // Check for environment in window (set by server)
    const windowEnv = (window as unknown as { __ENV__?: Environment }).__ENV__;
    if (windowEnv) return windowEnv;
  }

  // Default to development if not set
  return (import.meta.env.MODE === 'production'
    ? 'production'
    : import.meta.env.MODE === 'staging'
      ? 'staging'
      : 'development') as Environment;
}

// ============================================================================
// Override Storage (for admin/testing)
// ============================================================================

const OVERRIDE_STORAGE_KEY = 'guilloche_feature_flag_overrides';

/**
 * Get all flag overrides from storage.
 */
export function getOverrides(): Record<FeatureFlagName, FeatureFlagOverride> {
  if (!browser) return {} as Record<FeatureFlagName, FeatureFlagOverride>;

  try {
    const stored = localStorage.getItem(OVERRIDE_STORAGE_KEY);
    if (!stored) return {} as Record<FeatureFlagName, FeatureFlagOverride>;

    const overrides = JSON.parse(stored) as Record<FeatureFlagName, FeatureFlagOverride>;

    // Clean up expired overrides
    const now = Date.now();
    const cleaned: Record<string, FeatureFlagOverride> = {};
    let hasExpired = false;

    for (const [key, override] of Object.entries(overrides)) {
      if (override.expiresAt && override.expiresAt < now) {
        hasExpired = true;
        continue;
      }
      cleaned[key] = override;
    }

    if (hasExpired) {
      localStorage.setItem(OVERRIDE_STORAGE_KEY, JSON.stringify(cleaned));
    }

    return cleaned as Record<FeatureFlagName, FeatureFlagOverride>;
  } catch {
    return {} as Record<FeatureFlagName, FeatureFlagOverride>;
  }
}

/**
 * Set an override for a flag.
 */
export function setOverride(
  name: FeatureFlagName,
  enabled: boolean,
  options?: { expiresInMs?: number; reason?: string }
): void {
  if (!browser) return;

  const overrides = getOverrides();
  overrides[name] = {
    name,
    enabled,
    expiresAt: options?.expiresInMs ? Date.now() + options.expiresInMs : undefined,
    reason: options?.reason,
  };

  localStorage.setItem(OVERRIDE_STORAGE_KEY, JSON.stringify(overrides));
}

/**
 * Remove an override for a flag.
 */
export function clearOverride(name: FeatureFlagName): void {
  if (!browser) return;

  const overrides = getOverrides();
  delete overrides[name];
  localStorage.setItem(OVERRIDE_STORAGE_KEY, JSON.stringify(overrides));
}

/**
 * Clear all overrides.
 */
export function clearAllOverrides(): void {
  if (!browser) return;
  localStorage.removeItem(OVERRIDE_STORAGE_KEY);
}

// ============================================================================
// Core Evaluation Logic
// ============================================================================

/**
 * Evaluate a single rule against a context.
 */
function evaluateRule(
  rule: FeatureFlagRule,
  context: FeatureFlagContext,
  flagName: FeatureFlagName
): boolean | null {
  switch (rule.type) {
    case 'always':
      return true;

    case 'never':
      return false;

    case 'subscription':
      if (!rule.tiers || !context.subscriptionTier) return null;
      return rule.tiers.includes(context.subscriptionTier);

    case 'user_id':
      if (!rule.userIds || !context.userId) return null;
      return rule.userIds.includes(context.userId);

    case 'percentage':
      if (rule.percentage === undefined || !context.userId) return null;
      return isInPercentage(context.userId, flagName, rule.percentage);

    case 'environment':
      if (!rule.environments) return null;
      return rule.environments.includes(context.environment);

    default:
      return null;
  }
}

/**
 * Evaluate a feature flag for a given context.
 */
export function evaluateFlag(
  name: FeatureFlagName,
  context: FeatureFlagContext
): FeatureFlagEvaluationResult {
  const definition = FEATURE_FLAGS[name];

  if (!definition) {
    console.warn(`Unknown feature flag: ${name}`);
    return { enabled: false, source: 'default' };
  }

  // Check for overrides first
  const overrides = getOverrides();
  const override = overrides[name];

  if (override) {
    return {
      enabled: override.enabled,
      isOverride: true,
      source: 'override',
      matchedRule: `Override: ${override.reason || 'manual'}`,
    };
  }

  // Evaluate rules in order
  for (let i = 0; i < definition.rules.length; i++) {
    const rule = definition.rules[i];
    const result = evaluateRule(rule, context, name);

    if (result !== null) {
      return {
        enabled: result,
        source: 'rule',
        matchedRule: `Rule ${i + 1}: ${rule.type}`,
      };
    }
  }

  // Fall back to default
  return {
    enabled: definition.defaultEnabled,
    source: 'default',
  };
}

/**
 * Simple evaluation that returns just a boolean.
 */
export function isFeatureEnabled(
  name: FeatureFlagName,
  context: FeatureFlagContext
): boolean {
  return evaluateFlag(name, context).enabled;
}

/**
 * Evaluate all flags for a context.
 */
export function evaluateAllFlags(
  context: FeatureFlagContext
): Record<FeatureFlagName, FeatureFlagEvaluationResult> {
  const results: Partial<Record<FeatureFlagName, FeatureFlagEvaluationResult>> = {};

  for (const name of Object.keys(FEATURE_FLAGS) as FeatureFlagName[]) {
    results[name] = evaluateFlag(name, context);
  }

  return results as Record<FeatureFlagName, FeatureFlagEvaluationResult>;
}

/**
 * Get all enabled flags for a context.
 */
export function getEnabledFlags(context: FeatureFlagContext): FeatureFlagName[] {
  return (Object.keys(FEATURE_FLAGS) as FeatureFlagName[]).filter(
    name => isFeatureEnabled(name, context)
  );
}

// ============================================================================
// Feature Flag Client
// ============================================================================

/**
 * Feature flag client for convenient usage with a fixed context.
 */
export class FeatureFlagClient {
  private context: FeatureFlagContext;
  private cache: Map<FeatureFlagName, FeatureFlagEvaluationResult> = new Map();

  constructor(context: Partial<FeatureFlagContext> = {}) {
    this.context = {
      environment: getCurrentEnvironment(),
      ...context,
    };
  }

  /**
   * Update the context (e.g., when user logs in).
   */
  updateContext(updates: Partial<FeatureFlagContext>): void {
    this.context = { ...this.context, ...updates };
    this.clearCache();
  }

  /**
   * Clear the evaluation cache.
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Check if a flag is enabled.
   */
  isEnabled(name: FeatureFlagName): boolean {
    if (!this.cache.has(name)) {
      this.cache.set(name, evaluateFlag(name, this.context));
    }
    return this.cache.get(name)!.enabled;
  }

  /**
   * Get detailed evaluation result.
   */
  evaluate(name: FeatureFlagName): FeatureFlagEvaluationResult {
    if (!this.cache.has(name)) {
      this.cache.set(name, evaluateFlag(name, this.context));
    }
    return this.cache.get(name)!;
  }

  /**
   * Get all enabled flags.
   */
  getEnabledFlags(): FeatureFlagName[] {
    return getEnabledFlags(this.context);
  }

  /**
   * Get the current context.
   */
  getContext(): FeatureFlagContext {
    return { ...this.context };
  }
}

// ============================================================================
// Server-Side Helpers
// ============================================================================

/**
 * Create a context from server locals/session data.
 */
export function createContextFromSession(
  session: { user?: { id: string } } | null,
  profile: { subscription_tier?: SubscriptionTier } | null,
  environment?: Environment
): FeatureFlagContext {
  return {
    userId: session?.user?.id,
    subscriptionTier: profile?.subscription_tier ?? 'free',
    isAuthenticated: !!session?.user,
    environment: environment ?? getCurrentEnvironment(),
  };
}

/**
 * Serialize flag states for hydration on the client.
 */
export function serializeFlags(
  context: FeatureFlagContext
): Record<FeatureFlagName, boolean> {
  const flags: Partial<Record<FeatureFlagName, boolean>> = {};

  for (const name of Object.keys(FEATURE_FLAGS) as FeatureFlagName[]) {
    flags[name] = isFeatureEnabled(name, context);
  }

  return flags as Record<FeatureFlagName, boolean>;
}

// ============================================================================
// Admin API Types
// ============================================================================

export interface AdminFlagUpdate {
  name: FeatureFlagName;
  action: 'enable' | 'disable' | 'clear_override';
  scope: 'global' | 'environment' | 'user';
  targetEnvironment?: Environment;
  targetUserId?: string;
  expiresInMs?: number;
  reason?: string;
}

export interface AdminFlagStatus {
  name: FeatureFlagName;
  definition: FeatureFlagDefinition;
  globalOverride?: FeatureFlagOverride;
  stats?: {
    totalEvaluations?: number;
    enabledPercentage?: number;
  };
}
