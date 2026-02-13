import { chromium, FullConfig } from '@playwright/test';

/**
 * Global setup that runs once before all tests.
 * Use this for any initialization that should happen before any test runs.
 */
async function globalSetup(config: FullConfig) {
  // Log test configuration
  console.log('Starting E2E tests...');
  console.log(`Base URL: ${config.projects[0]?.use?.baseURL || 'Not configured'}`);
  console.log(`Workers: ${config.workers}`);
  console.log(`Retries: ${config.projects[0]?.retries || 0}`);

  // You can perform any global setup here, such as:
  // - Seeding a test database
  // - Creating test fixtures
  // - Warming up caches

  // Example: Ensure the app is reachable
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    const baseUrl = config.projects[0]?.use?.baseURL || 'http://localhost:5173';
    const response = await page.goto(baseUrl, { timeout: 30000 });

    if (!response?.ok()) {
      console.warn(`Warning: Base URL returned status ${response?.status()}`);
    } else {
      console.log('Application is reachable');
    }
  } catch (error) {
    console.error('Warning: Could not reach application during setup');
    // Don't fail setup - the web server might still be starting
  } finally {
    await browser.close();
  }
}

export default globalSetup;
