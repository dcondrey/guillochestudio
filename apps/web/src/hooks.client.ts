/**
 * Client-side hooks for error tracking, performance monitoring, and analytics
 */

import { dev } from '$app/environment';
import type { HandleClientError } from '@sveltejs/kit';

// Error tracking configuration
const SENTRY_DSN = import.meta.env.PUBLIC_SENTRY_DSN;
const PLAUSIBLE_DOMAIN = import.meta.env.PUBLIC_PLAUSIBLE_DOMAIN;

// Initialize error tracking
async function initErrorTracking() {
  if (!SENTRY_DSN || dev) return;

  try {
    const Sentry = await import('@sentry/sveltekit');

    Sentry.init({
      dsn: SENTRY_DSN,
      environment: dev ? 'development' : 'production',
      tracesSampleRate: dev ? 1.0 : 0.2,
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
      integrations: [
        Sentry.replayIntegration({
          maskAllText: false,
          blockAllMedia: false,
        }),
      ],
      beforeSend(event: {
        exception?: { values?: Array<{ type?: string }> };
        [key: string]: unknown;
      }) {
        // Filter out known non-critical errors
        if (event.exception?.values?.[0]?.type === 'ChunkLoadError') {
          return null; // Don't send chunk load errors (usually refreshes fix them)
        }
        return event;
      },
    });
  } catch (e) {
    console.warn('Failed to initialize Sentry:', e);
  }
}

// Initialize analytics
function initAnalytics() {
  if (!PLAUSIBLE_DOMAIN || dev) return;

  // Plausible is loaded via script tag, but we can track custom events
  const trackEvent = (name: string, props?: Record<string, string | number | boolean>) => {
    if (typeof window !== 'undefined' && 'plausible' in window) {
      (window as any).plausible(name, { props });
    }
  };

  // Track page views for SPA navigation
  if (typeof window !== 'undefined') {
    window.addEventListener('sveltekit:navigation-end', () => {
      trackEvent('pageview');
    });
  }

  // Expose tracking function globally
  (window as any).trackEvent = trackEvent;
}

// Performance monitoring
function initPerformanceMonitoring() {
  if (typeof window === 'undefined' || dev) return;

  // Core Web Vitals
  const reportWebVitals = async () => {
    try {
      const { onCLS, onFID, onFCP, onLCP, onTTFB, onINP } = await import('web-vitals');

      const sendToAnalytics = (metric: { name: string; value: number; id: string }) => {
        // Send to your analytics endpoint
        if ('sendBeacon' in navigator) {
          navigator.sendBeacon(
            '/api/metrics',
            JSON.stringify({
              name: metric.name,
              value: metric.value,
              id: metric.id,
              url: window.location.href,
              timestamp: Date.now(),
            })
          );
        }

        // Also track in Plausible if available
        if ('plausible' in window) {
          (window as any).plausible('Web Vital', {
            props: {
              metric: metric.name,
              value: Math.round(metric.value),
            },
          });
        }
      };

      onCLS(sendToAnalytics);
      onFID(sendToAnalytics);
      onFCP(sendToAnalytics);
      onLCP(sendToAnalytics);
      onTTFB(sendToAnalytics);
      onINP(sendToAnalytics);
    } catch (e) {
      // web-vitals not available
    }
  };

  // Wait for page to be interactive
  if (document.readyState === 'complete') {
    reportWebVitals();
  } else {
    window.addEventListener('load', reportWebVitals);
  }
}

// Service Worker registration
async function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  // Skip service worker in development unless explicitly enabled
  if (dev && !import.meta.env.VITE_ENABLE_SW_DEV) return;

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none', // Always check for updates
    });

    // Check for updates periodically (every 60 seconds)
    setInterval(() => {
      registration.update().catch(console.warn);
    }, 60000);

    // Handle updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New version available - notify user
            const event = new CustomEvent('sw-update-available', {
              detail: {
                registration,
                skipWaiting: () => {
                  newWorker.postMessage({ type: 'SKIP_WAITING' });
                },
              },
            });
            window.dispatchEvent(event);
          }
        });
      }
    });

    // Handle controller change (when new SW takes over)
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });

    // Log successful registration
    if (dev) {
      console.log('Service Worker registered:', registration.scope);
    }
  } catch (error) {
    console.warn('Service worker registration failed:', error);
  }
}

// Initialize all client-side features
if (typeof window !== 'undefined') {
  initErrorTracking();
  initAnalytics();
  initPerformanceMonitoring();
  registerServiceWorker();
}

// Client error handler
export const handleError: HandleClientError = async ({ error, event, status, message }) => {
  const errorId = crypto.randomUUID();

  // Log to console in development
  if (dev) {
    console.error('Client error:', { error, event, status, message, errorId });
  }

  // Report to Sentry in production
  if (!dev && SENTRY_DSN) {
    try {
      const Sentry = await import('@sentry/sveltekit');
      Sentry.captureException(error, {
        extra: {
          errorId,
          status,
          message,
          url: event.url.href,
        },
      });
    } catch (e) {
      // Sentry not available
    }
  }

  return {
    message: message || 'An unexpected error occurred',
    errorId,
  };
};
