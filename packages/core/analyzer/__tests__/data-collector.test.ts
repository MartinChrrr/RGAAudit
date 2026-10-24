import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {
  collectImages,
  collectMedia,
  collectSpecializedContent,
  collectFrames,
  collectLinks,
  collectHeadings,
  collectFigureCaptions,
  collectForms,
  collectStructure,
  collectAll,
} from '../data-collector';

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
  it('produit un sélecteur CSS unique et utilisable pour chaque image', async () => {
    await withPage(`${baseUrl}/images/alt-missing.html`, async (page) => {
      const images = await collectImages(page);

      expect(new Set(images.map((image) => image.selector)).size).toBe(images.length);
      for (const image of images) {
        await expect(page.locator(image.selector).count()).resolves.toBe(1);
      }
    });
  });

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
    expect(absent.every((img) => img.altRelevanceStatus === 'not_applicable')).toBe(true);
    expect(empty.every((img) => img.altRelevanceStatus === 'not_applicable')).toBe(true);
    expect(present.every((img) => img.altRelevanceStatus === 'to_review')).toBe(true);
    expect(present.every((img) => img.flags.includes('ALT_RELEVANCE_REVIEW'))).toBe(true);
  });

  it('fixture US-41 sépare l’alternative à revoir des images sans alternative', async () => {
    const images = await withPage(`${baseUrl}/images/us-41-alt-relevance.html`, collectImages);

    expect(images.find((image) => image.selector === 'img#informative')).toMatchObject({
      altStatus: 'present',
      altRelevanceStatus: 'to_review',
      flags: expect.arrayContaining(['ALT_RELEVANCE_REVIEW']),
    });
    expect(images.find((image) => image.selector === 'img#decorative')).toMatchObject({
      altStatus: 'empty',
      altRelevanceStatus: 'not_applicable',
    });
    expect(images.find((image) => image.selector === 'img#missing')).toMatchObject({
      altStatus: 'absent',
      altRelevanceStatus: 'not_applicable',
    });
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

  it('identifie les sources d’alternative et les contrôles manuels 1.3 à 1.8', async () => {
    const images = await withPage(`${baseUrl}/images/img-in-link.html`, collectImages);
    const image = images.find((item) => item.altAttribute === 'Voir la photo');

    expect(image).toBeDefined();
    expect(image!.alternativeSources).toEqual(expect.arrayContaining(['alt']));
    expect(image!.manualChecks).toEqual(expect.arrayContaining([
      expect.stringContaining('1.3'),
      expect.stringContaining('1.4'),
      expect.stringContaining('1.5'),
      expect.stringContaining('1.6'),
      expect.stringContaining('1.7'),
      expect.stringContaining('1.8'),
    ]));
  });

  it('ne considère aria-labelledby comme une alternative que si la référence est résolue', async () => {
    const images = await withPage(`${baseUrl}/images/aria-labelledby.html`, collectImages);
    const broken = images.find((image) => image.selector === 'img#broken');
    const resolved = images.find((image) => image.selector === 'img#resolved');

    expect(broken?.alternativeSources).not.toContain('aria-labelledby');
    expect(resolved?.alternativeSources).toContain('aria-labelledby');
  });
});

