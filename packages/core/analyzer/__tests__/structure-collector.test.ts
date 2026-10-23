import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import { collectStructure } from '../data-collector';

describe('collectStructure', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch();
    page = await browser.newPage();
  });

  afterAll(async () => {
    await browser?.close();
  });

  it('collecte les preuves DOM/CSS des critères du lot 1', async () => {
    await page.setContent(`<!doctype html>
      <html><head><style>.notice { color: red; }</style></head><body>
        <nav aria-label="Navigation">Menu</nav>
        <main><table><caption>Données</caption><tr><th>Nom</th></tr></table>
          <form><fieldset><input name="name"></fieldset></form>
          <p class="notice" style="color: red">Texte</p>
        </main>
      </body></html>`);

    const structure = await collectStructure(page);

    expect(structure.pageFlags).toEqual(expect.arrayContaining([
      'HTML_VALIDITY_REVIEW',
      'LANDMARK_BANNER_MISSING',
      'LANDMARK_CONTENTINFO_MISSING',
      'LANDMARK_SEARCH_MISSING',
    ]));
    expect(structure.tables[0]).toMatchObject({
      dataFeatures: ['caption', 'th'],
      flags: ['TABLE_LAYOUT_DATA_FEATURE'],
    });
    expect(structure.styles.flags).toEqual(expect.arrayContaining([
      'STYLESHEET_PRESENT',
      'INLINE_STYLE_PRESENT',
    ]));
    expect(structure.colors[0].flags).toContain('COLOR_FOREGROUND_ONLY');
    expect(structure.fieldGroups[0].flags).toContain('FIELDSET_LEGEND_ABSENT');
    expect(structure.landmarks.map((landmark) => landmark.role)).toContain('main');
  });

  it('distingue les regroupements et les zones nommées conformes', async () => {
    await page.setContent(`<!doctype html><html><body>
      <header>En-tête</header><nav aria-label="Principal">Menu</nav>
      <main><form role="search" aria-label="Rechercher"></form>
        <fieldset><legend>Coordonnées</legend><input name="email"></fieldset>
      </main><footer>Pied</footer>
    </body></html>`);

    const structure = await collectStructure(page);

    expect(structure.pageFlags).not.toContain('LANDMARK_BANNER_MISSING');
    expect(structure.pageFlags).not.toContain('LANDMARK_CONTENTINFO_MISSING');
    expect(structure.pageFlags).not.toContain('LANDMARK_SEARCH_MISSING');
    expect(structure.fieldGroups[0].flags).toContain('FIELDSET_LEGEND_PRESENT');
    expect(structure.landmarks.map((landmark) => landmark.role)).toEqual(
      expect.arrayContaining(['banner', 'navigation', 'main', 'search', 'contentinfo']),
    );
  });
});
