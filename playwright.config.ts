import { defineConfig } from '@playwright/test';

// PW_CHROMIUM lets sandboxed environments point at a preinstalled Chromium; CI installs its own.
const executablePath = process.env.PW_CHROMIUM;

export default defineConfig({
  testDir: 'tests/e2e',
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://localhost:4321',
    launchOptions: executablePath ? { executablePath } : {},
  },
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4321',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // The share question only exists when the build knows an endpoint; tests intercept this address.
    env: { PUBLIC_SHARE_URL: 'https://share.example.test/' },
  },
  projects: [
    { name: 'mobile-375', use: { viewport: { width: 375, height: 812 } } },
    { name: 'desktop-1280', use: { viewport: { width: 1280, height: 800 } } },
  ],
});
