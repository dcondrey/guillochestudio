/**
 * Server-side Subscription Enforcement Service
 *
 * CRITICAL: All premium feature checks MUST be validated server-side.
 * Client-side checks are for UX only - never trust them for security.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { PATTERN_LIMITS, API_RATE_LIMITS } from '@guilloche/shared';
import type { SubscriptionTier } from '@guilloche/shared';

// =============================================================================
// Types
// =============================================================================

export interface UserProfile {
  id: string;
  subscription_tier: SubscriptionTier;
  account_status: 'active' | 'suspended' | 'banned' | 'under_review';
  trust_score: number;
  email_verified: boolean;
  risk_flags: string[];
  locked_until: string | null;
}

export interface UsageStats {
  current_period_patterns: number;
  current_period_ai_requests: number;
  current_period_exports: number;
  total_patterns_created: number;
}

export interface EnforcementResult {
  allowed: boolean;
  reason?: string;
  code?: string;
  remaining?: number;
  limit?: number;
  upgradeRequired?: boolean;
  requiredTier?: SubscriptionTier;
}

export interface FeatureAccess {
  feature: string;
  allowed: boolean;
  reason?: string;
  usageCount?: number;
  usageLimit?: number;
}

// Feature definitions with tier requirements
export const FEATURE_REQUIREMENTS: Record<
  string,
  {
    minTier: SubscriptionTier;
    requiresVerification: boolean;
    description: string;
  }
> = {
  // Pattern features
  'pattern.save': { minTier: 'free', requiresVerification: false, description: 'Save patterns' },
  'pattern.unlimited': {
    minTier: 'enterprise',
    requiresVerification: false,
    description: 'Unlimited pattern saves',
  },

  // Export features
  'export.png': { minTier: 'free', requiresVerification: false, description: 'Export PNG' },
  'export.svg': {
    minTier: 'pro',
    requiresVerification: true,
    description: 'Export SVG (no watermark)',
  },
  'export.pdf': { minTier: 'pro', requiresVerification: true, description: 'Export PDF' },
  'export.dxf': { minTier: 'pro', requiresVerification: true, description: 'Export DXF' },
  'export.gcode': {
    minTier: 'enterprise',
    requiresVerification: true,
    description: 'Export GCODE',
  },
  'export.hpgl': { minTier: 'enterprise', requiresVerification: true, description: 'Export HPGL' },

  // AI features
  'ai.suggest': {
    minTier: 'pro',
    requiresVerification: true,
    description: 'AI parameter suggestions',
  },
  'ai.unlimited': {
    minTier: 'enterprise',
    requiresVerification: true,
    description: 'Unlimited AI requests',
  },

  // Engine features
  'engine.wasm': {
    minTier: 'pro',
    requiresVerification: false,
    description: 'WASM rendering engine',
  },

  // API features
  'api.access': { minTier: 'enterprise', requiresVerification: true, description: 'API access' },
  'api.webhooks': {
    minTier: 'enterprise',
    requiresVerification: true,
    description: 'Webhook integrations',
  },

  // Collaboration
  'collab.realtime': {
    minTier: 'pro',
    requiresVerification: true,
    description: 'Real-time collaboration',
  },
  'collab.teams': {
    minTier: 'enterprise',
    requiresVerification: true,
    description: 'Team workspaces',
  },

  // Marketplace
  'marketplace.sell': {
    minTier: 'pro',
    requiresVerification: true,
    description: 'Sell on marketplace',
  },
  'marketplace.commercial': {
    minTier: 'pro',
    requiresVerification: true,
    description: 'Commercial licenses',
  },
};

// Tier hierarchy for comparison
const TIER_HIERARCHY: Record<SubscriptionTier, number> = {
  free: 0,
  pro: 1,
  enterprise: 2,
};

// =============================================================================
// Subscription Enforcement Class
// =============================================================================

export class SubscriptionEnforcement {
  private supabase: SupabaseClient;
  private useServiceRole: boolean;

  constructor(supabase: SupabaseClient, useServiceRole = false) {
    this.supabase = supabase;
    this.useServiceRole = useServiceRole;
  }

  /**
   * Get user profile with security fields
   */
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    const { data, error } = await this.supabase
      .from('profiles')
      .select(
        `
        id,
        subscription_tier,
        account_status,
        trust_score,
        email_verified,
        risk_flags,
        locked_until
      `
      )
      .eq('id', userId)
      .single();

    if (error || !data) {
      return null;
    }

    return data as UserProfile;
  }

  /**
   * Get user's usage statistics
   */
  async getUsageStats(userId: string): Promise<UsageStats | null> {
    const { data, error } = await this.supabase
      .from('usage_lifetime')
      .select(
        `
        current_period_patterns,
        current_period_ai_requests,
        current_period_exports,
        total_patterns_created
      `
      )
      .eq('user_id', userId)
      .single();

    if (error) {
      // Return default stats if not found
      return {
        current_period_patterns: 0,
        current_period_ai_requests: 0,
        current_period_exports: 0,
        total_patterns_created: 0,
      };
    }

    return data as UsageStats;
  }

  /**
   * Check if user account is in good standing
   */
  async checkAccountStatus(userId: string): Promise<EnforcementResult> {
    const profile = await this.getUserProfile(userId);

    if (!profile) {
      return {
        allowed: false,
        reason: 'User profile not found',
        code: 'PROFILE_NOT_FOUND',
      };
    }

    // Check account status
    if (profile.account_status === 'banned') {
      return {
        allowed: false,
        reason: 'Account has been banned',
        code: 'ACCOUNT_BANNED',
      };
    }

    if (profile.account_status === 'suspended') {
      return {
        allowed: false,
        reason: 'Account is suspended',
        code: 'ACCOUNT_SUSPENDED',
      };
    }

    if (profile.account_status === 'under_review') {
      return {
        allowed: false,
        reason: 'Account is under review',
        code: 'ACCOUNT_UNDER_REVIEW',
      };
    }

    // Check if account is locked
    if (profile.locked_until) {
      const lockExpiry = new Date(profile.locked_until);
      if (lockExpiry > new Date()) {
        return {
          allowed: false,
          reason: `Account is locked until ${lockExpiry.toISOString()}`,
          code: 'ACCOUNT_LOCKED',
        };
      }
    }

    // Check trust score
    if (profile.trust_score < 10) {
      return {
        allowed: false,
        reason: 'Account trust score too low',
        code: 'LOW_TRUST_SCORE',
      };
    }

    return { allowed: true };
  }

  /**
   * Check if user has access to a specific feature
   */
  async checkFeatureAccess(
    userId: string,
    feature: string,
    options: { skipVerificationCheck?: boolean } = {}
  ): Promise<EnforcementResult> {
    // First check account status
    const accountStatus = await this.checkAccountStatus(userId);
    if (!accountStatus.allowed) {
      return accountStatus;
    }

    const profile = await this.getUserProfile(userId);
    if (!profile) {
      return {
        allowed: false,
        reason: 'User profile not found',
        code: 'PROFILE_NOT_FOUND',
      };
    }

    const featureConfig = FEATURE_REQUIREMENTS[feature];
    if (!featureConfig) {
      // Unknown feature - deny by default for security
      return {
        allowed: false,
        reason: 'Unknown feature',
        code: 'UNKNOWN_FEATURE',
      };
    }

    // Check tier requirement
    const userTierLevel = TIER_HIERARCHY[profile.subscription_tier];
    const requiredTierLevel = TIER_HIERARCHY[featureConfig.minTier];

    if (userTierLevel < requiredTierLevel) {
      return {
        allowed: false,
        reason: `Requires ${featureConfig.minTier} subscription`,
        code: 'TIER_REQUIRED',
        upgradeRequired: true,
        requiredTier: featureConfig.minTier,
      };
    }

    // Check verification requirement for premium features
    if (
      featureConfig.requiresVerification &&
      !options.skipVerificationCheck &&
      !profile.email_verified &&
      profile.subscription_tier !== 'free'
    ) {
      return {
        allowed: false,
        reason: 'Email verification required for premium features',
        code: 'VERIFICATION_REQUIRED',
      };
    }

    return { allowed: true };
  }

  /**
   * Check and enforce usage limits
   */
  async checkUsageLimit(
    userId: string,
    action: 'pattern_save' | 'ai_request' | 'export',
    amount: number = 1
  ): Promise<EnforcementResult> {
    // First check account status
    const accountStatus = await this.checkAccountStatus(userId);
    if (!accountStatus.allowed) {
      return accountStatus;
    }

    const profile = await this.getUserProfile(userId);
    if (!profile) {
      return {
        allowed: false,
        reason: 'User profile not found',
        code: 'PROFILE_NOT_FOUND',
      };
    }

    const usage = await this.getUsageStats(userId);
    if (!usage) {
      return {
        allowed: false,
        reason: 'Could not retrieve usage stats',
        code: 'USAGE_ERROR',
      };
    }

    let current: number;
    let limit: number;

    switch (action) {
      case 'pattern_save':
        current = usage.current_period_patterns;
        limit = PATTERN_LIMITS[profile.subscription_tier];
        break;
      case 'ai_request':
        current = usage.current_period_ai_requests;
        limit =
          profile.subscription_tier === 'free'
            ? 0
            : profile.subscription_tier === 'pro'
              ? 100
              : Infinity;
        break;
      case 'export':
        current = usage.current_period_exports;
        limit = Infinity; // Exports don't have a count limit, just type restrictions
        break;
      default:
        return {
          allowed: false,
          reason: 'Unknown action type',
          code: 'UNKNOWN_ACTION',
        };
    }

    if (current + amount > limit) {
      return {
        allowed: false,
        reason: `${action} limit reached (${current}/${limit})`,
        code: 'LIMIT_EXCEEDED',
        remaining: Math.max(0, limit - current),
        limit,
        upgradeRequired: true,
        requiredTier: profile.subscription_tier === 'free' ? 'pro' : 'enterprise',
      };
    }

    return {
      allowed: true,
      remaining: limit === Infinity ? undefined : limit - current - amount,
      limit: limit === Infinity ? undefined : limit,
    };
  }

  /**
   * Record usage (call after successful operation)
   */
  async recordUsage(userId: string, action: string, amount: number = 1): Promise<boolean> {
    const { error } = await this.supabase.rpc('increment_usage', {
      p_user_id: userId,
      p_action: action,
      p_amount: amount,
    });

    return !error;
  }

  /**
   * Comprehensive check for an operation
   */
  async canPerformOperation(
    userId: string,
    operation: {
      feature: string;
      action?: 'pattern_save' | 'ai_request' | 'export';
      amount?: number;
    }
  ): Promise<EnforcementResult> {
    // Check feature access
    const featureResult = await this.checkFeatureAccess(userId, operation.feature);
    if (!featureResult.allowed) {
      return featureResult;
    }

    // Check usage limit if applicable
    if (operation.action) {
      const usageResult = await this.checkUsageLimit(
        userId,
        operation.action,
        operation.amount || 1
      );
      if (!usageResult.allowed) {
        return usageResult;
      }
    }

    return { allowed: true };
  }

  /**
   * Get user's tier-based rate limit
   */
  getRateLimit(tier: SubscriptionTier): { requests: number; windowMs: number } {
    const limits = API_RATE_LIMITS[tier];
    return {
      requests: limits.requests,
      windowMs: limits.window,
    };
  }

  /**
   * Check if user needs to verify email before using premium features
   */
  async requiresVerification(userId: string): Promise<boolean> {
    const profile = await this.getUserProfile(userId);
    if (!profile) return true;

    return profile.subscription_tier !== 'free' && !profile.email_verified;
  }

  /**
   * Log a security event
   */
  async logSecurityEvent(
    userId: string | null,
    eventType: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    description: string,
    metadata: Record<string, unknown> = {},
    ipAddress?: string
  ): Promise<void> {
    await this.supabase.rpc('log_security_event', {
      p_user_id: userId,
      p_event_type: eventType,
      p_severity: severity,
      p_description: description,
      p_metadata: metadata,
      p_ip_address: ipAddress,
    });
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create enforcement instance from request event
 */
export function createEnforcement(supabase: SupabaseClient): SubscriptionEnforcement {
  return new SubscriptionEnforcement(supabase);
}

/**
 * Quick check if tier meets minimum requirement
 */
export function tierMeetsRequirement(
  userTier: SubscriptionTier,
  requiredTier: SubscriptionTier
): boolean {
  return TIER_HIERARCHY[userTier] >= TIER_HIERARCHY[requiredTier];
}

/**
 * Get all features available for a tier
 */
export function getFeaturesForTier(tier: SubscriptionTier): string[] {
  return Object.entries(FEATURE_REQUIREMENTS)
    .filter(([_, config]) => TIER_HIERARCHY[tier] >= TIER_HIERARCHY[config.minTier])
    .map(([feature]) => feature);
}

/**
 * Get features that require upgrade from current tier
 */
export function getUpgradeFeatures(currentTier: SubscriptionTier): Array<{
  feature: string;
  requiredTier: SubscriptionTier;
  description: string;
}> {
  return Object.entries(FEATURE_REQUIREMENTS)
    .filter(([_, config]) => TIER_HIERARCHY[currentTier] < TIER_HIERARCHY[config.minTier])
    .map(([feature, config]) => ({
      feature,
      requiredTier: config.minTier,
      description: config.description,
    }));
}
