import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      routes: {
        include: ['/*'],
        exclude: ['<all>'],
      },
    }),
    // CSP must be declared here rather than as a manual header in hooks.server.ts:
    // only SvelteKit can stamp its own nonce onto the inline hydration script it
    // emits. A hand-rolled nonce header blocks that script and the app never
    // hydrates, which is what left the studio canvas blank and its controls dead.
    csp: {
      mode: 'nonce',
      directives: {
        'default-src': ['self'],
        'script-src': [
          'self',
          'wasm-unsafe-eval',
          'https://plausible.io',
          'https://js.stripe.com',
          'https://static.cloudflareinsights.com',
        ],
        'style-src': ['self', 'unsafe-inline', 'https://fonts.googleapis.com'],
        'img-src': ['self', 'data:', 'blob:', 'https://*.supabase.co', 'https://*.stripe.com'],
        'font-src': ['self', 'data:', 'https://fonts.gstatic.com'],
        'connect-src': [
          'self',
          'blob:',
          'https://*.supabase.co',
          'wss://*.supabase.co',
          'https://api.stripe.com',
          'https://plausible.io',
          'https://cloudflareinsights.com',
        ],
        'frame-src': ['self', 'https://js.stripe.com', 'https://hooks.stripe.com'],
        'worker-src': ['self', 'blob:'],
        'child-src': ['self', 'blob:'],
        'object-src': ['none'],
        'base-uri': ['self'],
        'form-action': ['self'],
        // Skipped in dev so localhost http subresources are not upgraded.
        'upgrade-insecure-requests': process.env.NODE_ENV === 'production',
      },
    },
    alias: {
      $lib: './src/lib',
      $components: './src/lib/components',
      $stores: './src/lib/stores',
      $services: './src/lib/services',
      $utils: './src/lib/utils',
    },
  },
};

export default config;
