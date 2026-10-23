import { describe, expect, it } from 'vitest';
import type { SessionState } from '@rgaaudit/core/analyzer/analyzer';
import { buildReportFromSession, formatContrastRatio, toPublicComparisons, toPublicReportData } from '../report.service';

describe('formatContrastRatio', () => {
  it.each([
    [2.71, '2.71:1'],
    ['4.5', '4.5:1'],
    ['4.5:1', '4.5:1'],
    ['4.5:1:1', '4.5:1'],
  ])('normalise %s en %s', (value, expected) => {
    expect(formatContrastRatio(value)).toBe(expected);
  });
});

describe('buildReportFromSession', () => {
  it('keeps exact URLs internally but exposes only a redacted URL and page id publicly', () => {
    const secretUrl = 'https://example.com/audit?token=secret-value';
    const session: SessionState = {
      sessionId: 'public-report-test',
      startedAt: '2026-10-20T00:00:00.000Z',
      totalPages: 1,
      completedPages: [secretUrl],
      pendingPages: [],
      results: {
        [secretUrl]: {
          url: secretUrl,
          auditedAt: '2026-10-20T00:00:01.000Z',
          axeResults: null,
          collectedData: {
            images: [{
              selector: 'img.hero',
              tagName: 'IMG',
              src: 'https://example.com/hero.png?token=secret-value',
              altAttribute: 'Hero',
              altStatus: 'present',
              ariaLabel: null,
              ariaLabelledby: null,
              rolePresentation: false,
              surroundingText: '',
              parentFigcaption: null,
              isInLink: false,
              linkHref: null,
              linkText: null,
              axeViolations: [],
              automatedStatus: 'pass',
              flags: [],
              screenshotPath: '/var/lib/rgaaudit/screenshots/secret.png',
            }],
            frames: [],
            links: [],
            headings: { documentTitle: 'Test', headings: [], flags: [] },
          },
          heuristicResults: [],
          error: null,
        },
      },
    };

    const internal = buildReportFromSession(session);
    const publicData = toPublicReportData(internal, session.sessionId);

    expect(internal.allCollected[0]?.url).toBe(secretUrl);
    expect(publicData.allCollected[0]?.url).toBe('https://example.com/audit');
    expect(publicData.allCollected[0]?.pageId).toMatch(/^page-[0-9a-f]{32}$/);
    expect(publicData.allCollected[0]?.collectedData?.images[0]?.screenshotPath).toBeNull();
    expect(JSON.stringify(publicData)).not.toContain('secret-value');
    expect(JSON.stringify(publicData)).not.toContain('/var/lib/rgaaudit/screenshots/secret.png');
  });

  it('expose l’historique des décisions révisées dans la revue', () => {
    const session: SessionState = {
      sessionId: 'history-test',
      startedAt: '2026-10-20T00:00:00.000Z',
      totalPages: 1,
      completedPages: ['https://example.com/'],
      pendingPages: [],
      results: {},
    };

    const data = buildReportFromSession(session, {
      schemaVersion: 1,
      sessionId: 'history-test',
      decisions: [],
      decisionHistory: [{
        pageUrl: 'https://example.com/',
        criterionId: '1.1',
        status: 'not_tested',
        comment: 'À vérifier',
        reviewedAt: null,
      }],
      imageDecisions: [],
      imageDecisionHistory: [],
      updatedAt: '2026-10-20T00:00:02.000Z',
    });

    expect(data.review.decisionHistory).toEqual([expect.objectContaining({ criterionId: '1.1', comment: 'À vérifier' })]);
  });

  it('ne transforme pas une session sans page exploitable en conformité', () => {
    const session: SessionState = {
      sessionId: 'failed-audit',
      startedAt: '2026-10-20T00:00:00.000Z',
      totalPages: 1,
      completedPages: [],
      pendingPages: [],
      results: {
        'https://example.com/': {
          url: 'https://example.com/',
          auditedAt: '2026-10-20T00:00:01.000Z',
          axeResults: null,
          collectedData: null,
          heuristicResults: [],
          error: 'Navigation timeout',
        },
      },
    };

    const data = buildReportFromSession(session);

    expect(data.report.summary.passes).toBe(0);
    expect(data.report.summary.manual).toBe(106);
    expect(data.report.summary.criteria.every((criterion) => criterion.status === 'manual')).toBe(true);
  });

  it('expose les preuves axe avec leur cible, HTML et contexte dans la revue', () => {
    const session: SessionState = {
      sessionId: 'evidence-test',
      startedAt: '2026-10-20T00:00:00.000Z',
      totalPages: 1,
      completedPages: ['https://example.com/'],
      pendingPages: [],
      results: {
        'https://example.com/': {
          url: 'https://example.com/',
          auditedAt: '2026-10-20T00:00:01.000Z',
          axeResults: {
            violations: [{
              rule: 'image-alt',
              impact: 'critical',
              description: 'Images must have alternate text',
              helpUrl: 'https://dequeuniversity.com/rules/axe/image-alt',
              elements: [{
                target: ['main img:nth-of-type(1)'],
                html: '<img src="photo.jpg">',
                context: 'Parent HTML: <main>…</main>\nParent text: Catalogue',
                elementIndex: 0,
              }],
            }],
            passes: [],
            incomplete: [],
          },
          collectedData: {
            images: [],
            frames: [],
            links: [],
            headings: { documentTitle: 'Test', headings: [], flags: [] },
          },
          heuristicResults: [],
          error: null,
        },
      },
    };

    const data = buildReportFromSession(session);
    const criterion = data.review.pages[0]?.criteria.find((item) => item.rgaaId === '1.1');
    expect(criterion?.evidence).toEqual([expect.objectContaining({
      kind: 'violation',
      rule: 'image-alt',
      selector: 'main img:nth-of-type(1)',
      html: '<img src="photo.jpg">',
      context: expect.stringContaining('Parent HTML:'),
      elementIndex: 0,
      proofId: expect.stringContaining('proof-'),
      resultId: expect.stringContaining('result-'),
      pageUrl: 'https://example.com/',
      criterionId: '1.1',
    })]);
  });

  it('propage la couverture et sépare le signal machine de la décision humaine', () => {
    const session: SessionState = {
      sessionId: 'coverage-test',
      startedAt: '2026-10-20T00:00:00.000Z',
      totalPages: 1,
      completedPages: ['https://example.com/'],
      pendingPages: [],
      results: {
        'https://example.com/': {
          url: 'https://example.com/',
          auditedAt: '2026-10-20T00:00:01.000Z',
          axeResults: {
            violations: [],
            passes: [{ rule: 'frame-title', description: 'ok', elements: [] }],
            incomplete: [],
          },
          collectedData: {
            images: [],
            frames: [],
            links: [],
            headings: {
              documentTitle: 'Test',
              headings: [{ level: 1, text: 'Title', selector: 'h1', flags: [] }],
              flags: [],
            },
          },
          heuristicResults: [],
          error: null,
        },
      },
    };

    const data = buildReportFromSession(session);

    expect(data.report.coverage).toMatchObject({
      total: 106,
      integrated: 33,
      machineSignal: 26,
      humanReview: 101,
    });
    expect(data.review.coverage).toEqual(data.report.coverage);

    const criterion11 = data.review.pages[0]?.criteria.find((criterion) => criterion.rgaaId === '1.1');
    expect(criterion11).toMatchObject({
      machineStatus: 'needs_review',
      humanStatus: 'not_tested',
      coverageStatuses: ['integrated', 'machine_signal', 'not_tested'],
      proofStatus: 'missing',
    });
    expect(criterion11?.missingProofs).toHaveLength(1);

    const plannedCriterion = data.review.pages[0]?.criteria.find((criterion) => criterion.rgaaId === '13.4');
    expect(plannedCriterion?.coverageStatuses).toEqual(['planned', 'not_tested']);
  });
});

