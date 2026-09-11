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
      command: 'env PORT=3001 RGAAUDIT_ALLOW_PRIVATE_NETWORKS=true npx tsx packages/server/index.ts',
      port: 3001,
      cwd: '..',
      reuseExistingServer: false,
    },
    {
      command: 'npx vite --port 3000',
      port: 3000,
      cwd: '../packages/web',
      reuseExistingServer: false,
    },
  ],
});
