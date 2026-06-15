const { defineConfig, devices } = require('playwright/test');

module.exports = defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry'
  },
  webServer: {
    command: 'npx http-server . -p 4173 -a 127.0.0.1 -c-1',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI
  },
  projects: [
    {
      name: 'chromium-mobile',
      use: { ...devices['Pixel 5'] }
    },
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
});
