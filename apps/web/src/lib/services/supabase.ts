import { createBrowserClient, createServerClient } from '@supabase/ssr';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

export function createSupabaseClient() {
  return createBrowserClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);
}

export function createSupabaseServerClient(
  cookies: {
    get: (key: string) => string | undefined;
    set: (key: string, value: string, options: { path: string; maxAge?: number; httpOnly?: boolean; sameSite?: string; secure?: boolean }) => void;
    delete: (key: string, options: { path: string }) => void;
  }
) {
  return createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      get: (key: string) => cookies.get(key),
      set: (key: string, value: string, options: { path: string }) => {
        cookies.set(key, value, { ...options, path: '/' });
      },
      remove: (key: string, options: { path: string }) => {
        cookies.delete(key, { ...options, path: '/' });
      }
    }
  });
}

// Re-export types
export type { Database } from '$lib/types/database';