describe('collectMedia', () => {
  it('inventorie les sources, les pistes et les alternatives des médias', async () => {
    const media = await withPage(`${baseUrl}/media/tracks.html`, collectMedia);

    expect(media).toHaveLength(4);
    const video = media.find((item) => item.kind === 'video');
    expect(video).toMatchObject({
      selector: 'video#demo',
      sources: [`${baseUrl}/media/demo.mp4`],
      accessibleName: 'Démonstration produit',
      alternativeSources: expect.arrayContaining(['aria-label', 'fallback-text', 'surrounding-text']),
      tracks: [
        expect.objectContaining({ kind: 'captions', srcLang: 'fr', isDefault: true }),
        expect.objectContaining({ kind: 'descriptions', srcLang: 'fr' }),
      ],
      criterionIds: expect.arrayContaining(['4.1', '4.3', '4.5']),
      flags: expect.arrayContaining(['MEDIA_REQUIRES_HUMAN_REVIEW']),
      requiresHumanReview: true,
    });
    expect(video!.criterionIds).not.toContain('4.8');
    expect(video!.criterionIds).not.toContain('4.9');

    expect(media.find((item) => item.kind === 'audio')).toMatchObject({
      selector: 'audio#podcast',
      sources: [`${baseUrl}/media/podcast.mp3`],
      fallbackText: 'Transcription du podcast disponible sur cette page.',
    });

    expect(media.find((item) => item.kind === 'canvas')).toMatchObject({
      selector: 'canvas#chart',
      criterionIds: ['4.8', '4.9'],
      flags: expect.arrayContaining(['MEDIA_REQUIRES_HUMAN_REVIEW']),
    });

    expect(media.find((item) => item.kind === 'object')).toMatchObject({
      selector: 'object#document',
      sources: [`${baseUrl}/media/document.pdf`],
      criterionIds: ['4.8', '4.9'],
    });
  });

  it('expose l’inventaire multimédia dans la collecte globale', async () => {
    const collected = await withPage(`${baseUrl}/media/tracks.html`, collectAll);
    expect(collected.media).toHaveLength(4);
    expect(collected.specializedContent).toEqual(expect.any(Array));
  });

  it('regroupe les médias, CAPTCHA et documents dans un bilan de revue humaine', async () => {
    await withPage(`${baseUrl}/specialized.html`, async (page) => {
      const images = await collectImages(page);
      const media = await collectMedia(page);
      const specialized = await collectSpecializedContent(page, media, images);

      expect(specialized.filter((item) => item.kind === 'captcha')).toHaveLength(1);
      expect(specialized.filter((item) => item.kind === 'document')).toHaveLength(2);
      expect(specialized.every((item) => item.status === 'review_required')).toBe(true);
      expect(specialized.find((item) => item.kind === 'captcha')?.criterionIds).toEqual(
        expect.arrayContaining(['1.4', '1.8']),
      );
      expect(specialized.find((item) => item.kind === 'document')?.criterionIds).toEqual(['13.3', '13.4']);
    });
  });

  it('borne le volume des contenus spécialisés et signale la troncature', async () => {
    await withPage(`${baseUrl}/specialized.html`, async (page) => {
      await page.evaluate(() => {
        for (let index = 0; index < 105; index += 1) {
          const link = document.createElement('a');
          link.href = `extra-${index}.pdf`;
          link.textContent = `Document ${index}`;
          document.body.appendChild(link);
        }
      });
      const specialized = await collectSpecializedContent(page);
      expect(specialized.filter((item) => item.kind === 'document')).toHaveLength(100);
      expect(specialized.some((item) => item.flags.includes('SPECIALIZED_EVIDENCE_TRUNCATED'))).toBe(true);
    });
  });
});

// ───────────────────────────────────────────────────────────────
// collectForms
// ───────────────────────────────────────────────────────────────

describe('collectForms', () => {
  it('relie les libellés, aides et messages d’erreur aux champs', async () => {
    const forms = await withPage(`${baseUrl}/forms/error-and-help.html`, collectForms);

    expect(forms).toHaveLength(1);
    expect(forms[0]).toMatchObject({ selector: '#account', method: 'post' });
    expect(forms[0].controls).toHaveLength(2);
    expect(forms[0].controls[0]).toMatchObject({
      selector: '#email',
      label: 'Adresse électronique',
      labelSource: 'label',
      invalid: true,
      required: true,
      helpText: 'Utilisez une adresse professionnelle.',
      errorMessage: 'Saisissez une adresse électronique valide.',
      flags: [],
    });
    expect(forms[0].controls[1]).toMatchObject({
      selector: '#missing-label',
      label: null,
      helpText: 'Cette information est facultative.',
      flags: ['FORM_LABEL_ABSENT'],
    });
  });

  it('expose les formulaires dans la collecte globale', async () => {
    const data = await withPage(`${baseUrl}/forms/error-and-help.html`, collectAll);
    expect(data.forms).toHaveLength(1);
  });
});

