import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent }) => {
  const { session, user, profile, supabase } = await parent();

  if (!session || !user) {
    throw redirect(303, '/auth/login?redirect=/patterns');
  }

  // Fetch user's patterns
  const { data: patterns, error } = await supabase
    .from('patterns')
    .select('id, name, description, thumbnail_url, is_public, is_listed, created_at, updated_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch patterns:', error);
  }

  return {
    session,
    user,
    profile,
    patterns: patterns || [],
  };
};
