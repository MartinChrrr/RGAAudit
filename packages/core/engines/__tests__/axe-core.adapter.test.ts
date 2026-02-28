import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { AxeCoreAdapter } from '../axe-core.adapter';
import type { EngineResult } from '../engine.interface';

const FIXTURES_DIR = path.resolve(__dirname, '../../../../e2e/fixtures/test-sites');

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

async function withPage(url: string, fn: (page: Page) => Promise<void>): Promise<void> {
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await fn(page);
  } finally {
    await page.close();
  }
}

describe('AxeCoreAdapter', () => {
  it('retourne le format { violations, passes, incomplete }', async () => {
    const adapter = new AxeCoreAdapter();
    await withPage(`${baseUrl}/images/alt-missing.html`, async (page) => {
      const result = await adapter.analyze(page);

      expect(result.error).toBeUndefined();
      expect(result).toHaveProperty('violations');
      expect(result).toHaveProperty('passes');
      expect(result).toHaveProperty('incomplete');
      expect(Array.isArray(result.violations)).toBe(true);
      expect(Array.isArray(result.passes)).toBe(true);
      expect(Array.isArray(result.incomplete)).toBe(true);
    });
  });

  it('chaque violation contient { rule, impact, elements[] }', async () => {
    const adapter = new AxeCoreAdapter();
    await withPage(`${baseUrl}/images/alt-missing.html`, async (page) => {
      const result = await adapter.analyze(page);

      expect(result.error).toBeUndefined();
      const { violations } = result as EngineResult;
      expect(violations.length).toBeGreaterThan(0);

      for (const violation of violations) {
        expect(violation).toHaveProperty('rule');
        expect(typeof violation.rule).toBe('string');
        expect(violation).toHaveProperty('impact');
        expect(['minor', 'moderate', 'serious', 'critical']).toContain(violation.impact);
        expect(violation).toHaveProperty('description');
        expect(typeof violation.description).toBe('string');
        expect(violation).toHaveProperty('helpUrl');
        expect(typeof violation.helpUrl).toBe('string');
        expect(violation).toHaveProperty('elements');
        expect(Array.isArray(violation.elements)).toBe(true);
        expect(violation.elements.length).toBeGreaterThan(0);

        for (const el of violation.elements) {
          expect(el).toHaveProperty('html');
          expect(typeof el.html).toBe('string');
          expect(el).toHaveProperty('target');
          expect(Array.isArray(el.target)).toBe(true);
        }
      }
    });
  });

  it('détecte les images sans alt via la règle image-alt', async () => {
    const adapter = new AxeCoreAdapter();
    await withPage(`${baseUrl}/images/alt-missing.html`, async (page) => {
      const result = await adapter.analyze(page);
      const { violations } = result as EngineResult;
      const imageAlt = violations.find((v) => v.rule === 'image-alt');

      expect(imageAlt).toBeDefined();
      expect(imageAlt!.impact).toBe('critical');
      expect(imageAlt!.elements.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('gère une page avec 0 violation', async () => {
    const adapter = new AxeCoreAdapter();
    await withPage(`${baseUrl}/valid-page.html`, async (page) => {
      const result = await adapter.analyze(page);

      expect(result.error).toBeUndefined();
      const { violations } = result as EngineResult;
      expect(violations.length).toBe(0);
    });
  });

  it('retourne des passes pour une page valide', async () => {
    const adapter = new AxeCoreAdapter();
    await withPage(`${baseUrl}/valid-page.html`, async (page) => {
      const result = await adapter.analyze(page);
      const { passes } = result as EngineResult;

      expect(passes.length).toBeGreaterThan(0);
      for (const pass of passes) {
        expect(pass).toHaveProperty('rule');
        expect(pass).toHaveProperty('description');
        expect(pass).toHaveProperty('elements');
      }
    });
  });

  it('ne throw jamais — retourne { error } en cas de timeout', async () => {
    const adapter = new AxeCoreAdapter({ timeout: 1 });
    await withPage(`${baseUrl}/images/alt-missing.html`, async (page) => {
      const result = await adapter.analyze(page);

      expect(result.error).toBeDefined();
      expect(typeof result.error).toBe('string');
      expect(result.violations).toBeUndefined();
      expect(result.passes).toBeUndefined();
      expect(result.incomplete).toBeUndefined();
    });
  });

  it('détecte les liens vides', async () => {
    const adapter = new AxeCoreAdapter();
    await withPage(`${baseUrl}/links/empty-links.html`, async (page) => {
      const result = await adapter.analyze(page);
      const { violations } = result as EngineResult;
      const linkName = violations.find((v) => v.rule === 'link-name');

      expect(linkName).toBeDefined();
      expect(linkName!.elements.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('détecte le saut de niveau de titre', async () => {
    const adapter = new AxeCoreAdapter();
    await withPage(`${baseUrl}/headings/level-skip.html`, async (page) => {
      const result = await adapter.analyze(page);
      const { violations } = result as EngineResult;
      const headingOrder = violations.find((v) => v.rule === 'heading-order');

      expect(headingOrder).toBeDefined();
      expect(headingOrder!.elements.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('retourne un résultat pour les images décoratives', async () => {
    const adapter = new AxeCoreAdapter();
    await withPage(`${baseUrl}/images/alt-decorative.html`, async (page) => {
      const result = await adapter.analyze(page);

      expect(result.error).toBeUndefined();
      const { violations } = result as EngineResult;
      const imageAlt = violations.find((v) => v.rule === 'image-alt');
      expect(imageAlt).toBeUndefined();
    });
  });
});