// ───────────────────────────────────────────────────────────────
// RGAA 8.7, 8.10, 9.2 and 9.4 manual evidence
// ───────────────────────────────────────────────────────────────

describe('collectStructure — preuves manuelles des critères 8.7, 8.10, 9.2 et 9.4', () => {
  it('expose les preuves candidates des tableaux complexes et de mise en forme', async () => {
    const structure = await withPage(`${baseUrl}/tables/us-42-complex-and-layout.html`, collectStructure);

    expect(structure.tables).toHaveLength(3);
    expect(structure.tables[0]).toMatchObject({
      selector: '#complex-data',
      tableKind: 'data_candidate',
      captionText: 'Résultats trimestriels par catégorie',
      summaryText: 'Organisation des résultats par période et catégorie',
      complexitySignals: expect.arrayContaining(['ROWSPAN_PRESENT', 'COLSPAN_PRESENT', 'MULTIPLE_HEADER_ROWS', 'HEADERS_ATTRIBUTE_PRESENT']),
      flags: expect.arrayContaining([
        'TABLE_COMPLEX_CANDIDATE',
        'TABLE_COMPLEX_SUMMARY_PRESENT',
        'TABLE_DATA_TITLE_PRESENT',
        'TABLE_HEADER_ASSOCIATION_REVIEW',
      ]),
      linearizedText: expect.stringContaining('T1'),
    });
    expect(structure.tables[1]).toMatchObject({
      selector: '#complex-no-summary',
      tableKind: 'data_candidate',
      summaryText: null,
      flags: expect.arrayContaining(['TABLE_COMPLEX_SUMMARY_ABSENT', 'TABLE_DATA_TITLE_ABSENT']),
    });
    expect(structure.tables[2]).toMatchObject({
      selector: '#presentation-layout',
      tableKind: 'presentation_candidate',
      complexitySignals: [],
      flags: expect.arrayContaining(['TABLE_PRESENTATION_CANDIDATE']),
      linearizedText: expect.stringContaining('Navigation'),
    });
  });

  it('inventorie les changements de langue, directions, régions et citations sans verdict', async () => {
    const structure = await withPage(`${baseUrl}/structure/manual-evidence.html`, collectStructure);

    expect(structure.languages).toEqual(expect.arrayContaining([
      expect.objectContaining({
        declaredLanguage: 'en',
        flags: expect.arrayContaining(['LANGUAGE_CHANGE_DECLARED']),
      }),
      expect.objectContaining({
        declaredLanguage: '',
        flags: expect.arrayContaining(['LANGUAGE_DECLARATION_EMPTY']),
      }),
    ]));
    expect(structure.languages?.some((item) => item.flags.includes('LANGUAGE_TEXT_REQUIRES_REVIEW'))).toBe(true);

    expect(structure.directions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        flags: expect.arrayContaining(['DIRECTION_CSS_DECLARED', 'DIRECTION_BIDI_TEXT_REVIEW']),
      }),
    ]));

    expect(structure.regions).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: 'banner', tagName: 'header' }),
      expect.objectContaining({ role: 'main', tagName: 'main' }),
      expect.objectContaining({ role: 'region', accessibleName: 'Introduction' }),
    ]));
    expect(structure.regions?.find((region) => region.accessibleName === 'Introduction')?.parentSelector)
      .toBe(structure.regions?.find((region) => region.role === 'main')?.selector);

    expect(structure.citations).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'blockquote', citeAttribute: 'https://example.test/source' }),
      expect.objectContaining({ kind: 'q' }),
      expect.objectContaining({ kind: 'text-quote', flags: expect.arrayContaining(['CITATION_TEXT_QUOTE_CANDIDATE']) }),
    ]));
  });
});

// ───────────────────────────────────────────────────────────────
// collectFrames
// ───────────────────────────────────────────────────────────────

