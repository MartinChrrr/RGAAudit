import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, type Browser, type BrowserContext } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

import fakeInteractiveHeuristic from '../fake-interactive-heuristic';

const FIXTURES_DIR = path.resolve(__dirname, '../../../../../e2e/fixtures/test-sites');

// ---------------------------------------------------------------------------
// HTTP fixture server
// ---------------------------------------------------------------------------

let server: http.Server;
let browser: Browser;
let context: BrowserContext;
let baseUrl: string;

function serveFixtures(): Promise<string> {
  return new Promise((resolve) => {
    server = http.createServer((req, res) => {
      const filePath = path.join(FIXTURES_DIR, req.url ?? '/');
      if (!fs.existsSync(filePath)) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      const content = fs.readFileSync(filePath, 'utf-8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(content);
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') {
        resolve(`http://127.0.0.1:${addr.port}`);
      }
    });
  });
}

beforeAll(async () => {
  baseUrl = await serveFixtures();
  browser = await chromium.launch();
  context = await browser.newContext();
});

afterAll(async () => {
  await context?.close();
  await browser?.close();
  server?.close();
});

// ---------------------------------------------------------------------------
// fake-link.html
// ---------------------------------------------------------------------------

describe('fake-interactive — fake-link.html', () => {
  it('détecte 1 finding "certain" FAKE_LINK sur <a href="#" onclick>', async () => {
    const page = await context.newPage();
    try {
      await page.goto(`${baseUrl}/interactive/fake-link.html`, { waitUntil: 'networkidle' });
      const result = await fakeInteractiveHeuristic.analyze(page);

      expect(result.error).toBeNull();
      expect(result.heuristicId).toBe('fake-interactive');
      expect(result.rgaaCriteria).toContain('7.1');

      const fakeLinks = result.findings.filter(
        (f) => f.confidence === 'certain' && f.evidence.includes('onclick'),
      );
      expect(fakeLinks.length).toBeGreaterThanOrEqual(1);

      // Le selector doit pointer vers le <a href="#" onclick>
      const hashLink = fakeLinks.find((f) => f.selector.includes('fake-link-hash'));
      expect(hashLink).toBeDefined();
    } finally {
      await page.close();
    }
  });

  it('ne détecte PAS le vrai lien /contact', async () => {
    const page = await context.newPage();
    try {
      await page.goto(`${baseUrl}/interactive/fake-link.html`, { waitUntil: 'networkidle' });
      const result = await fakeInteractiveHeuristic.analyze(page);

      const realLink = result.findings.find((f) => f.selector.includes('real-link'));
      expect(realLink).toBeUndefined();
    } finally {
      await page.close();
    }
  });
});

// ---------------------------------------------------------------------------
// fake-button.html
// ---------------------------------------------------------------------------

describe('fake-interactive — fake-button.html', () => {
  it('détecte DIV_CLICKABLE sur le <div onclick>', async () => {
    const page = await context.newPage();
    try {
      await page.goto(`${baseUrl}/interactive/fake-button.html`, { waitUntil: 'networkidle' });
      const result = await fakeInteractiveHeuristic.analyze(page);

      expect(result.error).toBeNull();

      const divClickable = result.findings.find(
        (f) => f.selector.includes('div-clickable') && f.confidence === 'certain',
      );
      expect(divClickable).toBeDefined();
      expect(divClickable!.evidence).toContain('div onclick');
    } finally {
      await page.close();
    }
  });

  it('détecte FAKE_BUTTON sur le <button> avec window.location', async () => {
    const page = await context.newPage();
    try {
      await page.goto(`${baseUrl}/interactive/fake-button.html`, { waitUntil: 'networkidle' });
      const result = await fakeInteractiveHeuristic.analyze(page);

      const fakeButton = result.findings.find(
        (f) => f.selector.includes('button-navigate') && f.confidence === 'likely',
      );
      expect(fakeButton).toBeDefined();
      expect(fakeButton!.evidence).toContain('naviguer');
    } finally {
      await page.close();
    }
  });

  it('ne détecte PAS le <button type="submit">', async () => {
    const page = await context.newPage();
    try {
      await page.goto(`${baseUrl}/interactive/fake-button.html`, { waitUntil: 'networkidle' });
      const result = await fakeInteractiveHeuristic.analyze(page);

      const realButton = result.findings.find((f) => f.selector.includes('real-button'));
      expect(realButton).toBeUndefined();
    } finally {
      await page.close();
    }
  });
});

// ---------------------------------------------------------------------------
// missing-role.html
// ---------------------------------------------------------------------------

describe('fake-interactive — missing-role.html', () => {
  it('détecte "certain" sur <span role="button"> sans tabindex', async () => {
    const page = await context.newPage();
    try {
      await page.goto(`${baseUrl}/interactive/missing-role.html`, { waitUntil: 'networkidle' });
      const result = await fakeInteractiveHeuristic.analyze(page);

      expect(result.error).toBeNull();

      const noTabindex = result.findings.find(
        (f) => f.selector.includes('no-tabindex') && f.confidence === 'certain',
      );
      expect(noTabindex).toBeDefined();
      expect(noTabindex!.evidence).toContain('tabindex');
    } finally {
      await page.close();
    }
  });

  it('ne détecte PAS le <span role="button" tabindex="0">', async () => {
    const page = await context.newPage();
    try {
      await page.goto(`${baseUrl}/interactive/missing-role.html`, { waitUntil: 'networkidle' });
      const result = await fakeInteractiveHeuristic.analyze(page);

      const withTabindex = result.findings.find((f) => f.selector.includes('with-tabindex'));
      expect(withTabindex).toBeUndefined();
    } finally {
      await page.close();
    }
  });
});

// ---------------------------------------------------------------------------
// Page propre — pas de faux positifs
// ---------------------------------------------------------------------------

describe('fake-interactive — clean-page.html', () => {
  it('findings: [] sur une page sans éléments suspects', async () => {
    const page = await context.newPage();
    try {
      await page.goto(`${baseUrl}/interactive/clean-page.html`, { waitUntil: 'networkidle' });
      const result = await fakeInteractiveHeuristic.analyze(page);

      expect(result.error).toBeNull();
      expect(result.findings).toHaveLength(0);
    } finally {
      await page.close();
    }
  });
});

// ---------------------------------------------------------------------------
// Robustesse — ne throw jamais
// ---------------------------------------------------------------------------

describe('fake-interactive — robustesse', () => {
  it('analyze() ne throw jamais — retourne { findings: [], error } si la page crash', async () => {
    const page = await context.newPage();
    try {
      // Navigate to a non-existent page — should not throw
      await page.goto(`${baseUrl}/nonexistent.html`, { waitUntil: 'domcontentloaded' }).catch(() => {});
      const result = await fakeInteractiveHeuristic.analyze(page);

      expect(result).toBeDefined();
      expect(result.heuristicId).toBe('fake-interactive');
      expect(Array.isArray(result.findings)).toBe(true);
      // May or may not have an error — but should NOT throw
    } finally {
      await page.close();
    }
  });
});
