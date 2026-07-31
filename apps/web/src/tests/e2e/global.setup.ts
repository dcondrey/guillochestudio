import type { FullConfig } from '@playwright/test';

/**
 * Global setup that runs once before all tests.
 *
 * The reachability probe uses fetch rather than launching a browser: each CI job
 * installs only the browser it tests with, so launching chromium here failed
 * every firefox, webkit and mobile-safari run.
 */
async function globalSetup(config: FullConfig) {
  const baseUrl = config.projects[0]?.use?.baseURL || 'http://localhost:5173';

  try {
    const response = await fetch(baseUrl, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) {
      console.warn(`Base URL ${baseUrl} returned status ${response.status}`);
    }
  } catch {
    // Not fatal: webServer may still be starting, and Playwright waits on it separately.
    console.warn(`Could not reach ${baseUrl} during setup`);
  }
}

export default globalSetup;
