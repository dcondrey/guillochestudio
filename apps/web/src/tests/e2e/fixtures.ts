import { test as base, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

// Test user credentials (should be set via environment variables in CI)
export const TEST_USER = {
  email: process.env.TEST_USER_EMAIL || 'test@example.com',
  password: process.env.TEST_USER_PASSWORD || 'testpassword123',
};

// Custom fixtures for authenticated tests
export interface AuthFixtures {
  authenticatedPage: Page;
}

export const test = base.extend<AuthFixtures>({
  authenticatedPage: async ({ page }, use) => {
    // This fixture assumes auth.setup.ts has already run and stored the auth state
    // For tests that need authentication, they should use this fixture
    await use(page);
  },
});

export { expect };

// Storage state file path for authenticated sessions
export const STORAGE_STATE_PATH = 'playwright/.auth/user.json';

// Utility functions for tests
export const waitForPageLoad = async (page: Page) => {
  await page.waitForLoadState('networkidle');
};

export const waitForCanvas = async (page: Page) => {
  await page.waitForSelector('canvas', { state: 'visible' });
  // Wait a bit for the canvas to render
  await page.waitForTimeout(500);
};

// Pattern test data
export const TEST_PATTERNS = {
  basic: {
    name: 'Test Pattern',
    description: 'A test pattern for E2E testing',
    family: 'hypotrochoid',
  },
  complex: {
    name: 'Complex Spirograph',
    description: 'A complex pattern with multiple parameters',
    family: 'epitrochoid',
  },
};
