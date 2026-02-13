import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import {
  getPatternListing,
  getSimilarPatterns,
  getCreatorPatterns,
  checkPurchase,
  incrementViewCount,
  calculateLicensePrices,
  type LicenseType,
} from '$lib/services/marketplace';

export const load: PageServerLoad = async ({ params, locals }) => {
  const patternId = params.id;
  const { session, user } = await locals.safeGetSession();

  // Get pattern details
  const pattern = await getPatternListing(locals.supabase, patternId);

  if (!pattern) {
    throw error(404, 'Pattern not found');
  }

  // Increment view count (fire and forget)
  incrementViewCount(locals.supabase, patternId);

  // Calculate license prices
  const licensePrices = calculateLicensePrices(pattern.price_cents);

  // Check if user has purchased
  let purchaseStatus: { purchased: boolean; license?: LicenseType } = { purchased: false };
  let isOwner = false;

  if (user) {
    purchaseStatus = await checkPurchase(locals.supabase, user.id, patternId);
    isOwner = pattern.creator.id === user.id;
  }

  // Get similar patterns
  const similarPatterns = await getSimilarPatterns(
    locals.supabase,
    patternId,
    pattern.tags,
    6
  );

  // Get more from this creator
  const creatorPatterns = await getCreatorPatterns(
    locals.supabase,
    pattern.creator.id,
    patternId,
    4
  );

  return {
    pattern,
    licensePrices,
    purchaseStatus,
    isOwner,
    similarPatterns,
    creatorPatterns,
    isAuthenticated: !!user,
  };
};
