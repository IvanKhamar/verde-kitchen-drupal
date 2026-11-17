/**
 * Playwright end-to-end tests: real browsers click through the running site.
 *
 *   BASE_URL="http://127.0.0.1:PORT" npm run test:e2e
 *
 * Projects: desktop Chromium, Firefox and WebKit (the engine of Safari), plus
 * phone emulation for Chrome on Android and Safari on iOS.
 * Reports and failure traces go to reports/ (not committed).
 */
import { defineConfig, devices } from '@playwright/test';

const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  // A stray test.only() must not silently skip the rest in CI.
  forbidOnly: isCI,
  // One retry in CI absorbs a rare timing hiccup; a test that fails twice is a real failure.
  retries: isCI ? 1 : 0,
  // PHP's built-in server answers few requests at once, so keep parallelism modest.
  workers: isCI ? 2 : 4,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'reports/playwright' }]],
  outputDir: 'reports/playwright-results',
  use: {
    baseURL: process.env.BASE_URL ?? 'http://127.0.0.1:8888',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
    { name: 'mobile-safari', use: { ...devices['iPhone 15'] } },
  ],
});
