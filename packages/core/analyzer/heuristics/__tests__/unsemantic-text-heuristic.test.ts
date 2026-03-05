import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, type Browser, type BrowserContext } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

import unsemanticTextHeuristic from '../unsemantic-text-heuristic';

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
// fake-heading.html
// ---------------------------------------------------------------------------

describe('unsemantic-text — fake-heading.html', () => {
  it('détecte 1+ finding "likely" FAKE_HEADING sur le <div> stylé', async () => {
    const page = await context.newPage();
    try {
      await page.goto(`${baseUrl}/semantic/fake-heading.html`, { waitUntil: 'networkidle' });
      const result = await unsemanticTextHeuristic.analyze(page);

      expect(result.error).toBeNull();
      expect(result.heuristicId).toBe('unsemantic-text');
      expect(result.rgaaCriteria).toContain('8.9');

      const fakeHeadings = result.findings.filter(
        (f) => f.confidence === 'likely' && f.evidence.includes('titre'),
      );
      expect(fakeHeadings.length).toBeGreaterThanOrEqual(1);

      const boldHeading = fakeHeadings.find((f) => f.selector.includes('fake-heading-bold'));
      expect(boldHeading).toBeDefined();
    } finally {
      await page.close();
    }
  });

  it('le <h2> n\'est PAS dans les findings', async () => {
    const page = await context.newPage();
    try {
      await page.goto(`${baseUrl}/semantic/fake-heading.html`, { waitUntil: 'networkidle' });
      const result = await unsemanticTextHeuristic.analyze(page);

      const realHeading = result.findings.find((f) => f.selector.includes('real-heading'));
      expect(realHeading).toBeUndefined();
    } finally {
      await page.close();
    }
  });

  it('le <div> dans <nav> n\'est PAS dans les findings', async () => {
    const page = await context.newPage();
    try {
      await page.goto(`${baseUrl}/semantic/fake-heading.html`, { waitUntil: 'networkidle' });
      const result = await unsemanticTextHeuristic.analyze(page);

      const navHeading = result.findings.find((f) => f.selector.includes('nav-heading'));
      expect(navHeading).toBeUndefined();
    } finally {
      await page.close();
    }
  });
});

// ---------------------------------------------------------------------------
// fake-paragraph.html
// ---------------------------------------------------------------------------

describe('unsemantic-text — fake-paragraph.html', () => {
  it('détecte finding "certain" FAKE_PARAGRAPH sur le <div> avec <br><br>', async () => {
    const page = await context.newPage();
    try {
      await page.goto(`${baseUrl}/semantic/fake-paragraph.html`, { waitUntil: 'networkidle' });
      const result = await unsemanticTextHeuristic.analyze(page);

      expect(result.error).toBeNull();

      const fakeParagraph = result.findings.find(
        (f) => f.selector.includes('fake-paragraph') && f.confidence === 'certain',
      );
      expect(fakeParagraph).toBeDefined();
      expect(fakeParagraph!.evidence).toContain('<br>');
    } finally {
      await page.close();
    }
  });

  it('le <p> avec <br> simple n\'est PAS dans les findings', async () => {
    const page = await context.newPage();
    try {
      await page.goto(`${baseUrl}/semantic/fake-paragraph.html`, { waitUntil: 'networkidle' });
      const result = await unsemanticTextHeuristic.analyze(page);

      const realParagraph = result.findings.find((f) => f.selector.includes('real-paragraph'));
      expect(realParagraph).toBeUndefined();
    } finally {
      await page.close();
    }
  });
});

// ---------------------------------------------------------------------------
// fake-list.html
// ---------------------------------------------------------------------------

describe('unsemantic-text — fake-list.html', () => {
  it('détecte finding "likely" FAKE_LIST sur les 3 <div> avec "•"', async () => {
    const page = await context.newPage();
    try {
      await page.goto(`${baseUrl}/semantic/fake-list.html`, { waitUntil: 'networkidle' });
      const result = await unsemanticTextHeuristic.analyze(page);

      expect(result.error).toBeNull();

      const fakeLists = result.findings.filter(
        (f) => f.confidence === 'likely' && f.evidence.includes('<ul><li>'),
      );
      expect(fakeLists.length).toBeGreaterThanOrEqual(1);

      const bulletList = fakeLists.find((f) => f.selector.includes('fake-list'));
      expect(bulletList).toBeDefined();
    } finally {
      await page.close();
    }
  });

  it('les 2 <div> avec "•" (sous le seuil de 3) ne sont PAS détectés', async () => {
    const page = await context.newPage();
    try {
      await page.goto(`${baseUrl}/semantic/fake-list.html`, { waitUntil: 'networkidle' });
      const result = await unsemanticTextHeuristic.analyze(page);

      const shortList = result.findings.find((f) => f.selector.includes('short-list'));
      expect(shortList).toBeUndefined();
    } finally {
      await page.close();
    }
  });

  it('le <ul> n\'est PAS dans les findings', async () => {
    const page = await context.newPage();
    try {
      await page.goto(`${baseUrl}/semantic/fake-list.html`, { waitUntil: 'networkidle' });
      const result = await unsemanticTextHeuristic.analyze(page);

      const realList = result.findings.find((f) => f.selector.includes('real-list'));
      expect(realList).toBeUndefined();
    } finally {
      await page.close();
    }
  });
});

// ---------------------------------------------------------------------------
// correct-semantic.html — zéro faux positif
// ---------------------------------------------------------------------------

describe('unsemantic-text — correct-semantic.html', () => {
  it('findings: [] sur une page sans éléments suspects', async () => {
    const page = await context.newPage();
    try {
      await page.goto(`${baseUrl}/semantic/correct-semantic.html`, { waitUntil: 'networkidle' });
      const result = await unsemanticTextHeuristic.analyze(page);

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

describe('unsemantic-text — robustesse', () => {
  it('analyze() ne throw jamais — retourne { findings: [], error } si la page crash', async () => {
    const page = await context.newPage();
    try {
      await page.goto(`${baseUrl}/nonexistent.html`, { waitUntil: 'domcontentloaded' }).catch(() => {});
      const result = await unsemanticTextHeuristic.analyze(page);

      expect(result).toBeDefined();
      expect(result.heuristicId).toBe('unsemantic-text');
      expect(Array.isArray(result.findings)).toBe(true);
    } finally {
      await page.close();
    }
  });
});

// ---------------------------------------------------------------------------
// Performance — < 2s sur une page de 200 éléments
// ---------------------------------------------------------------------------

describe('unsemantic-text — performance', () => {
  it('s\'exécute en < 2s sur une page de 200 éléments', async () => {
    const page = await context.newPage();
    try {
      // Generate a page with 200 div elements inline
      const divs = Array.from({ length: 200 }, (_, i) =>
        `<div style="font-size:14px">Contenu standard ${i}</div>`,
      ).join('\n');
      await page.setContent(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Perf</title></head><body>${divs}</body></html>`);

      const start = Date.now();
      const result = await unsemanticTextHeuristic.analyze(page);
      const elapsed = Date.now() - start;

      expect(result.error).toBeNull();
      expect(elapsed).toBeLessThan(2000);
    } finally {
      await page.close();
    }
  });
});
