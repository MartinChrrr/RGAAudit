import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  timeout: 120_000,
  retries: 0,
  use: {
    headless: true,
    baseURL: 'http://localhost:3000',
  },
  webServer: [
    {
      command: 'npx tsx packages/server/index.ts',
      port: 3001,
      cwd: '..',
      reuseExistingServer: !process.env.CI,
      env: { PORT: '3001' },
    },
    {
      command: 'npx vite --port 3000',
      port: 3000,
      cwd: '../packages/web',
      reuseExistingServer: !process.env.CI,
    },
  ],
});
