import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { collectImages, collectLinks, collectHeadings, collectAll } from '../data-collector';

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

async function withPage<T>(url: string, fn: (page: Page) => Promise<T>): Promise<T> {
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    return await fn(page);
  } finally {
    await page.close();
  }
}

// ───────────────────────────────────────────────────────────────
// collectImages
// ───────────────────────────────────────────────────────────────

describe('collectImages', () => {
  it('alt absent (null), vide (""), présent (string)', async () => {
    const images = await withPage(`${baseUrl}/images/alt-missing.html`, collectImages);

    const absent = images.filter((img) => img.altStatus === 'absent');
    const empty = images.filter((img) => img.altStatus === 'empty');
    const present = images.filter((img) => img.altStatus === 'present');

    expect(absent.length).toBeGreaterThanOrEqual(2);
    expect(empty.length).toBeGreaterThanOrEqual(1);
    expect(present.length).toBeGreaterThanOrEqual(1);

    for (const img of absent) {
      expect(img.altAttribute).toBeNull();
    }
    for (const img of empty) {
      expect(img.altAttribute).toBe('');
    }
    for (const img of present) {
      expect(img.altAttribute).not.toBeNull();
      expect(img.altAttribute!.length).toBeGreaterThan(0);
    }
  });

  it('ALT_GENERIC sur "photo", "image", "DSC_1234.jpg"', async () => {
    const images = await withPage(`${baseUrl}/images/alt-generic.html`, collectImages);

    const photoImg = images.find((img) => img.altAttribute === 'photo');
    expect(photoImg).toBeDefined();
    expect(photoImg!.flags).toContain('ALT_GENERIC');

    const imageImg = images.find((img) => img.altAttribute === 'image');
    expect(imageImg).toBeDefined();
    expect(imageImg!.flags).toContain('ALT_GENERIC');

    const dscImg = images.find((img) => img.altAttribute === 'DSC_1234.jpg');
    expect(dscImg).toBeDefined();
    expect(dscImg!.flags).toContain('ALT_GENERIC');
  });

  it('ALT_TOO_LONG si alt > 80 chars', async () => {
    const images = await withPage(`${baseUrl}/images/alt-generic.html`, collectImages);

    const longAlt = images.find((img) => img.altAttribute && img.altAttribute.length > 80);
    expect(longAlt).toBeDefined();
    expect(longAlt!.flags).toContain('ALT_TOO_LONG');
  });

  it('isInLink et linkText corrects', async () => {
    const images = await withPage(`${baseUrl}/images/img-in-link.html`, collectImages);

    const inLink = images.filter((img) => img.isInLink);
    expect(inLink.length).toBeGreaterThanOrEqual(2);

    // Image in link with alt=""
    const emptyAltInLink = inLink.find((img) => img.altAttribute === '');
    expect(emptyAltInLink).toBeDefined();
    expect(emptyAltInLink!.linkHref).toBe('/page');
    expect(emptyAltInLink!.flags).toContain('IMG_IN_LINK_ALT_EMPTY');

    // Image in link with descriptive alt
    const withAltInLink = inLink.find((img) => img.altAttribute === 'Voir la photo');
    expect(withAltInLink).toBeDefined();
    expect(withAltInLink!.linkHref).toBe('/other');
    expect(withAltInLink!.flags).not.toContain('IMG_IN_LINK_ALT_EMPTY');
  });

  it('ROLE_PRESENTATION_SUSPICIOUS quand role="presentation" avec alt non vide', async () => {
    const images = await withPage(`${baseUrl}/images/alt-decorative.html`, collectImages);

    const suspect = images.find((img) => img.altAttribute === 'Texte suspect');
    expect(suspect).toBeDefined();
    expect(suspect!.rolePresentation).toBe(true);
    expect(suspect!.flags).toContain('ROLE_PRESENTATION_SUSPICIOUS');

    // Image décorative correcte : role="presentation" + alt=""
    const decorative = images.find((img) => img.src.includes('decoration.png'));
    expect(decorative).toBeDefined();
    expect(decorative!.rolePresentation).toBe(true);
    expect(decorative!.flags).not.toContain('ROLE_PRESENTATION_SUSPICIOUS');
  });

  it('ALT_ABSENT flag sur images sans alt', async () => {
    const images = await withPage(`${baseUrl}/images/alt-missing.html`, collectImages);
    const absent = images.filter((img) => img.flags.includes('ALT_ABSENT'));
    expect(absent.length).toBeGreaterThanOrEqual(2);
    for (const img of absent) {
      expect(img.altAttribute).toBeNull();
      expect(img.automatedStatus).toBe('violation');
    }
  });
});

