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

  it('détecte les cadres sans titre via frame-title', async () => {
    const adapter = new AxeCoreAdapter();
    await withPage(`${baseUrl}/frames/missing-title.html`, async (page) => {
      const result = await adapter.analyze(page);
      const { violations } = result as EngineResult;
      const frameTitle = violations.find((violation) => violation.rule === 'frame-title');

      expect(frameTitle).toBeDefined();
      expect(frameTitle!.elements).toHaveLength(2);
    });
  });

  it('couvre html-lang-valid sur une fixture invalide', async () => {
    const adapter = new AxeCoreAdapter();
    await withPage(`${baseUrl}/structure/invalid-language.html`, async (page) => {
      const result = await adapter.analyze(page);
      const { violations } = result as EngineResult;
      const rules = new Set(violations.map((violation) => violation.rule));

      expect(rules.has('html-lang-valid')).toBe(true);
      expect(violations.find((violation) => violation.rule === 'html-lang-valid')?.elements[0]?.target.length)
        .toBeGreaterThan(0);
    });
  });

  it('couvre html-has-lang sur une page sans langue par défaut', async () => {
    const adapter = new AxeCoreAdapter();
    await withPage(`${baseUrl}/structure/missing-language.html`, async (page) => {
      const result = await adapter.analyze(page);
      const { violations } = result as EngineResult;

      expect(violations.find((violation) => violation.rule === 'html-has-lang')?.elements[0]?.target.length)
        .toBeGreaterThan(0);
    });
  });

  it('couvre html-xml-lang-mismatch et valid-lang sur des fixtures dédiées', async () => {
    const adapter = new AxeCoreAdapter();

    await withPage(`${baseUrl}/structure/mismatched-language.html`, async (page) => {
      const result = await adapter.analyze(page);
      const { violations } = result as EngineResult;
      expect(violations.find((violation) => violation.rule === 'html-xml-lang-mismatch')?.elements[0]?.target.length)
        .toBeGreaterThan(0);
    });

    await withPage(`${baseUrl}/structure/invalid-inline-language.html`, async (page) => {
      const result = await adapter.analyze(page);
      const { violations } = result as EngineResult;
      expect(violations.find((violation) => violation.rule === 'valid-lang')?.elements[0]?.target.length)
        .toBeGreaterThan(0);
    });
  });

  it('couvre les règles de structure des listes de US-04', async () => {
    const adapter = new AxeCoreAdapter();
    await withPage(`${baseUrl}/structure/invalid-lists.html`, async (page) => {
      const result = await adapter.analyze(page);
      const { violations } = result as EngineResult;
      const rules = new Set(violations.map((violation) => violation.rule));

      expect(rules.has('list')).toBe(true);
      expect(rules.has('listitem')).toBe(true);
      expect(rules.has('definition-list')).toBe(true);
    });
  });

  it('couvre les règles déterministes de US-06 sur tableaux, liens, formulaires, navigation et orientation', async () => {
    const adapter = new AxeCoreAdapter();

    await withPage(`${baseUrl}/tables/invalid-headers.html`, async (page) => {
      const result = await adapter.analyze(page) as EngineResult;
      const rules = new Set(result.violations.map((item) => item.rule));
      expect(rules.has('td-headers-attr')).toBe(true);
      expect(rules.has('scope-attr-valid')).toBe(true);
    });

    await withPage(`${baseUrl}/tables/fake-caption.html`, async (page) => {
      const result = await adapter.analyze(page) as EngineResult;
      const violation = result.violations.find((item) => item.rule === 'table-fake-caption');
      expect(violation).toBeDefined();
      expect(violation!.elements[0].target).toContain('#fake-caption');
    });

    await withPage(`${baseUrl}/links/ununderlined.html`, async (page) => {
      const result = await adapter.analyze(page) as EngineResult;
      const violation = result.violations.find((item) => item.rule === 'link-in-text-block');
      expect(violation).toBeDefined();
      expect(violation!.elements[0].target).toContain('#subtle-link');
    });

    await withPage(`${baseUrl}/presentation/inline-spacing.html`, async (page) => {
      const result = await adapter.analyze(page) as EngineResult;
      const violation = result.violations.find((item) => item.rule === 'avoid-inline-spacing');
      expect(violation).toBeDefined();
      expect(violation!.elements[0].target).toContain('#inline-spacing');
    });

    await withPage(`${baseUrl}/forms/missing-label.html`, async (page) => {
      const result = await adapter.analyze(page) as EngineResult;
      const rules = new Set(result.violations.map((item) => item.rule));
      expect(rules.has('label')).toBe(true);
      expect(rules.has('select-name')).toBe(true);
    });

    await withPage(`${baseUrl}/forms/invalid-autocomplete.html`, async (page) => {
      const result = await adapter.analyze(page) as EngineResult;
      const violation = result.violations.find((item) => item.rule === 'autocomplete-valid');
      expect(violation).toBeDefined();
      expect(violation!.elements[0].target).toContain('#email');
    });

    await withPage(`${baseUrl}/navigation/broken-skip-link.html`, async (page) => {
      const result = await adapter.analyze(page) as EngineResult;
      const violation = result.violations.find((item) => item.rule === 'skip-link');
      expect(violation).toBeDefined();
      expect(violation!.elements[0].target).toContain('#broken-skip');
    });

    await withPage(`${baseUrl}/navigation/duplicate-accesskeys.html`, async (page) => {
      const result = await adapter.analyze(page) as EngineResult;
      const violation = result.violations.find((item) => item.rule === 'accesskeys');
      expect(violation).toBeDefined();
      expect(violation!.elements.length).toBeGreaterThanOrEqual(1);
    });

    await withPage(`${baseUrl}/orientation/locked.html`, async (page) => {
      const result = await adapter.analyze(page) as EngineResult;
      const violation = result.violations.find((item) => item.rule === 'css-orientation-lock');
      expect(violation).toBeDefined();
      expect(violation!.elements.length).toBeGreaterThan(0);
    });
  }, 30_000);

  it('ne signale pas les fixtures conformes de US-06', async () => {
    const adapter = new AxeCoreAdapter();
    const cases: Array<[string, string]> = [
      ['/tables/valid-headers.html', 'td-headers-attr'],
      ['/tables/valid-headers.html', 'scope-attr-valid'],
      ['/tables/with-caption.html', 'table-fake-caption'],
      ['/links/underlined.html', 'link-in-text-block'],
      ['/presentation/external-spacing.html', 'avoid-inline-spacing'],
      ['/forms/valid.html', 'label'],
      ['/forms/valid.html', 'select-name'],
      ['/forms/valid.html', 'autocomplete-valid'],
      ['/navigation/with-skip-link.html', 'skip-link'],
      ['/navigation/unique-accesskeys.html', 'accesskeys'],
      ['/orientation/unlocked.html', 'css-orientation-lock'],
    ];

    for (const [path, rule] of cases) {
      await withPage(`${baseUrl}${path}`, async (page) => {
        const result = await adapter.analyze(page) as EngineResult;
        expect(result.violations.find((item) => item.rule === rule), `${path} should pass ${rule}`).toBeUndefined();
      });
    }
  }, 30_000);

  it('ne signale pas frame-title pour un cadre correctement titré', async () => {
    const adapter = new AxeCoreAdapter();
    await withPage(`${baseUrl}/frames/with-title.html`, async (page) => {
      const result = await adapter.analyze(page);
      const { violations } = result as EngineResult;

      expect(violations.find((violation) => violation.rule === 'frame-title')).toBeUndefined();
    });
  });

  it('détecte le contraste insuffisant via color-contrast', async () => {
    const adapter = new AxeCoreAdapter();
    await withPage(`${baseUrl}/contrast/low-contrast.html`, async (page) => {
      const result = await adapter.analyze(page);

      expect(result.error).toBeUndefined();
      const { violations } = result as EngineResult;
      const colorContrast = violations.find((v) => v.rule === 'color-contrast');

      expect(colorContrast).toBeDefined();
      expect(colorContrast!.elements.length).toBeGreaterThanOrEqual(1);

      // Verify data propagation (contrastRatio from axe-core)
      const firstEl = colorContrast!.elements[0];
      expect(firstEl.data).toBeDefined();
      expect(firstEl.data!.contrastRatio).toBeDefined();
    });
  });

  it('aucune violation contraste sur page avec bon contraste', async () => {
    const adapter = new AxeCoreAdapter();
    await withPage(`${baseUrl}/contrast/good-contrast.html`, async (page) => {
      const result = await adapter.analyze(page);

      expect(result.error).toBeUndefined();
      const { violations } = result as EngineResult;
      const colorContrast = violations.find((v) => v.rule === 'color-contrast');
      expect(colorContrast).toBeUndefined();
    });
  });

  it('disableRules exclut color-contrast du scan', async () => {
    const adapter = new AxeCoreAdapter({
      disableRules: ['color-contrast', 'color-contrast-enhanced'],
    });
    await withPage(`${baseUrl}/contrast/low-contrast.html`, async (page) => {
      const result = await adapter.analyze(page);

      expect(result.error).toBeUndefined();
      const { violations } = result as EngineResult;
      const colorContrast = violations.find((v) => v.rule === 'color-contrast');
      expect(colorContrast).toBeUndefined();
    });
  });
});
