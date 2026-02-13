/**
 * Marketplace Service
 * Handles pattern purchasing, licensing, and royalty calculations
 */

import { browser } from '$app/environment';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '$lib/types/database';

export type LicenseType = 'personal' | 'commercial' | 'remix';

export interface PatternListing {
  id: string;
  name: string;
  description: string | null;
  parameters: Record<string, unknown>;
  thumbnail_url: string | null;
  price_cents: number;
  license_type: LicenseType;
  tags: string[];
  view_count: number;
  download_count: number;
  created_at: string;
  remix_of: string | null;
  creator: {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  };
  remix_chain?: RemixChainItem[];
}

export interface RemixChainItem {
  id: string;
  name: string;
  creator_username: string | null;
}

export interface PurchaseResult {
  success: boolean;
  purchase_id?: string;
  checkout_url?: string;
  error?: string;
}

export interface LicensePricing {
  personal: number;
  commercial: number;
  remix: number;
}

// Default royalty percentage for remix sales
export const REMIX_ROYALTY_PERCENT = 20;

// License multipliers for pricing
export const LICENSE_MULTIPLIERS: Record<LicenseType, number> = {
  personal: 1,
  commercial: 3,
  remix: 2,
};

// Types for Supabase query results with joins
interface PatternWithProfiles {
  id: string;
  name: string;
  description: string | null;
  parameters: Json;
  thumbnail_url: string | null;
  price_cents: number;
  license_type: string;
  tags: string[] | null;
  view_count: number;
  download_count: number;
  created_at: string;
  remix_of: string | null;
  profiles: {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
}

interface PatternWithUsername {
  id: string;
  name: string;
  remix_of: string | null;
  profiles: { username: string | null } | null;
}

interface PatternBasic {
  id: string;
  name: string;
  thumbnail_url: string | null;
  price_cents: number;
  tags: string[] | null;
  profiles: { username: string | null } | null;
}

interface PurchaseWithPattern {
  id: string;
  pattern_id: string;
  license_type: string;
  price_cents: number;
  created_at: string;
  patterns: { name: string; thumbnail_url: string | null } | null;
}

interface RemixWithPattern {
  similarity_score: number | null;
  patterns: {
    id: string;
    name: string;
    thumbnail_url: string | null;
    profiles: { username: string | null } | null;
  } | null;
}

/**
 * Get pattern details for marketplace listing
 */
export async function getPatternListing(
  supabase: SupabaseClient<Database>,
  patternId: string
): Promise<PatternListing | null> {
  const { data: pattern, error } = await supabase
    .from('patterns')
    .select(`
      id,
      name,
      description,
      parameters,
      thumbnail_url,
      price_cents,
      license_type,
      tags,
      view_count,
      download_count,
      created_at,
      remix_of,
      profiles!inner (
        id,
        username,
        display_name,
        avatar_url
      )
    `)
    .eq('id', patternId)
    .eq('is_listed', true)
    .single() as unknown as { data: PatternWithProfiles | null; error: Error | null };

  if (error || !pattern) {
    console.error('Failed to fetch pattern listing:', error);
    return null;
  }

  // Get remix chain if this is a remix
  let remixChain: RemixChainItem[] = [];
  if (pattern.remix_of) {
    remixChain = await getRemixChain(supabase, pattern.remix_of);
  }

  return {
    id: pattern.id,
    name: pattern.name,
    description: pattern.description,
    parameters: pattern.parameters as Record<string, unknown>,
    thumbnail_url: pattern.thumbnail_url,
    price_cents: pattern.price_cents,
    license_type: pattern.license_type as LicenseType,
    tags: pattern.tags || [],
    view_count: pattern.view_count,
    download_count: pattern.download_count,
    created_at: pattern.created_at,
    remix_of: pattern.remix_of,
    creator: {
      id: pattern.profiles?.id || '',
      username: pattern.profiles?.username || null,
      display_name: pattern.profiles?.display_name || null,
      avatar_url: pattern.profiles?.avatar_url || null,
    },
    remix_chain: remixChain,
  };
}

/**
 * Get the chain of original patterns for a remix
 */
async function getRemixChain(
  supabase: SupabaseClient<Database>,
  patternId: string,
  depth = 0,
  maxDepth = 10
): Promise<RemixChainItem[]> {
  if (depth >= maxDepth) return [];

  const { data: pattern } = await supabase
    .from('patterns')
    .select(`
      id,
      name,
      remix_of,
      profiles (username)
    `)
    .eq('id', patternId)
    .single() as { data: PatternWithUsername | null; error: unknown };

  if (!pattern) return [];

  const item: RemixChainItem = {
    id: pattern.id,
    name: pattern.name,
    creator_username: pattern.profiles?.username || null,
  };

  if (pattern.remix_of) {
    const chain = await getRemixChain(supabase, pattern.remix_of, depth + 1, maxDepth);
    return [item, ...chain];
  }

  return [item];
}

/**
 * Calculate license prices based on base price
 */
export function calculateLicensePrices(basePriceCents: number): LicensePricing {
  return {
    personal: basePriceCents * LICENSE_MULTIPLIERS.personal,
    commercial: basePriceCents * LICENSE_MULTIPLIERS.commercial,
    remix: basePriceCents * LICENSE_MULTIPLIERS.remix,
  };
}

/**
 * Calculate royalty amount for remix sales
 */
export function calculateRoyalty(salePriceCents: number, remixChainLength: number): number {
  // Royalty decreases with chain depth: 20% for direct remix, 10% for 2nd gen, 5% for 3rd+
  const royaltyPercents = [20, 10, 5];
  const percent = royaltyPercents[Math.min(remixChainLength - 1, royaltyPercents.length - 1)];
  return Math.floor(salePriceCents * (percent / 100));
}

/**
 * Check if user has purchased a pattern
 */
export async function checkPurchase(
  supabase: SupabaseClient<Database>,
  userId: string,
  patternId: string
): Promise<{ purchased: boolean; license?: LicenseType }> {
  const { data: purchase } = await supabase
    .from('purchases')
    .select('license_type')
    .eq('user_id', userId)
    .eq('pattern_id', patternId)
    .single() as unknown as { data: { license_type: string } | null; error: unknown };

  if (purchase) {
    return {
      purchased: true,
      license: purchase.license_type as LicenseType,
    };
  }

  return { purchased: false };
}

/**
 * Increment pattern view count
 */
export async function incrementViewCount(
  supabase: SupabaseClient<Database>,
  patternId: string
): Promise<void> {
  // Use type assertion to bypass strict type checking for RPC calls
  const client = supabase as unknown as {
    rpc: (fn: string, params: Record<string, string>) => Promise<unknown>;
  };
  await client.rpc('increment_pattern_view', { pattern_uuid: patternId });
}

/**
 * Get similar patterns based on tags and parameters
 */
export async function getSimilarPatterns(
  supabase: SupabaseClient<Database>,
  patternId: string,
  tags: string[],
  limit = 6
): Promise<Array<{
  id: string;
  name: string;
  thumbnail_url: string | null;
  price_cents: number;
  creator_username: string | null;
}>> {
  // Find patterns with overlapping tags
  const { data: patterns } = await supabase
    .from('patterns')
    .select(`
      id,
      name,
      thumbnail_url,
      price_cents,
      tags,
      profiles (username)
    `)
    .eq('is_listed', true)
    .neq('id', patternId)
    .overlaps('tags', tags)
    .limit(limit) as { data: PatternBasic[] | null; error: unknown };

  if (!patterns) return [];

  return patterns.map((p) => ({
    id: p.id,
    name: p.name,
    thumbnail_url: p.thumbnail_url,
    price_cents: p.price_cents,
    creator_username: p.profiles?.username || null,
  }));
}

/**
 * Get patterns by creator
 */
export async function getCreatorPatterns(
  supabase: SupabaseClient<Database>,
  creatorId: string,
  excludePatternId?: string,
  limit = 6
): Promise<Array<{
  id: string;
  name: string;
  thumbnail_url: string | null;
  price_cents: number;
}>> {
  let query = supabase
    .from('patterns')
    .select('id, name, thumbnail_url, price_cents')
    .eq('user_id', creatorId)
    .eq('is_listed', true);

  if (excludePatternId) {
    query = query.neq('id', excludePatternId);
  }

  const { data: patterns } = await query.limit(limit);

  return patterns || [];
}

/**
 * Get user's purchased patterns
 */
export async function getUserPurchases(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<Array<{
  id: string;
  pattern_id: string;
  pattern_name: string;
  thumbnail_url: string | null;
  license_type: LicenseType;
  price_cents: number;
  created_at: string;
}>> {
  const { data: purchases } = await supabase
    .from('purchases')
    .select(`
      id,
      pattern_id,
      license_type,
      price_cents,
      created_at,
      patterns (
        name,
        thumbnail_url
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false }) as { data: PurchaseWithPattern[] | null; error: unknown };

  if (!purchases) return [];

  return purchases.map((p) => ({
    id: p.id,
    pattern_id: p.pattern_id,
    pattern_name: p.patterns?.name || 'Unknown Pattern',
    thumbnail_url: p.patterns?.thumbnail_url || null,
    license_type: p.license_type as LicenseType,
    price_cents: p.price_cents,
    created_at: p.created_at,
  }));
}

/**
 * Get creator earnings summary
 */
export async function getCreatorEarnings(
  supabase: SupabaseClient<Database>,
  creatorId: string
): Promise<{
  total_earnings_cents: number;
  total_sales: number;
  total_royalties_cents: number;
  patterns_sold: number;
  monthly_earnings: Array<{ month: string; earnings: number; sales: number }>;
}> {
  // Get patterns owned by creator
  const { data: patterns } = await supabase
    .from('patterns')
    .select('id')
    .eq('user_id', creatorId) as unknown as { data: { id: string }[] | null; error: unknown };

  const patternIds = patterns?.map((p) => p.id) || [];

  if (patternIds.length === 0) {
    return {
      total_earnings_cents: 0,
      total_sales: 0,
      total_royalties_cents: 0,
      patterns_sold: 0,
      monthly_earnings: [],
    };
  }

  // Get all purchases of creator's patterns
  const { data: purchases } = await supabase
    .from('purchases')
    .select('price_cents, royalty_paid_cents, created_at')
    .in('pattern_id', patternIds) as unknown as {
      data: { price_cents: number; royalty_paid_cents: number; created_at: string }[] | null;
      error: unknown;
    };

  if (!purchases) {
    return {
      total_earnings_cents: 0,
      total_sales: 0,
      total_royalties_cents: 0,
      patterns_sold: 0,
      monthly_earnings: [],
    };
  }

  const total_earnings_cents = purchases.reduce((sum, p) => sum + (p.price_cents - p.royalty_paid_cents), 0);
  const total_royalties_cents = purchases.reduce((sum, p) => sum + p.royalty_paid_cents, 0);
  const total_sales = purchases.length;
  const patterns_sold = new Set(patternIds).size;

  // Group by month
  const monthlyMap = new Map<string, { earnings: number; sales: number }>();
  purchases.forEach((p) => {
    const month = p.created_at.substring(0, 7); // YYYY-MM
    const existing = monthlyMap.get(month) || { earnings: 0, sales: 0 };
    monthlyMap.set(month, {
      earnings: existing.earnings + (p.price_cents - p.royalty_paid_cents),
      sales: existing.sales + 1,
    });
  });

  const monthly_earnings = Array.from(monthlyMap.entries())
    .map(([month, data]) => ({ month, ...data }))
    .sort((a, b) => b.month.localeCompare(a.month))
    .slice(0, 12);

  return {
    total_earnings_cents,
    total_sales,
    total_royalties_cents,
    patterns_sold,
    monthly_earnings,
  };
}

/**
 * List pattern on marketplace
 */
export async function listPatternOnMarketplace(
  supabase: SupabaseClient<Database>,
  patternId: string,
  userId: string,
  options: {
    price_cents: number;
    license_type: LicenseType;
    tags?: string[];
  }
): Promise<{ success: boolean; error?: string }> {
  // Verify ownership - use any to bypass strict typing
  const client = supabase as SupabaseClient;
  const { data: pattern } = await client
    .from('patterns')
    .select('user_id')
    .eq('id', patternId)
    .single();

  if (!pattern || (pattern as { user_id: string }).user_id !== userId) {
    return { success: false, error: 'Pattern not found or unauthorized' };
  }

  // Update pattern listing
  const { error } = await client
    .from('patterns')
    .update({
      is_public: true,
      is_listed: true,
      price_cents: options.price_cents,
      license_type: options.license_type,
      tags: options.tags || [],
    })
    .eq('id', patternId);

  if (error) {
    console.error('Failed to list pattern:', error);
    return { success: false, error: 'Failed to list pattern' };
  }

  return { success: true };
}

/**
 * Unlist pattern from marketplace
 */
export async function unlistPattern(
  supabase: SupabaseClient<Database>,
  patternId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const client = supabase as SupabaseClient;
  const { error } = await client
    .from('patterns')
    .update({ is_listed: false })
    .eq('id', patternId)
    .eq('user_id', userId);

  if (error) {
    return { success: false, error: 'Failed to unlist pattern' };
  }

  return { success: true };
}

/**
 * Track remix relationship
 */
export async function createRemixRelationship(
  supabase: SupabaseClient<Database>,
  originalPatternId: string,
  remixPatternId: string,
  similarityScore: number
): Promise<void> {
  const client = supabase as SupabaseClient;
  await client.from('remixes').upsert({
    original_pattern_id: originalPatternId,
    remix_pattern_id: remixPatternId,
    similarity_score: similarityScore,
  });
}

/**
 * Get remixes of a pattern
 */
export async function getPatternRemixes(
  supabase: SupabaseClient<Database>,
  patternId: string
): Promise<Array<{
  id: string;
  name: string;
  thumbnail_url: string | null;
  creator_username: string | null;
  similarity_score: number;
}>> {
  const { data: remixes } = await supabase
    .from('remixes')
    .select(`
      similarity_score,
      patterns!remix_pattern_id (
        id,
        name,
        thumbnail_url,
        profiles (username)
      )
    `)
    .eq('original_pattern_id', patternId) as { data: RemixWithPattern[] | null; error: unknown };

  if (!remixes) return [];

  return remixes.map((r) => ({
    id: r.patterns?.id || '',
    name: r.patterns?.name || '',
    thumbnail_url: r.patterns?.thumbnail_url || null,
    creator_username: r.patterns?.profiles?.username || null,
    similarity_score: r.similarity_score ?? 0,
  })).filter((r) => r.id !== '');
}
