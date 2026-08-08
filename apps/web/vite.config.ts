import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, type UserConfig } from 'vite';
import { visualizer } from 'rollup-plugin-visualizer';
import viteCompression from 'vite-plugin-compression';

export default defineConfig(({ mode }): UserConfig => {
  const isProduction = mode === 'production';
  const isAnalyze = process.env.ANALYZE === 'true';

  return {
    plugins: [
      sveltekit(),
      // Gzip compression for assets
      viteCompression({
        verbose: true,
        disable: !isProduction,
        threshold: 1024, // Only compress files > 1KB
        algorithm: 'gzip',
        ext: '.gz',
      }),
      // Brotli compression for modern browsers
      viteCompression({
        verbose: true,
        disable: !isProduction,
        threshold: 1024,
        algorithm: 'brotliCompress',
        ext: '.br',
      }),
      // Bundle analyzer - only when ANALYZE=true
      isAnalyze &&
        visualizer({
          filename: 'stats.html',
          open: true,
          gzipSize: true,
          brotliSize: true,
          template: 'treemap', // 'sunburst' | 'treemap' | 'network'
        }),
    ].filter(Boolean),

    optimizeDeps: {
      exclude: ['@guilloche/core', '@guilloche/shared'],
      // Pre-bundle heavy dependencies for faster dev startup
      include: ['svelte', '@supabase/supabase-js', '@stripe/stripe-js', 'zod'],
    },

    build: {
      // Enable source maps for debugging (can disable for smaller builds)
      sourcemap: isProduction ? 'hidden' : true,

      // Minification settings
      minify: isProduction ? 'esbuild' : false,

      // Target modern browsers for smaller bundles
      target: 'es2020',

      // CSS code splitting
      cssCodeSplit: true,

      // Chunk size warnings
      chunkSizeWarningLimit: 500,

      rollupOptions: {
        output: {
          // Manual chunk splitting for better caching
          manualChunks: (id) => {
            // Vendor chunks - split by major dependencies
            if (id.includes('node_modules')) {
              // Supabase - authentication and database
              if (id.includes('@supabase')) {
                return 'vendor-supabase';
              }
              // Stripe - payment processing
              if (id.includes('stripe')) {
                return 'vendor-stripe';
              }
              // Sentry - error tracking
              if (id.includes('@sentry')) {
                return 'vendor-sentry';
              }
              // JSZip - compression utilities
              if (id.includes('jszip')) {
                return 'vendor-jszip';
              }
              // QRCode - QR generation
              if (id.includes('qrcode')) {
                return 'vendor-qrcode';
              }
              // Core Svelte runtime
              if (id.includes('svelte')) {
                return 'vendor-svelte';
              }
              // Other vendor code
              return 'vendor';
            }

            // Split heavy components into separate chunks
            if (id.includes('components/ai/')) {
              return 'component-ai';
            }
            if (id.includes('components/cnc/')) {
              return 'component-cnc';
            }
            if (id.includes('components/print/')) {
              return 'component-print';
            }
            if (id.includes('components/plotter/')) {
              return 'component-plotter';
            }
            if (id.includes('components/collaboration/')) {
              return 'component-collaboration';
            }
            if (id.includes('components/renderer/')) {
              return 'component-renderer';
            }

            // Services chunks
            if (id.includes('services/')) {
              return 'services';
            }

            // Stores chunk
            if (id.includes('stores/')) {
              return 'stores';
            }
          },

          // Asset file naming with content hash for cache busting
          assetFileNames: (assetInfo) => {
            const info = assetInfo.names[0]?.split('.') ?? [];
            const ext = info[info.length - 1];
            if (/png|jpe?g|svg|gif|tiff|bmp|ico|webp|avif/i.test(ext)) {
              return `assets/images/[name]-[hash][extname]`;
            }
            if (/woff2?|eot|ttf|otf/i.test(ext)) {
              return `assets/fonts/[name]-[hash][extname]`;
            }
            if (/css/i.test(ext)) {
              return `assets/css/[name]-[hash][extname]`;
            }
            return `assets/[name]-[hash][extname]`;
          },

          // Chunk file naming
          chunkFileNames: 'assets/js/[name]-[hash].js',

          // Entry file naming
          entryFileNames: 'assets/js/[name]-[hash].js',
        },

        // Tree shaking configuration
        treeshake: {
          moduleSideEffects: 'no-external',
          propertyReadSideEffects: false,
          tryCatchDeoptimization: false,
        },
      },

      // Report compressed size
      reportCompressedSize: true,
    },

    // Server configuration for development
    server: {
      // Enable pre-bundling
      warmup: {
        clientFiles: [
          './src/routes/+layout.svelte',
          './src/routes/(app)/studio/+page.svelte',
          './src/lib/components/**/*.svelte',
        ],
      },
    },

    // Preview server configuration
    preview: {
      port: 4173,
    },

    // Resolve configuration
    resolve: {
      // Dedupe dependencies
      dedupe: ['svelte', '@supabase/supabase-js', 'zod'],
    },

    // Environment variable handling
    envPrefix: ['VITE_', 'PUBLIC_'],
  };
});
