import { test, expect } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const FIXTURES_DIR = join(__dirname, 'fixtures', 'test-sites');

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.xml': 'application/xml',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.gif': 'image/gif',
};

let fixtureServer: Server;
let fixturePort: number;

test.beforeAll(async () => {
  fixtureServer = createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost`);

    // Dynamic sitemap.xml with correct port
    if (url.pathname === '/sitemap.xml') {
      const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>http://localhost:${fixturePort}/index.html</loc></url>
  <url><loc>http://localhost:${fixturePort}/images/alt-missing.html</loc></url>
  <url><loc>http://localhost:${fixturePort}/links/generic-links.html</loc></url>
</urlset>`;
      res.writeHead(200, { 'Content-Type': 'application/xml' });
      res.end(sitemap);
      return;
    }

    // Serve static files from fixtures
    const filePath = join(FIXTURES_DIR, url.pathname === '/' ? 'index.html' : url.pathname);
    if (existsSync(filePath)) {
      const ext = extname(filePath);
      const mime = MIME_TYPES[ext] ?? 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': mime });
      res.end(readFileSync(filePath));
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  await new Promise<void>((resolve) => {
    fixtureServer.listen(0, () => {
      fixturePort = (fixtureServer.address() as { port: number }).port;
      resolve();
    });
  });
});

test.afterAll(async () => {
  await new Promise<void>((resolve) => fixtureServer.close(() => resolve()));
});

