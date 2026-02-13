import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent }) => {
  const { session, user, profile } = await parent();

  if (!session) {
    throw redirect(303, '/auth/login?redirect=/settings');
  }

  return {
    session,
    user,
    profile,
  };
};
