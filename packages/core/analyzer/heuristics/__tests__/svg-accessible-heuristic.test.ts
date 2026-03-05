import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, type Browser, type BrowserContext } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

import svgAccessibleHeuristic from '../svg-accessible-heuristic';

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
// svg-no-title.html
// ---------------------------------------------------------------------------

describe('svg-accessible — svg-no-title.html', () => {
  it('détecte finding "certain" sur le <svg role="img"> sans <title>', async () => {
    const page = await context.newPage();
    try {
      await page.goto(`${baseUrl}/svg/svg-no-title.html`, { waitUntil: 'networkidle' });
      const result = await svgAccessibleHeuristic.analyze(page);

      expect(result.error).toBeNull();
      expect(result.heuristicId).toBe('svg-accessible');
      expect(result.rgaaCriteria).toContain('1.1');

      const noTitle = result.findings.find(
        (f) => f.selector.includes('svg-no-title') && f.confidence === 'certain',
      );
      expect(noTitle).toBeDefined();
      expect(noTitle!.evidence).toContain('<title>');
    } finally {
      await page.close();
    }
  });

  it('le <svg> avec <title> n\'est PAS dans les findings', async () => {
    const page = await context.newPage();
    try {
      await page.goto(`${baseUrl}/svg/svg-no-title.html`, { waitUntil: 'networkidle' });
      const result = await svgAccessibleHeuristic.analyze(page);

      const withTitle = result.findings.find((f) => f.selector.includes('svg-with-title'));
      expect(withTitle).toBeUndefined();
    } finally {
      await page.close();
    }
  });
});

// ---------------------------------------------------------------------------
// svg-icon-button.html
// ---------------------------------------------------------------------------

describe('svg-accessible — svg-icon-button.html', () => {
  it('détecte finding "certain" sur le <button> sans label', async () => {
    const page = await context.newPage();
    try {
      await page.goto(`${baseUrl}/svg/svg-icon-button.html`, { waitUntil: 'networkidle' });
      const result = await svgAccessibleHeuristic.analyze(page);

      expect(result.error).toBeNull();

      const noLabel = result.findings.find(
        (f) => f.selector.includes('btn-no-label') && f.confidence === 'certain',
      );
      expect(noLabel).toBeDefined();
      expect(noLabel!.evidence).toContain('sans label');
    } finally {
      await page.close();
    }
  });

  it('le <button aria-label> n\'est PAS dans les findings', async () => {
    const page = await context.newPage();
    try {
      await page.goto(`${baseUrl}/svg/svg-icon-button.html`, { waitUntil: 'networkidle' });
      const result = await svgAccessibleHeuristic.analyze(page);

      const withLabel = result.findings.find((f) => f.selector.includes('btn-with-label'));
      expect(withLabel).toBeUndefined();
    } finally {
      await page.close();
    }
  });

  it('le <button> avec texte visible n\'est PAS dans les findings', async () => {
    const page = await context.newPage();
    try {
      await page.goto(`${baseUrl}/svg/svg-icon-button.html`, { waitUntil: 'networkidle' });
      const result = await svgAccessibleHeuristic.analyze(page);

      const withText = result.findings.find((f) => f.selector.includes('btn-with-text'));
      expect(withText).toBeUndefined();
    } finally {
      await page.close();
    }
  });
});

// ---------------------------------------------------------------------------
// svg-decorative.html
// ---------------------------------------------------------------------------

describe('svg-accessible — svg-decorative.html', () => {
  it('détecte finding "likely" sur le <svg> sans aria-hidden', async () => {
    const page = await context.newPage();
    try {
      await page.goto(`${baseUrl}/svg/svg-decorative.html`, { waitUntil: 'networkidle' });
      const result = await svgAccessibleHeuristic.analyze(page);

      expect(result.error).toBeNull();

      const smallSvg = result.findings.find(
        (f) => f.selector.includes('svg-small-no-hidden') && f.confidence === 'likely',
      );
      expect(smallSvg).toBeDefined();
      expect(smallSvg!.evidence).toContain('aria-hidden');
    } finally {
      await page.close();
    }
  });

  it('le <svg aria-hidden> n\'est PAS dans les findings', async () => {
    const page = await context.newPage();
    try {
      await page.goto(`${baseUrl}/svg/svg-decorative.html`, { waitUntil: 'networkidle' });
      const result = await svgAccessibleHeuristic.analyze(page);

      const hidden = result.findings.find((f) => f.selector.includes('svg-aria-hidden'));
      expect(hidden).toBeUndefined();
    } finally {
      await page.close();
    }
  });
});

// ---------------------------------------------------------------------------
// Robustesse
// ---------------------------------------------------------------------------

describe('svg-accessible — robustesse', () => {
  it('analyze() ne throw jamais', async () => {
    const page = await context.newPage();
    try {
      await page.goto(`${baseUrl}/nonexistent.html`, { waitUntil: 'domcontentloaded' }).catch(() => {});
      const result = await svgAccessibleHeuristic.analyze(page);

      expect(result).toBeDefined();
      expect(result.heuristicId).toBe('svg-accessible');
      expect(Array.isArray(result.findings)).toBe(true);
    } finally {
      await page.close();
    }
  });
});