// ───────────────────────────────────────────────────────────────
// collectLinks
// ───────────────────────────────────────────────────────────────

describe('collectLinks', () => {
  it('accessibleLabel calculé dans le bon ordre de priorité', async () => {
    const links = await withPage(`${baseUrl}/links/generic-links.html`, collectLinks);

    // aria-labelledby prend la priorité
    const ariaLabelledby = links.find((l) => l.href === '/page7');
    expect(ariaLabelledby).toBeDefined();
    expect(ariaLabelledby!.accessibleLabel).toBe('Description référencée');

    // aria-label prend la priorité sur le texte visible
    const ariaLabel = links.find((l) => l.href === '/page8');
    expect(ariaLabel).toBeDefined();
    expect(ariaLabel!.accessibleLabel).toBe('Label aria prioritaire');

    // alt img enfant comme label
    const imgAlt = links.find((l) => l.href === '/page9');
    expect(imgAlt).toBeDefined();
    expect(imgAlt!.accessibleLabel).toBe('Accueil');

    // title comme fallback
    const titleLink = links.find((l) => l.href === '/page10');
    expect(titleLink).toBeDefined();
    expect(titleLink!.accessibleLabel).toBe('Titre du lien');
  });

  it('GENERIC_LABEL lu depuis rgaa-4.1.json (pas hardcodé)', async () => {
    const links = await withPage(`${baseUrl}/links/generic-links.html`, collectLinks);

    const genericLinks = links.filter((l) => l.flags.includes('GENERIC_LABEL'));
    expect(genericLinks.length).toBeGreaterThanOrEqual(3);

    // "lire la suite" est dans le mapping
    const lireLaSuite = links.filter(
      (l) => l.accessibleLabel?.toLowerCase() === 'lire la suite'
    );
    for (const l of lireLaSuite) {
      expect(l.flags).toContain('GENERIC_LABEL');
    }

    // "en savoir plus" est dans le mapping
    const enSavoirPlus = links.find(
      (l) => l.accessibleLabel?.toLowerCase() === 'en savoir plus'
    );
    expect(enSavoirPlus).toBeDefined();
    expect(enSavoirPlus!.flags).toContain('GENERIC_LABEL');

    // "cliquez ici" est dans le mapping
    const cliquezIci = links.find(
      (l) => l.accessibleLabel?.toLowerCase() === 'cliquez ici'
    );
    expect(cliquezIci).toBeDefined();
    expect(cliquezIci!.flags).toContain('GENERIC_LABEL');

    // Le lien explicite n'est PAS générique
    const explicit = links.find((l) => l.href === '/page6');
    expect(explicit).toBeDefined();
    expect(explicit!.flags).not.toContain('GENERIC_LABEL');
  });

  it('EMPTY_LABEL sur liens vides', async () => {
    const links = await withPage(`${baseUrl}/links/empty-links.html`, collectLinks);

    const emptyLinks = links.filter((l) => l.flags.includes('EMPTY_LABEL'));
    expect(emptyLinks.length).toBeGreaterThanOrEqual(2);
  });

  it('NEW_WINDOW_NO_WARNING sur target="_blank" sans avertissement', async () => {
    const links = await withPage(`${baseUrl}/links/new-window.html`, collectLinks);

    // Premier lien : target="_blank" SANS warning
    const noWarning = links.find((l) => l.href === '/external');
    expect(noWarning).toBeDefined();
    expect(noWarning!.opensNewWindow).toBe(true);
    expect(noWarning!.hasNewWindowWarning).toBe(false);
    expect(noWarning!.flags).toContain('NEW_WINDOW_NO_WARNING');

    // Deuxième lien : target="_blank" AVEC warning (aria-label mentionne "nouvelle fenêtre")
    const withWarning = links.find((l) => l.href === '/other');
    expect(withWarning).toBeDefined();
    expect(withWarning!.opensNewWindow).toBe(true);
    expect(withWarning!.hasNewWindowWarning).toBe(true);
    expect(withWarning!.flags).not.toContain('NEW_WINDOW_NO_WARNING');
  });
});

