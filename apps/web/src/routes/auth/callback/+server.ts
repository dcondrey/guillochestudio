import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Allowed redirect paths to prevent open redirect attacks
const ALLOWED_REDIRECTS = ['/studio', '/patterns', '/settings', '/marketplace', '/dashboard'];

function isValidRedirect(path: string): boolean {
  // Only allow relative paths starting with /
  if (!path.startsWith('/')) return false;
  // Prevent protocol-relative URLs
  if (path.startsWith('//')) return false;
  // Check against allowed prefixes
  return ALLOWED_REDIRECTS.some(allowed => path === allowed || path.startsWith(allowed + '/'));
}

export const GET: RequestHandler = async ({ url, locals }) => {
  const code = url.searchParams.get('code');
  const requestedNext = url.searchParams.get('next');
  // Validate redirect to prevent open redirect vulnerability
  const next = requestedNext && isValidRedirect(requestedNext) ? requestedNext : '/studio';

  if (code) {
    const { error } = await locals.supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Create profile if it doesn't exist
      const { data: { user } } = await locals.supabase.auth.getUser();
      if (user) {
        const { data: existingProfile } = await locals.supabase
          .from('profiles')
          .select('id')
          .eq('id', user.id)
          .single();

        if (!existingProfile) {
          await locals.supabase.from('profiles').insert({
            id: user.id,
            display_name: user.user_metadata?.full_name || user.user_metadata?.name || null,
            avatar_url: user.user_metadata?.avatar_url || null,
            subscription_tier: 'free'
          });
        }
      }

      throw redirect(303, next);
    }
  }

  // Return to login with error
  throw redirect(303, '/auth/login?message=Could not authenticate');
};
