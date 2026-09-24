import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: process.env.RUNTIME_TEST_URL ?? 'http://localhost:3000',
    channel: 'chrome',
    serviceWorkers: 'block',
    trace: 'off',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 800 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 } } },
  ],
});
