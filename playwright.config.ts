import { defineConfig } from '@playwright/test'

const port = 4695
const baseURL = `http://127.0.0.1:${port}/crypto-lab-fold-gate/`

export default defineConfig({
  testDir: './e2e',
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  // Clears the run-scoped sink that records which verdict assertions actually executed, before any
  // worker exists, so a leftover file cannot stand in for assertions this run never made.
  globalSetup: './e2e/observation-reset.ts',
  use: {
    baseURL,
    colorScheme: 'dark',
    trace: 'retain-on-failure',
  },
  // Two projects rather than one, so the replay of what actually ran is ordered by declaration and
  // not by luck. `verdict-replay` reads the sink every helper call appended to during `lab`, and
  // `dependencies` is what guarantees the whole suite has finished before it reads it.
  projects: [
    { name: 'lab', testIgnore: /coverage-replay\.spec\.ts$/ },
    { name: 'verdict-replay', testMatch: /coverage-replay\.spec\.ts$/, dependencies: ['lab'] },
  ],
  webServer: {
    command: `npm run build && npm run preview -- --host 127.0.0.1 --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
})