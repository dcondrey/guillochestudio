<script lang="ts">
  import { page } from '$app/stores';
  import type { PageData } from './$types';

  export let data: PageData;

  let email = '';
  let password = '';
  let confirmPassword = '';
  let loading = false;
  let error: string | null = null;
  let success = false;

  const plan = $page.url.searchParams.get('plan');

  // Generate unique IDs for form elements
  const formId = 'signup-form';
  const emailId = 'signup-email';
  const passwordId = 'signup-password';
  const confirmPasswordId = 'signup-confirm-password';
  const errorId = 'signup-error';
  const passwordHintId = 'password-hint';

  async function handleSignup() {
    if (!email || !password) {
      error = 'Please fill in all fields';
      return;
    }

    if (password !== confirmPassword) {
      error = 'Passwords do not match';
      return;
    }

    if (password.length < 8) {
      error = 'Password must be at least 8 characters';
      return;
    }

    loading = true;
    error = null;

    const { error: authError } = await data.supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${$page.url.origin}/auth/callback?next=/studio`,
      },
    });

    if (authError) {
      error = authError.message;
      loading = false;
      return;
    }

    success = true;
  }

  async function handleOAuth(provider: 'google' | 'github') {
    loading = true;
    error = null;

    const { error: authError } = await data.supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${$page.url.origin}/auth/callback?next=/studio`,
      },
    });

    if (authError) {
      error = authError.message;
      loading = false;
    }
  }
</script>

<svelte:head>
  <title>Sign Up - Guilloche Studio Pro</title>
  <meta
    name="description"
    content="Create your Guilloche Studio account to start designing beautiful mathematical patterns."
  />
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div
  class="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 dark:bg-gray-950"
>
  <main id="main-content" class="w-full max-w-md" aria-labelledby="signup-heading">
    <!-- Logo and Header -->
    <header class="mb-8 text-center">
      <a
        href="/"
        class="inline-flex items-center gap-2 text-2xl font-bold"
        aria-label="Guilloche Studio Home"
      >
        <img src="/logo.svg" alt="" class="h-8 w-8" width="32" height="32" aria-hidden="true" />
        <span>Guilloche Studio</span>
      </a>
      <h1 id="signup-heading" class="sr-only">Create Account</h1>
      <p class="mt-2 text-gray-600 dark:text-gray-400">
        {#if plan}
          Create your account to start your {plan} plan
        {:else}
          Create your free account
        {/if}
      </p>
    </header>

    <div class="card" role="region" aria-label="Sign up options">
      {#if success}
        <!-- Success State -->
        <div class="text-center" role="status" aria-live="polite">
          <div
            class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30"
            aria-hidden="true"
          >
            <svg
              class="h-6 w-6 text-green-600 dark:text-green-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h2 class="text-xl font-semibold">Check your email</h2>
          <p class="mt-2 text-gray-600 dark:text-gray-400">
            We've sent you a confirmation link to <strong>{email}</strong>
          </p>
          <p class="mt-4 text-sm text-gray-500">
            Click the link in the email to verify your account and get started.
          </p>
          <a
            href="/auth/login"
            class="mt-6 inline-flex items-center text-primary-600 hover:text-primary-500 focus:outline-none focus:underline"
          >
            Return to sign in
          </a>
        </div>
      {:else}
        <!-- Error Message -->
        {#if error}
          <div
            id={errorId}
            class="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-400"
            role="alert"
            aria-live="assertive"
          >
            <span class="sr-only">Error: </span>
            {error}
          </div>
        {/if}

        <!-- OAuth Buttons -->
        <div class="space-y-3" role="group" aria-label="Social sign-up options">
          <button
            type="button"
            class="btn btn-secondary w-full"
            disabled={loading}
            aria-busy={loading}
            on:click={() => handleOAuth('google')}
          >
            <svg class="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            <span>Continue with Google</span>
          </button>

          <button
            type="button"
            class="btn btn-secondary w-full"
            disabled={loading}
            aria-busy={loading}
            on:click={() => handleOAuth('github')}
          >
            <svg
              class="h-5 w-5"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
              focusable="false"
            >
              <path
                d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"
              />
            </svg>
            <span>Continue with GitHub</span>
          </button>
        </div>

        <!-- Divider -->
        <div class="relative my-6" role="separator" aria-orientation="horizontal">
          <div class="absolute inset-0 flex items-center" aria-hidden="true">
            <div class="w-full border-t border-gray-200 dark:border-gray-700"></div>
          </div>
          <div class="relative flex justify-center text-sm">
            <span class="bg-white px-4 text-gray-500 dark:bg-gray-900 dark:text-gray-400">
              or continue with email
            </span>
          </div>
        </div>

        <!-- Email Form -->
        <form
          id={formId}
          on:submit|preventDefault={handleSignup}
          class="space-y-4"
          aria-describedby={error ? errorId : undefined}
          novalidate
        >
          <div>
            <label for={emailId} class="block text-sm font-medium">
              Email
              <span class="text-red-500" aria-hidden="true">*</span>
            </label>
            <input
              id={emailId}
              type="email"
              bind:value={email}
              class="input mt-1"
              placeholder="you@example.com"
              required
              autocomplete="email"
              aria-required="true"
              aria-invalid={error ? 'true' : undefined}
            />
          </div>

          <div>
            <label for={passwordId} class="block text-sm font-medium">
              Password
              <span class="text-red-500" aria-hidden="true">*</span>
            </label>
            <input
              id={passwordId}
              type="password"
              bind:value={password}
              class="input mt-1"
              placeholder="••••••••"
              minlength="8"
              required
              autocomplete="new-password"
              aria-required="true"
              aria-describedby={passwordHintId}
              aria-invalid={error ? 'true' : undefined}
            />
            <p id={passwordHintId} class="mt-1 text-xs text-gray-500">At least 8 characters</p>
          </div>

          <div>
            <label for={confirmPasswordId} class="block text-sm font-medium">
              Confirm Password
              <span class="text-red-500" aria-hidden="true">*</span>
            </label>
            <input
              id={confirmPasswordId}
              type="password"
              bind:value={confirmPassword}
              class="input mt-1"
              placeholder="••••••••"
              required
              autocomplete="new-password"
              aria-required="true"
              aria-invalid={error ? 'true' : undefined}
            />
          </div>

          <button
            type="submit"
            class="btn btn-primary w-full"
            disabled={loading}
            aria-busy={loading}
            aria-describedby={loading ? 'creating-status' : undefined}
          >
            {#if loading}
              <span id="creating-status" class="sr-only">Creating account, please wait...</span>
              <span aria-hidden="true">Creating account...</span>
            {:else}
              Create account
            {/if}
          </button>
        </form>

        <!-- Terms notice -->
        <p class="mt-4 text-center text-xs text-gray-500">
          By signing up, you agree to our
          <a
            href="/terms"
            class="text-primary-600 hover:underline focus:outline-none focus:underline"
          >
            Terms of Service
          </a>
          and
          <a
            href="/privacy"
            class="text-primary-600 hover:underline focus:outline-none focus:underline"
          >
            Privacy Policy
          </a>
        </p>
      {/if}
    </div>

    <!-- Sign in link -->
    <p class="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
      Already have an account?
      <a
        href="/auth/login"
        class="text-primary-600 hover:text-primary-500 font-medium focus:outline-none focus:underline"
      >
        Sign in
      </a>
    </p>
  </main>
</div>
