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
      integrated: 26,
      machineSignal: 25,
      humanReview: 101,
    });
    expect(data.review.coverage).toEqual(data.report.coverage);

    const criterion11 = data.review.pages[0]?.criteria.find((criterion) => criterion.rgaaId === '1.1');
    expect(criterion11).toMatchObject({
      machineStatus: 'needs_review',
      humanStatus: 'not_tested',
    });
  });
});
