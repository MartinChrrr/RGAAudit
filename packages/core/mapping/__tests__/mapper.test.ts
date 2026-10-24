import { describe, it, expect, beforeEach } from 'vitest';
import type { EngineResult } from '../../engines/engine.interface';
import type { CollectedData } from '../../analyzer/data-collector';
import {
  loadMapping,
  _resetCache,
  mapPageResults,
  aggregateResults,
  buildReport,
  summarizeCoverage,
  type MappedPage,
  type AuditConfig,
} from '../mapper';

// ---------------------------------------------------------------------------
// Helpers — mock data factories
// ---------------------------------------------------------------------------

function makeAxeResult(overrides?: Partial<EngineResult>): EngineResult {
  return {
    violations: [],
    passes: [],
    incomplete: [],
    ...overrides,
  };
}

function makeCollectedData(overrides?: Partial<CollectedData>): CollectedData {
  return {
    images: [],
    frames: [],
    links: [],
    headings: {
      documentTitle: 'Test Page',
      headings: [{ level: 1, text: 'Title', selector: 'h1', flags: [] }],
      flags: [],
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// loadMapping
// ---------------------------------------------------------------------------

describe('loadMapping', () => {
  beforeEach(() => {
    _resetCache();
  });

  it('charge et valide le mapping JSON', () => {
    const mapping = loadMapping();
    expect(mapping.version).toBe('4.1.2');
    expect(mapping.criteria).toHaveLength(106);
    expect(new Set(mapping.criteria.map((criterion) => criterion.rgaa.id)).size).toBe(106);
    expect(mapping.totalCriteria).toBe(106);
    expect(mapping.coveredThemes).toContain('Images');
    expect(mapping.coveredThemes).toContain('Couleurs');

    const implemented = mapping.criteria.filter((criterion) => criterion.implementationLot === 0);
    expect(implemented).toHaveLength(33);
    expect([0, 1, 2, 3, 4, 5].map((lot) => (
      mapping.criteria.filter((criterion) => criterion.implementationLot === lot).length
    ))).toEqual([33, 0, 28, 17, 13, 15]);
    expect(mapping.criteria.find((criterion) => criterion.rgaa.id === '1.1')).toMatchObject({
      coverage: 'partial',
      humanLevel: 'H2',
      implementationLot: 0,
    });
    expect(mapping.criteria.find((criterion) => criterion.rgaa.id === '13.4')).toMatchObject({
      coverage: 'manual_shell',
      evaluationStrategy: 'MANUAL_ONLY',
      implementationLot: 5,
    });
    for (const id of ['1.4', '1.5', '1.6', '1.7', '1.8']) {
      expect(mapping.criteria.find((criterion) => criterion.rgaa.id === id)?.heuristicPatterns.manualChecks)
        .toHaveLength(1);
    }
    for (const id of ['4.1', '4.2', '4.3', '4.4', '4.5', '4.6', '4.8', '4.9']) {
      expect(mapping.criteria.find((criterion) => criterion.rgaa.id === id)?.heuristicPatterns.manualChecks)
        .toHaveLength(1);
    }
    expect(mapping.criteria.find((criterion) => criterion.rgaa.id === '8.1')).toMatchObject({
      coverage: 'full',
      evaluationStrategy: 'COLLECTOR_FLAGS',
      implementationLot: 0,
    });
    expect(mapping.criteria.find((criterion) => criterion.rgaa.id === '8.2')).toMatchObject({
      coverage: 'manual_shell',
      evaluationStrategy: 'MANUAL_ONLY',
      implementationLot: 0,
    });
    expect(mapping.criteria.every((criterion) => (
      ['full', 'partial', 'manual_shell'].includes(criterion.coverage)
      && ['H0', 'H1', 'H2', 'H3'].includes(criterion.humanLevel)
      && [0, 1, 2, 3, 4, 5].includes(criterion.implementationLot)
    ))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// mapPageResults — ANY_VIOLATION
// ---------------------------------------------------------------------------

describe('mapPageResults — ANY_VIOLATION', () => {
  it('"violation" si >= 1 règle viole', () => {
    const axeResults = makeAxeResult({
      violations: [
        {
          rule: 'image-alt',
          impact: 'critical',
          description: 'Images must have alternate text',
          helpUrl: 'https://dequeuniversity.com/rules/axe/4.9/image-alt',
          elements: [{ html: '<img src="x">', target: ['img'] }],
        },
      ],
    });
    const collected = makeCollectedData({
      images: [
        {
          selector: 'img',
          tagName: 'img',
          src: 'x',
          altAttribute: null,
          altStatus: 'absent',
          ariaLabel: null,
          ariaLabelledby: null,
          rolePresentation: false,
          surroundingText: '',
          parentFigcaption: null,
          isInLink: false,
          linkHref: null,
          linkText: null,
          axeViolations: ['image-alt'],
          automatedStatus: 'violation',
          flags: ['ALT_ABSENT'],
          screenshotPath: null,
        },
      ],
    });

    const result = mapPageResults(axeResults, collected, 'http://example.com');
    const criterion11 = result.criteria.find((c) => c.rgaaId === '1.1');

    expect(criterion11).toBeDefined();
    expect(criterion11!.status).toBe('violation');
    expect(criterion11!.violations.length).toBeGreaterThan(0);
  });

  it('mappe frame-title et les preuves collectées vers le critère 2.1', () => {
    const axeResults = makeAxeResult({
      violations: [{
        rule: 'frame-title',
        impact: 'serious',
        description: 'Frames must have an accessible name',
        helpUrl: 'https://dequeuniversity.com/rules/axe/4.9/frame-title',
        elements: [{ html: '<iframe id="help">', target: ['iframe#help'] }],
      }],
    });
    const collected = makeCollectedData({
      frames: [{
        selector: 'iframe#help',
        tagName: 'iframe',
        src: '/help',
        titleAttribute: null,
        titleStatus: 'absent',
        flags: ['FRAME_TITLE_ABSENT'],
      }],
    });

    const result = mapPageResults(axeResults, collected, 'http://example.com');
    const criterion21 = result.criteria.find((criterion) => criterion.rgaaId === '2.1');

    expect(criterion21).toBeDefined();
    expect(criterion21!.status).toBe('violation');
    expect(criterion21!.violations).toHaveLength(1);
    expect(criterion21!.elements).toEqual([
      { selector: 'iframe#help', flags: ['FRAME_TITLE_ABSENT'] },
    ]);
  });

  it('"manual" si aucune violation pour un critère partiel', () => {
    const axeResults = makeAxeResult({
      passes: [
        {
          rule: 'image-alt',
          description: 'Images have alternate text',
          elements: [{ html: '<img alt="ok">', target: ['img'] }],
        },
      ],
    });
    const collected = makeCollectedData();

    const result = mapPageResults(axeResults, collected, 'http://example.com');
    const criterion11 = result.criteria.find((c) => c.rgaaId === '1.1');

    expect(criterion11).toBeDefined();
    expect(criterion11!.status).toBe('manual');
    expect(criterion11!.violations).toHaveLength(0);
  });

  it('ne présente pas l’absence de violation comme une conformité pour un critère partiel', () => {
    const result = mapPageResults(makeAxeResult({
      passes: [{ rule: 'image-alt', description: 'ok', elements: [] }],
    }), makeCollectedData(), 'http://example.com');

    expect(result.criteria.find((criterion) => criterion.rgaaId === '1.1')?.status).toBe('manual');
    expect(result.criteria.find((criterion) => criterion.rgaaId === '2.1')?.status).toBe('pass');
  });
});

// ---------------------------------------------------------------------------
// mapPageResults — contraste (3.2)
// ---------------------------------------------------------------------------

describe('mapPageResults — contraste', () => {
  it('violation color-contrast → critère 3.2 en violation avec data', () => {
    const axeResults = makeAxeResult({
      violations: [
        {
          rule: 'color-contrast',
          impact: 'serious',
          description: 'Elements must meet minimum color contrast ratio thresholds',
          helpUrl: 'https://dequeuniversity.com/rules/axe/4.9/color-contrast',
          elements: [
            {
              html: '<p style="color:#aaa">Low contrast</p>',
              target: ['p'],
              data: {
                fgColor: '#aaaaaa',
                bgColor: '#ffffff',
                contrastRatio: 2.32,
                expectedContrastRatio: '4.5:1',
              },
            },
          ],
        },
      ],
    });
    const collected = makeCollectedData();

    const result = mapPageResults(axeResults, collected, 'http://example.com');
    const criterion32 = result.criteria.find((c) => c.rgaaId === '3.2');

    expect(criterion32).toBeDefined();
    expect(criterion32!.status).toBe('violation');
    expect(criterion32!.violations.length).toBe(1);
    expect(criterion32!.violations[0].elements[0].data).toBeDefined();
    expect(criterion32!.violations[0].elements[0].data!.contrastRatio).toBe(2.32);
  });
});

// ---------------------------------------------------------------------------
// mapPageResults — ALL_PASS
// ---------------------------------------------------------------------------

describe('mapPageResults — ALL_PASS', () => {
  it('"pass" uniquement si toutes les règles passent et la couverture est complète', () => {
    // No criteria in current mapping use ALL_PASS, so use a full-coverage
    // ANY_VIOLATION criterion to verify the positive automatic verdict.
    const axeResults = makeAxeResult({
      passes: [
        { rule: 'frame-title', description: 'ok', elements: [] },
      ],
    });
    const collected = makeCollectedData();

    const result = mapPageResults(axeResults, collected, 'http://example.com');
    const criterion91 = result.criteria.find((c) => c.rgaaId === '2.1');

    expect(criterion91).toBeDefined();
    expect(criterion91!.status).toBe('pass');
  });
});

// ---------------------------------------------------------------------------
// mapPageResults — MANUAL_ONLY
// ---------------------------------------------------------------------------

describe('mapPageResults — MANUAL_ONLY', () => {
  it('"manual" sans regarder axeResults', () => {
    const axeResults = makeAxeResult({
      violations: [
        {
          rule: 'some-unrelated-rule',
          impact: 'critical',
          description: 'Test',
          helpUrl: '',
          elements: [],
        },
      ],
      passes: [
        { rule: 'document-title', description: 'ok', elements: [] },
      ],
    });
    const collected = makeCollectedData({
      headings: {
        documentTitle: 'accueil',
        headings: [],
        flags: ['TITLE_GENERIC'],
      },
    });

    const result = mapPageResults(axeResults, collected, 'http://example.com');
    const criterion86 = result.criteria.find((c) => c.rgaaId === '8.6');

    expect(criterion86).toBeDefined();
    expect(criterion86!.status).toBe('manual');
    // Elements should contain TITLE_GENERIC
    const titleElement = criterion86!.elements.find((e) => e.flags.includes('TITLE_GENERIC'));
    expect(titleElement).toBeDefined();
  });

  it('garde un critère manual_shell en revue manuelle', () => {
    const result = mapPageResults(
      makeAxeResult({
        passes: [{ rule: 'color-contrast-enhanced', description: 'ok', elements: [] }],
      }),
      makeCollectedData(),
      'http://example.com',
    );
    const criterion33 = result.criteria.find((criterion) => criterion.rgaaId === '3.3');

    expect(criterion33).toMatchObject({
      coverage: 'manual_shell',
      status: 'manual',
    });
    expect(criterion33!.manualChecks.length).toBeGreaterThan(0);
  });
});

describe('mapPageResults — contrôles DOM déterministes', () => {
  it('expose les preuves du collecteur structurel pour les six critères du lot 1', () => {
    const result = mapPageResults(
      makeAxeResult(),
      makeCollectedData({
        structure: {
          pageFlags: ['HTML_VALIDITY_REVIEW'],
          tables: [{
            selector: 'table#data',
            dataFeatures: ['th'],
            flags: ['TABLE_LAYOUT_DATA_FEATURE'],
          }],
          styles: {
            stylesheetCount: 1,
            inlineStyleCount: 0,
            presentationMarkupCount: 0,
            flags: ['STYLESHEET_PRESENT'],
          },
          colors: [{
            selector: 'p#notice',
            color: 'rgb(0, 0, 0)',
            backgroundColor: null,
            flags: ['COLOR_FOREGROUND_ONLY'],
          }],
          fieldGroups: [{
            selector: 'fieldset#profile',
            legend: null,
            controlCount: 1,
            flags: ['FIELDSET_LEGEND_ABSENT'],
          }],
          landmarks: [{
            selector: 'main',
            role: 'main',
            accessibleName: null,
            flags: ['LANDMARK_PRESENT'],
          }],
        },
      }),
      'http://example.com/structure',
    );

    expect(result.criteria.find((criterion) => criterion.rgaaId === '5.8')).toMatchObject({
      status: 'manual',
      elements: [{ selector: 'table#data', flags: ['TABLE_LAYOUT_DATA_FEATURE'] }],
    });
    expect(result.criteria.find((criterion) => criterion.rgaaId === '8.2')).toMatchObject({
      status: 'manual',
      elements: [{ selector: 'document', flags: ['HTML_VALIDITY_REVIEW'] }],
    });
    expect(result.criteria.find((criterion) => criterion.rgaaId === '10.1')).toMatchObject({
      status: 'manual',
      elements: [{ selector: 'document', flags: ['STYLESHEET_PRESENT'] }],
    });
    expect(result.criteria.find((criterion) => criterion.rgaaId === '10.5')).toMatchObject({
      status: 'manual',
      elements: [{ selector: 'p#notice', flags: ['COLOR_FOREGROUND_ONLY'] }],
    });
    expect(result.criteria.find((criterion) => criterion.rgaaId === '11.6')).toMatchObject({
      status: 'manual',
      elements: [{ selector: 'fieldset#profile', flags: ['FIELDSET_LEGEND_ABSENT'] }],
    });
    expect(result.criteria.find((criterion) => criterion.rgaaId === '12.6')).toMatchObject({
      status: 'manual',
      elements: [{ selector: 'main', flags: ['LANDMARK_PRESENT'] }],
    });
  });

  it('signale un doctype absent et distingue une page sans signal', () => {
    const withoutDoctype = mapPageResults(
      makeAxeResult(),
      makeCollectedData({
        headings: {
          documentTitle: 'Test Page',
          headings: [{ level: 1, text: 'Title', selector: 'h1', flags: [] }],
          flags: ['DOCTYPE_ABSENT'],
        },
      }),
      'http://example.com/without-doctype',
    );
    const valid = mapPageResults(makeAxeResult(), makeCollectedData(), 'http://example.com/valid');

    expect(withoutDoctype.criteria.find((criterion) => criterion.rgaaId === '8.1')).toMatchObject({
      status: 'violation',
      elements: [{ selector: 'document', flags: ['DOCTYPE_ABSENT'] }],
    });
    expect(valid.criteria.find((criterion) => criterion.rgaaId === '8.1')?.status).toBe('pass');
  });

  it('signale une légende figure sans image associée', () => {
    const result = mapPageResults(
      makeAxeResult(),
      makeCollectedData({
        figcaptions: [{
          selector: 'figure > figcaption',
          text: 'Légende orpheline',
          imageSelectors: [],
          flags: ['FIGCAPTION_ORPHAN'],
        }],
      }),
      'http://example.com/caption',
    );

    expect(result.criteria.find((criterion) => criterion.rgaaId === '1.9')).toMatchObject({
      status: 'violation',
      elements: [{ selector: 'figure > figcaption', flags: ['FIGCAPTION_ORPHAN'] }],
    });
  });

  it('mappe les signaux déterministes de US-06 sans transformer un critère partiel en conformité', () => {
    const axeResults = makeAxeResult({
      violations: [
        {
          rule: 'td-headers-attr',
          impact: 'serious',
          description: 'Table cell headers attributes must refer to other th elements',
          helpUrl: '',
          elements: [{ html: '<td headers="missing-header">', target: ['#invalid-headers td'] }],
        },
        {
          rule: 'scope-attr-valid',
          impact: 'moderate',
          description: 'scope attribute should be used correctly',
          helpUrl: '',
          elements: [{ html: '<th scope="invalid">', target: ['#invalid-headers th'] }],
        },
        {
          rule: 'accesskeys',
          impact: 'moderate',
          description: 'Accesskeys must be unique',
          helpUrl: '',
          elements: [{ html: '<button accesskey="a">', target: ['button'] }],
        },
        {
          rule: 'label',
          impact: 'critical',
          description: 'Form elements must have labels',
          helpUrl: '',
          elements: [{ html: '<input id="email">', target: ['#email'] }],
        },
        {
          rule: 'skip-link',
          impact: 'serious',
          description: 'The skip-link target should exist and be focusable',
          helpUrl: '',
          elements: [{ html: '<a href="#missing">', target: ['a[href="#missing"]'] }],
        },
      ],
    });

    const result = mapPageResults(axeResults, makeCollectedData(), 'http://example.com/us-06');

    expect(result.criteria.find((criterion) => criterion.rgaaId === '5.6')).toMatchObject({
      status: 'violation',
      violations: [{ rule: 'td-headers-attr' }, { rule: 'scope-attr-valid' }],
    });
    expect(result.criteria.find((criterion) => criterion.rgaaId === '12.10')).toMatchObject({
      status: 'incomplete',
      violations: [{ rule: 'accesskeys' }],
    });
    expect(result.criteria.find((criterion) => criterion.rgaaId === '11.1')).toMatchObject({
      status: 'violation',
      violations: [{ rule: 'label', elements: [{ target: ['#email'] }] }],
    });
    expect(result.criteria.find((criterion) => criterion.rgaaId === '12.7')).toMatchObject({
      status: 'violation',
      violations: [{ rule: 'skip-link', elements: [{ target: ['a[href="#missing"]'] }] }],
    });
    expect(result.criteria.find((criterion) => criterion.rgaaId === '10.6')?.status).toBe('manual');
    expect(result.criteria.find((criterion) => criterion.rgaaId === '11.13')?.status).toBe('manual');
  });
});

// ---------------------------------------------------------------------------
// mapPageResults — missing axe rule
// ---------------------------------------------------------------------------

describe('mapPageResults — robustesse', () => {
  it('mappe les preuves des scénarios de présentation sur les critères concernés', () => {
    const result = mapPageResults(
      makeAxeResult(),
      makeCollectedData({
        presentation: {
          snapshots: [
            {
              scenario: 'viewport-320x256',
              status: 'observed',
              viewportWidth: 320,
              viewportHeight: 256,
              devicePixelRatio: 1,
              visualViewportScale: 1,
              documentScrollWidth: 480,
              documentScrollHeight: 256,
              documentClientWidth: 320,
              documentClientHeight: 256,
              bodyTextLength: 20,
              visibleTextLength: 20,
              focusableCount: 1,
              visibleFocusableCount: 1,
              cssZoom: '1',
              flags: ['PRESENTATION_VIEWPORT_320_CAPTURED', 'PRESENTATION_HORIZONTAL_OVERFLOW'],
            },
          ],
          flags: ['PRESENTATION_VIEWPORT_320_CAPTURED', 'PRESENTATION_HORIZONTAL_OVERFLOW'],
          manualChecks: [],
        },
      }),
      'http://example.com/presentation',
    );

    expect(result.criteria.find((criterion) => criterion.rgaaId === '10.11')).toMatchObject({
      status: 'manual',
      elements: [{
        selector: 'document[viewport-320x256]',
        flags: ['PRESENTATION_VIEWPORT_320_CAPTURED', 'PRESENTATION_HORIZONTAL_OVERFLOW'],
      }],
    });
    expect(result.criteria.find((criterion) => criterion.rgaaId === '10.4')?.elements).toEqual([]);
  });

  it('mappe les repères visuels candidats vers 3.1, 10.9 et 10.10 sans verdict automatique', () => {
    const result = mapPageResults(
      makeAxeResult(),
      makeCollectedData({
        presentation: {
          snapshots: [],
          perceptualCues: [{
            selector: '#visual-cue',
            tagName: 'p',
            text: 'Alerte',
            accessibleName: 'État important',
            kinds: ['color', 'shape', 'size', 'position'],
            color: 'rgb(255, 0, 0)',
            backgroundColor: 'rgb(255, 255, 255)',
            fontSize: '20px',
            borderRadius: '4px',
            position: 'relative',
            dimensions: { width: 120, height: 24 },
            flags: [
              'PERCEPTUAL_CUE_REVIEW',
              'PERCEPTUAL_COLOR_CUE',
              'PERCEPTUAL_SHAPE_CUE',
              'PERCEPTUAL_SIZE_CUE',
              'PERCEPTUAL_POSITION_CUE',
              'PERCEPTUAL_TEXT_ALTERNATIVE_PRESENT',
            ],
          }],
          flags: [],
          manualChecks: [],
        },
      }),
      'http://example.com/perceptual-cues',
    );

    for (const id of ['3.1', '10.9', '10.10']) {
      expect(result.criteria.find((criterion) => criterion.rgaaId === id)).toMatchObject({
        status: 'manual',
        elements: [expect.objectContaining({ selector: '#visual-cue' })],
      });
    }
  });

  it('mappe les systèmes de navigation candidats sur les critères 12.1 à 12.5', () => {
    const result = mapPageResults(
      makeAxeResult(),
      makeCollectedData({
        navigation: {
          systems: [{
            kind: 'search',
            selector: '#search',
            label: 'Rechercher',
            href: '/recherche',
            domIndex: 0,
            position: { top: 10, left: 20, width: 300, height: 40 },
            flags: ['NAVIGATION_SYSTEM_PRESENT', 'NAVIGATION_SEARCH_PRESENT', 'NAVIGATION_POSITION_CAPTURED'],
          }],
          flags: ['NAVIGATION_SYSTEM_PRESENT', 'NAVIGATION_SEARCH_PRESENT', 'NAVIGATION_POSITION_CAPTURED'],
          manualChecks: [],
        },
      }),
      'http://example.com/navigation',
    );

    expect(result.criteria.find((criterion) => criterion.rgaaId === '12.5')).toMatchObject({
      status: 'manual',
      elements: [{ selector: '#search', flags: ['NAVIGATION_SEARCH_PRESENT', 'NAVIGATION_POSITION_CAPTURED'] }],
    });
    expect(result.criteria.find((criterion) => criterion.rgaaId === '12.1')?.elements).toEqual([
      { selector: '#search', flags: ['NAVIGATION_SYSTEM_PRESENT', 'NAVIGATION_SEARCH_PRESENT'] },
    ]);
  });

  it('ne throw jamais si un critère du mapping n\'a pas de résultat axe correspondant', () => {
    // Pass empty axe results — no rules at all
    const axeResults = makeAxeResult();
    const collected = makeCollectedData();

    expect(() => {
      const result = mapPageResults(axeResults, collected, 'http://example.com');
      // All criteria should have been mapped
      expect(result.criteria.length).toBeGreaterThan(0);
    }).not.toThrow();
  });

  it('gère axeResults null (page en erreur)', () => {
    const collected = makeCollectedData();

    expect(() => {
      const result = mapPageResults(null, collected, 'http://example.com');
      // All criteria should fall back to manual
      for (const c of result.criteria) {
        expect(c.status).toBe('manual');
      }
    }).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// aggregateResults
// ---------------------------------------------------------------------------

describe('aggregateResults', () => {
  it('ne présente pas une absence de pages comme une conformité', () => {
    const summary = aggregateResults([]);

    expect(summary.passes).toBe(0);
    expect(summary.manual).toBe(106);
    expect(summary.criteria).toHaveLength(106);
    expect(summary.criteria.every((criterion) => criterion.status === 'manual')).toBe(true);
  });

  it('conserve les compteurs de couverture du registre complet', () => {
    const summary = aggregateResults([]);

    expect(summary.totalCriteria).toBe(106);
    expect(summary.coverage).toEqual(summarizeCoverage(loadMapping().criteria));
    expect(summary.coverage).toMatchObject({
      total: 106,
      integrated: 33,
      machineSignal: 26,
      humanReview: 101,
    });
  });

  it('critère "violation" si >= 1 page le viole', () => {
    const page1: MappedPage = mapPageResults(
      makeAxeResult({
        violations: [
          {
            rule: 'image-alt',
            impact: 'critical',
            description: 'Missing alt',
            helpUrl: '',
            elements: [{ html: '<img>', target: ['img'] }],
          },
        ],
      }),
      makeCollectedData(),
      'http://example.com/page1',
    );

    const page2: MappedPage = mapPageResults(
      makeAxeResult({
        passes: [
          { rule: 'image-alt', description: 'ok', elements: [] },
        ],
      }),
      makeCollectedData(),
      'http://example.com/page2',
    );

    const page3: MappedPage = mapPageResults(
      makeAxeResult({
        passes: [
          { rule: 'image-alt', description: 'ok', elements: [] },
        ],
      }),
      makeCollectedData(),
      'http://example.com/page3',
    );

    const summary = aggregateResults([page1, page2, page3]);

    const criterion11 = summary.criteria.find((c) => c.rgaaId === '1.1');
    expect(criterion11).toBeDefined();
    expect(criterion11!.status).toBe('violation');
    expect(criterion11!.pagesViolating).toContain('http://example.com/page1');
    expect(criterion11!.pagesManual).toContain('http://example.com/page2');
  });

  it('détecte les DUPLICATE_LABEL cross-pages', () => {
    const collected1 = makeCollectedData({
      links: [
        {
          selector: 'a[href="/page1"]',
          tagName: 'a',
          accessibleLabel: 'Lire la suite',
          href: '/article-1',
          opensNewWindow: false,
          hasNewWindowWarning: false,
          flags: ['GENERIC_LABEL'],
        },
      ],
    });
    const collected2 = makeCollectedData({
      links: [
        {
          selector: 'a[href="/page2"]',
          tagName: 'a',
          accessibleLabel: 'Lire la suite',
          href: '/article-2',
          opensNewWindow: false,
          hasNewWindowWarning: false,
          flags: ['GENERIC_LABEL'],
        },
      ],
    });

    const page1 = mapPageResults(
      makeAxeResult({
        violations: [
          {
            rule: 'link-name',
            impact: 'serious',
            description: 'Link name',
            helpUrl: '',
            elements: [],
          },
        ],
      }),
      collected1,
      'http://example.com/page1',
    );
    const page2 = mapPageResults(
      makeAxeResult({
        violations: [
          {
            rule: 'link-name',
            impact: 'serious',
            description: 'Link name',
            helpUrl: '',
            elements: [],
          },
        ],
      }),
      collected2,
      'http://example.com/page2',
    );

    const allCollected = [
      { url: 'http://example.com/page1', collectedData: collected1 },
      { url: 'http://example.com/page2', collectedData: collected2 },
    ];

    aggregateResults([page1, page2], allCollected);

    // Check that DUPLICATE_LABEL was added to criterion 6.1 elements
    const criterion61Page1 = page1.criteria.find((c) => c.rgaaId === '6.1');
    expect(criterion61Page1).toBeDefined();
    const dupElement = criterion61Page1!.elements.find((e) => e.flags.includes('DUPLICATE_LABEL'));
    expect(dupElement).toBeDefined();

    const criterion61Page2 = page2.criteria.find((c) => c.rgaaId === '6.1');
    expect(criterion61Page2).toBeDefined();
    const dupElement2 = criterion61Page2!.elements.find((e) => e.flags.includes('DUPLICATE_LABEL'));
    expect(dupElement2).toBeDefined();
  });

  it('calcule les topIssues classés par pages touchées', () => {
    const makeViolationPage = (url: string) =>
      mapPageResults(
        makeAxeResult({
          violations: [
            { rule: 'image-alt', impact: 'critical', description: 'Missing', helpUrl: '', elements: [{ html: '<img>', target: ['img'] }] },
            { rule: 'link-name', impact: 'serious', description: 'Empty', helpUrl: '', elements: [{ html: '<a>', target: ['a'] }] },
          ],
        }),
        makeCollectedData(),
        url,
      );

    const pages = [
      makeViolationPage('http://example.com/p1'),
      makeViolationPage('http://example.com/p2'),
      makeViolationPage('http://example.com/p3'),
    ];

    const summary = aggregateResults(pages);

    expect(summary.topIssues.length).toBeGreaterThan(0);
    expect(summary.topIssues[0].pagesAffected).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// buildReport
// ---------------------------------------------------------------------------

describe('buildReport', () => {
  it('assemble un rapport complet avec limitBanner depuis les locales', () => {
    const pages = [
      mapPageResults(makeAxeResult(), makeCollectedData(), 'http://example.com'),
    ];
    const summary = aggregateResults(pages);
    const config: AuditConfig = {
      url: 'http://example.com',
      date: '2026-03-01',
      pagesAudited: 1,
      version: '0.1.0',
    };

    const report = buildReport(summary, config);

    expect(report.metadata.url).toBe('http://example.com');
    expect(report.metadata.coveredThemes).toContain('Images');
    expect(report.metadata.totalRgaaCriteria).toBe(106);
    expect(report.metadata.coveredCriteria).toBe(33);
    expect(report.coverage).toMatchObject({
      total: 106,
      integrated: 33,
      machineSignal: 26,
      humanReview: 101,
      full: 5,
      partial: 21,
      manualShell: 80,
    });
    expect(summary.coverage).toEqual(report.coverage);

    // limitBanner comes from locale, not hardcoded
    expect(report.limitBanner).toContain('73');
    expect(report.limitBanner).toContain('106');
    expect(report.limitBanner).not.toBe('');

    // Uncovered themes
    expect(report.uncoveredThemes.length).toBe(9);
    expect(report.uncoveredThemes[0].manualChecklist.length).toBeGreaterThan(0);
  });
});
