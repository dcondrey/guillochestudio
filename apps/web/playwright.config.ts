import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

// The package is type: module, so __dirname and require are not defined here.
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Storage state file for authenticated sessions
const STORAGE_STATE = path.join(__dirname, 'playwright/.auth/user.json');

// One source of truth for where the app is served: the webServer command, the URL
// Playwright waits on, and the baseURL tests navigate to must all agree.
const WEB_SERVER_PORT = process.env.PLAYWRIGHT_PORT || (process.env.CI ? '4173' : '5173');
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || `http://localhost:${WEB_SERVER_PORT}`;

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './src/tests/e2e',

  /* Global setup */
  globalSetup: path.join(__dirname, 'src/tests/e2e/global.setup.ts'),

  /* Output folder for test artifacts */
  outputDir: './test-results',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
    ...(process.env.CI ? [['github'] as const] : []),
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: BASE_URL,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',

    /* Take screenshot on failure */
    screenshot: 'only-on-failure',

    /* Record video on failure */
    video: 'on-first-retry',
  },

  /* Configure projects for major browsers */
  projects: [
    // Setup project to handle authentication
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },

    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
      dependencies: ['setup'],
    },

    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
      },
      dependencies: ['setup'],
    },

    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
      },
      dependencies: ['setup'],
    },

    /* Test against mobile viewports. */
    {
      name: 'Mobile Chrome',
      use: {
        ...devices['Pixel 5'],
      },
      dependencies: ['setup'],
    },
    {
      name: 'Mobile Safari',
      use: {
        ...devices['iPhone 12'],
      },
      dependencies: ['setup'],
    },
  ],

  /* Run your local dev server before starting the tests */
  // CI serves the built app so tests exercise the production bundle. The URL has
  // to track baseURL, or Playwright waits on a port the tests never visit.
  // --strictPort matters: without it vite silently binds the next free port when
  // 5173 is taken, and Playwright then waits out its timeout on a dead URL.
  webServer: {
    command: process.env.CI
      ? `pnpm preview --port ${WEB_SERVER_PORT} --strictPort`
      : `pnpm dev --port ${WEB_SERVER_PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },

  /* Global test timeout */
  timeout: 30 * 1000,

  /* Expect timeout */
  expect: {
    timeout: 10 * 1000,
  },
});
