import { defineConfig, devices } from '@playwright/test'

// IAT (Internal Acceptance Test) config. Playwright starts the Vite dev server
// itself (mock-data frontend — no BFF needed) and runs specs under tests/iat.
export default defineConfig({
  testDir: './tests/iat',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: 'test-results/iat.json' }]],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } },
    },
  ],
  // Full E2E stack: the Go BFF (→ GeneralAffairDB) + the Vite dev server, which
  // proxies /api → :8080. reuseExistingServer lets an already-running BFF/dev
  // server be reused instead of spawning a second one.
  webServer: [
    {
      command: 'go run ./cmd/server',
      cwd: '../bff',
      url: 'http://localhost:8090/healthz',
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: 'npm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
})