describe('collectFrames', () => {
  it('signale les attributs title absents et vides', async () => {
    await withPage(`${baseUrl}/frames/missing-title.html`, async (page) => {
      const frames = await collectFrames(page);

      expect(frames).toHaveLength(2);
      expect(frames.find((frame) => frame.selector === 'iframe#missing-title')).toMatchObject({
        titleAttribute: null,
        titleStatus: 'absent',
        flags: ['FRAME_TITLE_ABSENT'],
        elementIndex: 0,
      });
      expect(frames.find((frame) => frame.selector === 'iframe#empty-title')).toMatchObject({
        titleAttribute: '   ',
        titleStatus: 'empty',
        flags: ['FRAME_TITLE_EMPTY'],
      });

      for (const frame of frames) {
        await expect(page.locator(frame.selector).count()).resolves.toBe(1);
        expect(frame.origin).toBe(new URL(baseUrl).origin);
        expect(frame.evidenceStatus).toBe('readable');
      }
    });
  });

  it('conserve le titre et la source d’un cadre conforme', async () => {
    const frames = await withPage(`${baseUrl}/frames/with-title.html`, collectFrames);

    expect(frames).toHaveLength(1);
    expect(frames[0]).toMatchObject({
      selector: 'iframe#help-frame',
      tagName: 'iframe',
      titleAttribute: 'Aide à la saisie',
      titleStatus: 'present',
      flags: [],
    });
  });

  it('conserve l’URL absolue et l’origine d’une source de frame', async () => {
    await withPage(`${baseUrl}/frames/source-and-origin.html`, async (page) => {
      const frames = await collectFrames(page);
      expect(frames[0]).toMatchObject({
        selector: 'iframe#source-frame',
        sourceUrl: `${baseUrl}/frames/embedded.html`,
        origin: new URL(baseUrl).origin,
        evidenceStatus: 'readable',
        elementIndex: 0,
      });
    });
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

  it('signale un doctype absent sans confondre ce contrôle avec la validité HTML complète', async () => {
    const result = await withPage(`${baseUrl}/structure/without-doctype.html`, collectHeadings);

    expect(result.flags).toContain('DOCTYPE_ABSENT');
    expect(result.flags).not.toContain('DOCTYPE_INVALID');
  });

  it('signale un doctype qui ne déclare pas HTML', async () => {
    const result = await withPage(`${baseUrl}/structure/invalid-doctype.html`, collectHeadings);

    expect(result.flags).toContain('DOCTYPE_INVALID');
    expect(result.flags).not.toContain('DOCTYPE_ABSENT');
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
// collectFigureCaptions
// ───────────────────────────────────────────────────────────────

describe('collectFigureCaptions', () => {
  it('relie les légendes aux images et signale les légendes orphelines', async () => {
    const captions = await withPage(`${baseUrl}/images/orphan-caption.html`, collectFigureCaptions);

    expect(captions).toHaveLength(2);
    expect(captions.find((caption) => caption.text === 'Légende sans image')?.flags)
      .toContain('FIGCAPTION_ORPHAN');

    const linkedCaption = captions.find((caption) => caption.text === 'Légende associée');
    expect(linkedCaption?.flags).toEqual([]);
    expect(linkedCaption?.imageSelectors).toHaveLength(1);
  });
});

// ───────────────────────────────────────────────────────────────
// collectAll
// ───────────────────────────────────────────────────────────────

describe('collectAll', () => {
  it('retourne les collectes images, cadres, liens, titres et légendes', async () => {
    const result = await withPage(`${baseUrl}/images/img-in-link.html`, collectAll);

    expect(result).toHaveProperty('images');
    expect(result).toHaveProperty('frames');
    expect(result).toHaveProperty('links');
    expect(result).toHaveProperty('headings');
    expect(result).toHaveProperty('figcaptions');
    expect(Array.isArray(result.images)).toBe(true);
    expect(Array.isArray(result.frames)).toBe(true);
    expect(Array.isArray(result.links)).toBe(true);
    expect(result.headings).toHaveProperty('documentTitle');
    expect(result.headings).toHaveProperty('headings');
    expect(result.headings).toHaveProperty('flags');
    expect(Array.isArray(result.figcaptions)).toBe(true);
  });
});
