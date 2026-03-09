import {
  mapPageResults,
  aggregateResults,
  buildReport,
  type MappedPage,
} from '@rgaaudit/core/mapping/mapper';
import type { SessionState } from '@rgaaudit/core/analyzer/analyzer';

export interface ContrastViolationItem {
  pageUrl: string;
  rgaaId: string;
  selector: string;
  contrastRatio: string;
  expectedContrastRatio: string;
  fgColor: string;
  bgColor: string;
}

export interface ReportData {
  report: ReturnType<typeof buildReport>;
  mappedPages: MappedPage[];
  allCollected: { url: string; collectedData: unknown }[];
  contrastViolations: ContrastViolationItem[];
}

export function buildReportFromSession(session: SessionState): ReportData {
  const mappedPages = Object.values(session.results)
    .filter((r) => !r.error)
    .map((r) => mapPageResults(r.axeResults, r.collectedData, r.url));

  const allCollected = Object.values(session.results)
    .filter((r) => !r.error)
    .map((r) => ({ url: r.url, collectedData: r.collectedData }));

  const summary = aggregateResults(mappedPages, allCollected);

  const firstUrl = session.completedPages[0] ?? '';
  const report = buildReport(summary, {
    url: firstUrl,
    date: session.startedAt,
    pagesAudited: session.completedPages.length,
    version: '0.1.0',
  }, allCollected);

  const contrastViolations = extractContrastViolations(mappedPages);

  return { report, mappedPages, allCollected, contrastViolations };
}

function extractContrastViolations(mappedPages: MappedPage[]): ContrastViolationItem[] {
  const contrastRules = ['color-contrast', 'color-contrast-enhanced'];
  const rgaaIdByRule: Record<string, string> = {
    'color-contrast': '3.2',
    'color-contrast-enhanced': '3.3',
  };
  const items: ContrastViolationItem[] = [];

  for (const page of mappedPages) {
    for (const criterion of page.criteria) {
      if (!['3.2', '3.3'].includes(criterion.rgaaId)) continue;
      for (const violation of criterion.violations) {
        if (!contrastRules.includes(violation.rule)) continue;
        for (const el of violation.elements) {
          const data = el.data ?? {};
          items.push({
            pageUrl: page.url,
            rgaaId: rgaaIdByRule[violation.rule] ?? criterion.rgaaId,
            selector: el.target.join(', '),
            contrastRatio: data.contrastRatio != null ? `${data.contrastRatio}:1` : '',
            expectedContrastRatio: data.expectedContrastRatio != null ? `${data.expectedContrastRatio}:1` : '',
            fgColor: typeof data.fgColor === 'string' ? data.fgColor : '',
            bgColor: typeof data.bgColor === 'string' ? data.bgColor : '',
          });
        }
      }
    }
  }

  return items;
}