describe('toPublicComparisons', () => {
  it('redacte les URLs présentes dans les différences sans exposer le groupe interne', () => {
    const publicComparisons = toPublicComparisons([{
      before: {
        url: 'https://example.com/before?token=secret-before',
        observedAt: '2026-10-20T00:00:00.000Z',
        observationId: 'internal-before',
        comparisonGroup: 'private-group',
        order: 0,
        available: true,
        selectors: ['specialized:document:https://example.com/file?token=secret'],
      },
      after: {
        url: 'https://example.com/after?token=secret-after',
        observedAt: '2026-10-20T00:01:00.000Z',
        observationId: 'internal-after',
        comparisonGroup: 'private-group',
        order: 1,
        available: true,
        selectors: [],
      },
      changed: true,
      added: ['specialized:document:https://example.com/file?token=secret'],
      removed: [],
      updated: [{ key: 'image:img.hero', fields: ['alt'] }],
    }], 'public-comparison');

    expect(publicComparisons[0]).toMatchObject({
      before: { url: 'https://example.com/before', pageId: expect.stringMatching(/^page-/), selectors: ['specialized:document:https://example.com/file'] },
      after: { url: 'https://example.com/after' },
      updated: [{ key: 'image:img.hero', fields: ['alt'] }],
    });
    expect(JSON.stringify(publicComparisons)).not.toContain('secret');
    expect(JSON.stringify(publicComparisons)).not.toContain('private-group');
    expect(JSON.stringify(publicComparisons)).not.toContain('internal-before');
  });
});
