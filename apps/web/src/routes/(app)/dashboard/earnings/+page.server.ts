import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { getCreatorEarnings } from '$lib/services/marketplace';

export const load: PageServerLoad = async ({ locals }) => {
  const { session, user } = await locals.safeGetSession();

  if (!session || !user) {
    throw redirect(303, '/auth/login');
  }

  // Get earnings data
  const earnings = await getCreatorEarnings(locals.supabase, user.id);

  // Get listed patterns with sales data
  const { data: patterns } = await locals.supabase
    .from('patterns')
    .select(`
      id,
      name,
      thumbnail_url,
      price_cents,
      download_count,
      view_count,
      is_listed,
      created_at
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  // Get recent purchases of creator's patterns
  const patternIds = patterns?.map((p) => p.id) || [];
  let recentSales: Array<{
    id: string;
    pattern_name: string;
    license_type: string;
    price_cents: number;
    royalty_paid_cents: number;
    created_at: string;
  }> = [];

  if (patternIds.length > 0) {
    const { data: purchases } = await locals.supabase
      .from('purchases')
      .select(`
        id,
        license_type,
        price_cents,
        royalty_paid_cents,
        created_at,
        patterns (name)
      `)
      .in('pattern_id', patternIds)
      .order('created_at', { ascending: false })
      .limit(20);

    recentSales = (purchases || []).map((p) => ({
      id: p.id,
      pattern_name: (p.patterns as any)?.name || 'Unknown',
      license_type: p.license_type,
      price_cents: p.price_cents,
      royalty_paid_cents: p.royalty_paid_cents,
      created_at: p.created_at,
    }));
  }

  return {
    earnings,
    patterns: patterns || [],
    recentSales,
  };
};
