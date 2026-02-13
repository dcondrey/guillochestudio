import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'path';

export default defineConfig({
  plugins: [svelte({ hot: !process.env.VITEST })],
  test: {
    include: ['src/**/*.{test,spec}.{js,ts}'],
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'src/tests/', '**/*.d.ts', '**/*.config.*', '**/types/**'],
    },
    alias: {
      $lib: resolve('./src/lib'),
      $app: resolve('./node_modules/@sveltejs/kit/src/runtime/app'),
    },
  },
  resolve: {
    alias: {
      $lib: resolve('./src/lib'),
      $components: resolve('./src/lib/components'),
      $stores: resolve('./src/lib/stores'),
      $services: resolve('./src/lib/services'),
      $utils: resolve('./src/lib/utils'),
    },
  },
});
