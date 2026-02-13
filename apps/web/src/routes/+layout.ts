import { browser } from '$app/environment';
import { createSupabaseClient } from '$lib/services/supabase';
import { initializeI18n } from '$lib/i18n';
import type { LayoutLoad } from './$types';

// Initialize i18n
initializeI18n();

export const load: LayoutLoad = async ({ data, depends }) => {
  depends('supabase:auth');

  const supabase = createSupabaseClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return {
    ...data,
    supabase,
    session,
    user,
  };
};