// ───────────────────────────────────────────────────────────────
// collectHeadings
// ───────────────────────────────────────────────────────────────

describe('collectHeadings', () => {
  it('saut h2 → h4 détecté avec LEVEL_SKIP', async () => {
    const result = await withPage(`${baseUrl}/headings/level-skip.html`, collectHeadings);

    expect(result.flags).toContain('LEVEL_SKIP');

    const h4 = result.headings.find((h) => h.level === 4);
    expect(h4).toBeDefined();
    expect(h4!.flags.length).toBeGreaterThan(0);

    const skipFlag = h4!.flags.find(
      (f) => typeof f === 'object' && f.flag === 'LEVEL_SKIP'
    );
    expect(skipFlag).toBeDefined();
    if (typeof skipFlag === 'object') {
      expect(skipFlag.skipFrom).toBe(2);
      expect(skipFlag.skipTo).toBe(4);
    }
  });

  it('NO_H1 correct', async () => {
    const result = await withPage(`${baseUrl}/headings/no-h1.html`, collectHeadings);

    expect(result.flags).toContain('NO_H1');
    const h1s = result.headings.filter((h) => h.level === 1);
    expect(h1s).toHaveLength(0);
  });

  it('MULTIPLE_H1 correct', async () => {
    const result = await withPage(`${baseUrl}/headings/multiple-h1.html`, collectHeadings);

    expect(result.flags).toContain('MULTIPLE_H1');
    const h1s = result.headings.filter((h) => h.level === 1);
    expect(h1s.length).toBeGreaterThanOrEqual(2);
  });

  it('TITLE_GENERIC lu depuis rgaa-4.1.json (pas hardcodé)', async () => {
    const result = await withPage(`${baseUrl}/headings/title-generic.html`, collectHeadings);

    expect(result.documentTitle.toLowerCase()).toBe('accueil');
    expect(result.flags).toContain('TITLE_GENERIC');
  });

  it('TITLE_ABSENT quand le document n\'a pas de titre', async () => {
    const result = await withPage(`${baseUrl}/headings/title-absent.html`, collectHeadings);

    expect(result.documentTitle).toBe('');
    expect(result.flags).toContain('TITLE_ABSENT');
  });

  it('retourne le documentTitle et la liste des headings', async () => {
    const result = await withPage(`${baseUrl}/headings/level-skip.html`, collectHeadings);

    expect(result.documentTitle).toBe('Test — Saut de niveau de titre');
    expect(result.headings.length).toBeGreaterThanOrEqual(3);

    for (const h of result.headings) {
      expect(h).toHaveProperty('level');
      expect(h).toHaveProperty('text');
      expect(h).toHaveProperty('selector');
      expect(h).toHaveProperty('flags');
      expect(h.level).toBeGreaterThanOrEqual(1);
      expect(h.level).toBeLessThanOrEqual(6);
    }
  });
});

// ───────────────────────────────────────────────────────────────
// collectAll
// ───────────────────────────────────────────────────────────────

describe('collectAll', () => {
  it('retourne { images, links, headings }', async () => {
    const result = await withPage(`${baseUrl}/images/img-in-link.html`, collectAll);

    expect(result).toHaveProperty('images');
    expect(result).toHaveProperty('links');
    expect(result).toHaveProperty('headings');
    expect(Array.isArray(result.images)).toBe(true);
    expect(Array.isArray(result.links)).toBe(true);
    expect(result.headings).toHaveProperty('documentTitle');
    expect(result.headings).toHaveProperty('headings');
    expect(result.headings).toHaveProperty('flags');
  });
});
