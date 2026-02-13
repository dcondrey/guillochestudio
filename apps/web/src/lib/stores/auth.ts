import { writable, derived, type Readable } from 'svelte/store';
import type { User, Session } from '@supabase/supabase-js';
import type { SubscriptionTier } from '@guilloche/shared';
import type { Database } from '$lib/types/database';

type Profile = Database['public']['Tables']['profiles']['Row'];

// Core auth state
export const session = writable<Session | null>(null);
export const user = writable<User | null>(null);
export const profile = writable<Profile | null>(null);
export const authLoading = writable(true);

// Derived stores for common checks
export const isAuthenticated: Readable<boolean> = derived(user, ($user) => !!$user);

export const subscriptionTier: Readable<SubscriptionTier> = derived(
  profile,
  ($profile) => $profile?.subscription_tier ?? 'free'
);

export const isPro: Readable<boolean> = derived(
  subscriptionTier,
  ($tier) => $tier === 'pro' || $tier === 'enterprise'
);

export const isEnterprise: Readable<boolean> = derived(
  subscriptionTier,
  ($tier) => $tier === 'enterprise'
);

export const displayName: Readable<string> = derived(
  [user, profile],
  ([$user, $profile]) => {
    return $profile?.display_name || $profile?.username || $user?.email?.split('@')[0] || 'User';
  }
);

export const avatarUrl: Readable<string | null> = derived(
  [user, profile],
  ([$user, $profile]) => {
    return $profile?.avatar_url || $user?.user_metadata?.avatar_url || null;
  }
);

// Initialize auth state from server data
export function initializeAuth(data: { session: Session | null; user: User | null }) {
  session.set(data.session);
  user.set(data.user);
  authLoading.set(false);
}

// Update profile data
export function updateProfile(newProfile: Profile | null) {
  profile.set(newProfile);
}

// Clear all auth state on logout
export function clearAuth() {
  session.set(null);
  user.set(null);
  profile.set(null);
}