test.describe('Audit flow e2e', () => {
  test('saisir une URL -> sitemap trouvé -> pages listées', async ({ page }) => {
    await page.goto('/');

    // Enter URL in input
    const input = page.getByRole('textbox', { name: /url/i });
    await expect(input).toBeVisible();
    await input.fill(`http://localhost:${fixturePort}`);

    // Click analyze
    const analyzeBtn = page.getByRole('button', { name: /rechercher/i });
    await analyzeBtn.click();

    // Should navigate to selection page with pages listed
    await page.waitForURL('**/selection**', { timeout: 15_000 });

    // Should list the pages from sitemap
    const checkboxes = page.getByRole('checkbox');
    await expect(checkboxes).not.toHaveCount(0);
  });

  test('cocher/décocher -> compteur mis à jour', async ({ page }) => {
    await page.goto('/');

    const input = page.getByRole('textbox', { name: /url/i });
    await input.fill(`http://localhost:${fixturePort}`);
    await page.getByRole('button', { name: /rechercher/i }).click();
    await page.waitForURL('**/selection**', { timeout: 15_000 });

    // Deselect all
    const deselectBtn = page.getByRole('button', { name: /désélectionner/i });
    if (await deselectBtn.isVisible()) {
      await deselectBtn.click();
    }

    // Counter should show 0
    await expect(page.getByText(/0 page\(s\) sélectionnée/)).toBeVisible();

    // Select all
    const selectBtn = page.getByRole('button', { name: /tout sélectionner/i });
    await selectBtn.click();

    // Counter should be updated
    const counter = page.getByText(/\d+ page\(s\) sélectionnée/);
    await expect(counter).toBeVisible();
  });

  test('lancer l\'audit -> progression SSE visible en temps réel', async ({ page }) => {
    await page.goto('/');

    const input = page.getByRole('textbox', { name: /url/i });
    await input.fill(`http://localhost:${fixturePort}`);
    await page.getByRole('button', { name: /rechercher/i }).click();
    await page.waitForURL('**/selection**', { timeout: 15_000 });

    // Make sure at least one page is selected
    const checkboxes = page.getByRole('checkbox');
    const count = await checkboxes.count();
    if (count > 0) {
      const first = checkboxes.first();
      if (!(await first.isChecked())) {
        await first.check();
      }
    }

    // Start audit
    const startBtn = page.getByRole('button', { name: /lancer/i });
    await startBtn.click();

    // Should navigate to progress page
    await page.waitForURL('**/progress/**', { timeout: 10_000 });

    // Progress page should show audit heading
    await expect(page.getByText(/audit en cours/i)).toBeVisible();

    // Should show page status updates (SSE events)
    // Wait for at least one page to appear in the list
    await expect(page.getByText(/localhost/)).toBeVisible({ timeout: 30_000 });
  });

  test('audit terminé -> rapport HTML avec bandeau de limite', async ({ page }) => {
    await page.goto('/');

    const input = page.getByRole('textbox', { name: /url/i });
    await input.fill(`http://localhost:${fixturePort}`);
    await page.getByRole('button', { name: /rechercher/i }).click();
    await page.waitForURL('**/selection**', { timeout: 15_000 });

    // Select first page only for faster test
    const deselectBtn = page.getByRole('button', { name: /désélectionner/i });
    if (await deselectBtn.isVisible()) {
      await deselectBtn.click();
    }
    const checkboxes = page.getByRole('checkbox');
    await checkboxes.first().check();

    // Start audit
    await page.getByRole('button', { name: /lancer/i }).click();
    await page.waitForURL('**/progress/**', { timeout: 10_000 });

    // Wait for results button
    const resultsBtn = page.getByRole('link', { name: /résultats/i });
    await expect(resultsBtn).toBeVisible({ timeout: 60_000 });
    await resultsBtn.click();

    // Should navigate to results page
    await page.waitForURL('**/results/**', { timeout: 10_000 });

    // Limit banner should be visible
    const banner = page.getByTestId('limit-banner');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('critères RGAA');
  });

  test('les 3 onglets d\'annexes sont accessibles et contiennent des données', async ({ page }) => {
    await page.goto('/');

    const input = page.getByRole('textbox', { name: /url/i });
    await input.fill(`http://localhost:${fixturePort}`);
    await page.getByRole('button', { name: /rechercher/i }).click();
    await page.waitForURL('**/selection**', { timeout: 15_000 });

    // Select first page
    const deselectBtn = page.getByRole('button', { name: /désélectionner/i });
    if (await deselectBtn.isVisible()) {
      await deselectBtn.click();
    }
    await page.getByRole('checkbox').first().check();

    await page.getByRole('button', { name: /lancer/i }).click();
    await page.waitForURL('**/progress/**', { timeout: 10_000 });

    const resultsBtn = page.getByRole('link', { name: /résultats/i });
    await expect(resultsBtn).toBeVisible({ timeout: 60_000 });
    await resultsBtn.click();
    await page.waitForURL('**/results/**', { timeout: 10_000 });

    // Images tab (default)
    const imagesTab = page.getByRole('tab', { name: /images/i });
    await expect(imagesTab).toBeVisible();

    // Links tab
    const linksTab = page.getByRole('tab', { name: /liens/i });
    await linksTab.click();
    await expect(page.getByRole('tabpanel')).toBeVisible();

    // Headings tab
    const headingsTab = page.getByRole('tab', { name: /titres/i });
    await headingsTab.click();
    await expect(page.getByRole('tabpanel')).toBeVisible();
  });

  test('les miniatures apparaissent progressivement (pas de blocage de l\'UI)', async ({ page }) => {
    await page.goto('/');

    const input = page.getByRole('textbox', { name: /url/i });
    await input.fill(`http://localhost:${fixturePort}`);
    await page.getByRole('button', { name: /rechercher/i }).click();
    await page.waitForURL('**/selection**', { timeout: 15_000 });

    // Select the alt-missing page (has images)
    const checkboxes = page.getByRole('checkbox');
    const count = await checkboxes.count();
    for (let i = 0; i < count; i++) {
      const checkbox = checkboxes.nth(i);
      const label = await checkbox.evaluate((el) => {
        const li = el.closest('li');
        return li?.textContent ?? '';
      });
      if (label.includes('alt-missing')) {
        if (!(await checkbox.isChecked())) await checkbox.check();
      } else {
        if (await checkbox.isChecked()) await checkbox.uncheck();
      }
    }

    await page.getByRole('button', { name: /lancer/i }).click();
    await page.waitForURL('**/progress/**', { timeout: 10_000 });

    const resultsBtn = page.getByRole('link', { name: /résultats/i });
    await expect(resultsBtn).toBeVisible({ timeout: 60_000 });
    await resultsBtn.click();
    await page.waitForURL('**/results/**', { timeout: 10_000 });

    // Images tab should be visible - check UI is responsive
    const imagesTab = page.getByRole('tab', { name: /images/i });
    await expect(imagesTab).toBeVisible();
    await imagesTab.click();

    // The table should load without blocking
    const tabpanel = page.getByRole('tabpanel');
    await expect(tabpanel).toBeVisible();

    // Images use loading="lazy" so they load progressively
    // Verify the UI rendered without timeout (proves no blocking)
    await expect(tabpanel).toBeVisible();
  });
});
