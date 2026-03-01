import { describe, it, expect, beforeEach } from 'vitest';
import type { EngineResult } from '../../engines/engine.interface';
import type { CollectedData } from '../../analyzer/data-collector';
import {
  loadMapping,
  _resetCache,
  mapPageResults,
  aggregateResults,
  buildReport,
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
    expect(mapping.version).toBe('4.1');
    expect(mapping.criteria.length).toBeGreaterThan(0);
    expect(mapping.totalCriteria).toBe(106);
    expect(mapping.coveredThemes).toContain('Images');
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

  it('"pass" si aucune violation', () => {
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
    expect(criterion11!.status).toBe('pass');
    expect(criterion11!.violations).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// mapPageResults — ALL_PASS
// ---------------------------------------------------------------------------

describe('mapPageResults — ALL_PASS', () => {
  it('"pass" uniquement si toutes les règles passent', () => {
    // No criteria in current mapping use ALL_PASS, so we test the logic
    // by verifying that ANY_VIOLATION criteria with all passes return 'pass'
    const axeResults = makeAxeResult({
      passes: [
        { rule: 'heading-order', description: 'ok', elements: [] },
        { rule: 'page-has-heading-one', description: 'ok', elements: [] },
        { rule: 'empty-heading', description: 'ok', elements: [] },
      ],
    });
    const collected = makeCollectedData();

    const result = mapPageResults(axeResults, collected, 'http://example.com');
    const criterion91 = result.criteria.find((c) => c.rgaaId === '9.1');

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
});

// ---------------------------------------------------------------------------
// mapPageResults — missing axe rule
// ---------------------------------------------------------------------------

describe('mapPageResults — robustesse', () => {
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
    expect(criterion11!.pagesPass).toContain('http://example.com/page2');
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
    expect(report.metadata.coveredCriteria).toBe(7);

    // limitBanner comes from locale, not hardcoded
    expect(report.limitBanner).toContain('7');
    expect(report.limitBanner).toContain('106');
    expect(report.limitBanner).not.toBe('');

    // Uncovered themes
    expect(report.uncoveredThemes.length).toBe(9);
    expect(report.uncoveredThemes[0].manualChecklist.length).toBeGreaterThan(0);
  });
});
