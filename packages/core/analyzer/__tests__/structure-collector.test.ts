import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import { collectNavigation, collectPresentation, collectStructure } from '../data-collector';

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

  it('capture les états de présentation sans laisser la page modifiée', async () => {
    await page.setViewportSize({ width: 900, height: 700 });
    await page.setContent(`<!doctype html><html><head>
      <style>body { margin: 0; } .wide { width: 1400px; } .only-styled { display: none; }</style>
    </head><body><main><p class="wide">Information visible</p><p id="visual-cue" aria-label="État important" style="color: red; border-radius: 4px; font-size: 20px; position: relative; left: 2px">Alerte</p><button>Action</button>
      <div id="hidden-panel" hidden><button tabindex="0">Hidden action</button></div>
      <p class="only-styled">Visible without styles</p>
    </main></body></html>`);

    const presentation = await collectPresentation(page);

    expect(presentation.snapshots.map((snapshot) => snapshot.scenario)).toEqual([
      'baseline', 'styles-disabled', 'viewport-320x256', 'zoom-200-probe',
    ]);
    expect(presentation.snapshots.find((snapshot) => snapshot.scenario === 'styles-disabled')?.flags)
      .toContain('PRESENTATION_STYLES_DISABLED_CAPTURED');
    expect(presentation.snapshots.find((snapshot) => snapshot.scenario === 'styles-disabled')?.flags)
      .toContain('PRESENTATION_TEXT_INVENTORY_CHANGED');
    const baseline = presentation.snapshots.find((snapshot) => snapshot.scenario === 'baseline');
    const stylesDisabled = presentation.snapshots.find((snapshot) => snapshot.scenario === 'styles-disabled');
    expect(baseline?.documentScrollWidth).toBeGreaterThan(stylesDisabled?.documentScrollWidth ?? 0);
    expect(presentation.snapshots.find((snapshot) => snapshot.scenario === 'viewport-320x256'))
      .toMatchObject({ status: 'observed', viewportWidth: 320, viewportHeight: 256 });
    expect(presentation.snapshots.find((snapshot) => snapshot.scenario === 'zoom-200-probe')?.note)
      .toMatch(/CSS zoom/i);
    expect(presentation.hiddenContent).toEqual(expect.arrayContaining([
      expect.objectContaining({ selector: '#hidden-panel', reasons: expect.arrayContaining(['hidden-attribute']) }),
    ]));
    expect(presentation.perceptualCues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        selector: '#visual-cue',
        kinds: expect.arrayContaining(['color', 'shape', 'size', 'position']),
        flags: expect.arrayContaining(['PERCEPTUAL_COLOR_CUE', 'PERCEPTUAL_TEXT_ALTERNATIVE_PRESENT']),
      }),
    ]));
    expect(presentation.flags).toContain('HIDDEN_FOCUSABLE_CONTENT');
    expect(page.viewportSize()).toMatchObject({ width: 900, height: 700 });
    await expect(page.locator('.wide').evaluate((element) => getComputedStyle(element).width)).resolves.toBe('1400px');
  });

  it('inventorie les systèmes de navigation candidats pour la comparaison inter-pages', async () => {
    await page.setContent(`<!doctype html><html><body>
      <form id="search" role="search" action="/recherche"><input type="search" aria-label="Rechercher"></form>
      <header><nav id="primary" aria-label="Principal"><a href="/">Accueil</a></nav></header>
      <footer><a href="/plan-du-site">Plan du site</a></footer>
    </body></html>`);

    const navigation = await collectNavigation(page);

    expect(navigation.systems).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'navigation', selector: '#primary', flags: expect.arrayContaining(['NAVIGATION_POSITION_CAPTURED']) }),
      expect.objectContaining({ kind: 'search', selector: '#search', flags: expect.arrayContaining(['NAVIGATION_SEARCH_PRESENT']) }),
      expect.objectContaining({ kind: 'sitemap', href: '/plan-du-site', flags: expect.arrayContaining(['NAVIGATION_SITEMAP_CANDIDATE']) }),
    ]));
    expect(navigation.systems.map((system) => [system.selector, system.domIndex])).toEqual([
      ['#search', 0], ['#primary', 1], ['html > body > footer > a', 2],
    ]);
    expect(navigation.manualChecks).toEqual(expect.arrayContaining([
      expect.stringContaining('12.1'),
      expect.stringContaining('12.5'),
    ]));
  });
});
