import { describe, expect, it } from 'vitest';
import type { SessionState } from '@rgaaudit/core/analyzer/analyzer';
import { buildReportFromSession, formatContrastRatio } from '../report.service';

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
      integrated: 27,
      machineSignal: 26,
      humanReview: 101,
    });
    expect(data.review.coverage).toEqual(data.report.coverage);

    const criterion11 = data.review.pages[0]?.criteria.find((criterion) => criterion.rgaaId === '1.1');
    expect(criterion11).toMatchObject({
      machineStatus: 'needs_review',
      humanStatus: 'not_tested',
      proofStatus: 'missing',
    });
    expect(criterion11?.missingProofs).toHaveLength(1);
  });
});
