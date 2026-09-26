import { defineConfig, devices } from '@playwright/test'

// End-to-end tests run against the app in DEMO mode (in-browser Postgres with
// the real migrations), so no Supabase project or Docker is needed.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5174',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    timezoneId: 'Australia/Sydney', // deliberately not the salon's timezone
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'npx vite --port 5174 --strictPort',
    url: 'http://localhost:5174',
    reuseExistingServer: true,
    timeout: 120_000,
    env: { VITE_DEMO_MODE: 'true', VITE_SUPABASE_URL: '' },
  },
})
