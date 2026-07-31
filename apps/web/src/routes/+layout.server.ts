import type { LayoutServerLoad } from './$types';
import type { PublicProfile } from '$lib/stores/auth';

const PUBLIC_PROFILE_COLUMNS =
  'id, username, display_name, avatar_url, bio, subscription_tier, created_at';

export const load: LayoutServerLoad = async ({ locals }) => {
  const { session, user } = await locals.safeGetSession();

  // Load profile if user exists
  let profile: PublicProfile | null = null;
  if (user) {
    const { data } = await locals.supabase
      .from('profiles')
      .select(PUBLIC_PROFILE_COLUMNS)
      .eq('id', user.id)
      .single();
    profile = (data as PublicProfile | null) ?? null;
  }

  return {
    session,
    user,
    profile,
  };
};
