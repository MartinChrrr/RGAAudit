import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Report, AggregatedCriterion } from '../mapping/mapper';
import type { CollectedData } from '../analyzer/data-collector';

const __dirname = dirname(fileURLToPath(import.meta.url));

type NestedRecord = { [key: string]: string | NestedRecord };

let cachedLocale: NestedRecord | null = null;

function loadLocale(): NestedRecord {
  if (cachedLocale) return cachedLocale;
  const localePath = resolve(__dirname, '../locales/fr.json');
  cachedLocale = JSON.parse(readFileSync(localePath, 'utf-8')) as NestedRecord;
  return cachedLocale;
}

function t(key: string, params?: Record<string, string | number>): string {
  const locale = loadLocale();
  const parts = key.split('.');
  let value: string | NestedRecord | undefined = locale;
  for (const part of parts) {
    if (typeof value !== 'object' || value === null) return key;
    value = (value as NestedRecord)[part];
  }
  if (typeof value !== 'string') return key;
  if (!params) return value;
  return Object.entries(params).reduce(
    (acc, [k, v]) => acc.replace(`{${k}}`, String(v)),
    value,
  );
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function serializeForHtmlScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export interface ContrastViolationItem {
  pageUrl: string;
  rgaaId: string;
  selector: string;
  contrastRatio: string;
  expectedContrastRatio: string;
  fgColor: string;
  bgColor: string;
}

export interface RenderOptions {
  report: Report;
  allCollected?: Array<{ url: string; collectedData: CollectedData | null }>;
  contrastViolations?: ContrastViolationItem[];
}

export function renderReportHtml({ report, allCollected, contrastViolations }: RenderOptions): string {
  const { metadata, limitBanner, summary, uncoveredThemes } = report;

  const statusLabel = (status: string): string => t(`status.${status}`);
  const statusClass = (status: string): string => {
    switch (status) {
      case 'violation': return 'bg-red-100 text-red-800';
      case 'pass': return 'bg-green-100 text-green-800';
      case 'manual': return 'bg-amber-100 text-amber-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const byTheme = new Map<string, AggregatedCriterion[]>();
  for (const c of summary.criteria) {
    const themeId = c.rgaaId.split('.')[0];
    if (!byTheme.has(themeId)) byTheme.set(themeId, []);
    byTheme.get(themeId)!.push(c);
  }

  const criteriaSection = Array.from(byTheme.entries())
    .map(([themeId, criteria]) => {
      const rows = criteria
        .map((c) => `
          <tr>
            <td class="px-3 py-2 font-mono text-xs text-gray-500">${escapeHtml(c.rgaaId)}</td>
            <td class="px-3 py-2 text-sm text-gray-700">${escapeHtml(c.title)}</td>
            <td class="px-3 py-2">
              <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClass(c.status)}">
                ${escapeHtml(statusLabel(c.status))}
              </span>
            </td>
            <td class="px-3 py-2 text-xs text-gray-500">
              ${(c.pagesViolating ?? []).length > 0 ? escapeHtml(t('report.topIssuePages', { count: c.pagesViolating.length })) : ''}
            </td>
          </tr>`)
        .join('');

      return `
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-4">
          <div class="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h3 class="text-sm font-semibold text-gray-800">${escapeHtml(t(`themes.${themeId}`))}</h3>
          </div>
          <table class="w-full text-sm text-left">
            <thead class="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-200">
              <tr>
                <th class="px-3 py-2">${escapeHtml(t('report.htmlColId'))}</th>
                <th class="px-3 py-2">${escapeHtml(t('report.htmlColCriterion'))}</th>
                <th class="px-3 py-2">${escapeHtml(t('report.htmlColStatus'))}</th>
                <th class="px-3 py-2">${escapeHtml(t('report.htmlColPages'))}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">${rows}</tbody>
          </table>
        </div>`;
    })
    .join('');

  const topIssuesSection = summary.topIssues.length > 0
    ? `<section class="mb-8">
        <h2 class="text-lg font-semibold text-gray-900 mb-3">${escapeHtml(t('report.topIssues'))}</h2>
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 divide-y divide-gray-100">
          ${summary.topIssues.map((issue) => `
            <div class="p-4 flex items-center justify-between">
              <div>
                <span class="font-mono text-sm text-gray-500 mr-2">${escapeHtml(issue.rgaaId)}</span>
                <span class="text-sm text-gray-800">${escapeHtml(issue.title)}</span>
              </div>
              <span class="text-xs text-gray-500">${escapeHtml(t('report.topIssuePages', { count: issue.pagesAffected }))}</span>
            </div>`).join('')}
        </div>
      </section>`
    : '';

  const uncoveredSection = uncoveredThemes.length > 0
    ? `<section class="mb-8">
        <h2 class="text-lg font-semibold text-gray-900 mb-3">${escapeHtml(t('report.themesNotCovered'))}</h2>
        <div class="space-y-3">
          ${uncoveredThemes.map((theme) => `
            <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <h3 class="text-sm font-semibold text-gray-800 mb-2">${escapeHtml(theme.name)}</h3>
              <ul class="list-disc list-inside text-sm text-gray-600 space-y-1">
                ${theme.manualChecklist.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
              </ul>
            </div>`).join('')}
        </div>
      </section>`
    : '';

  const annexeDataJson = allCollected
    ? serializeForHtmlScript(allCollected)
    : '[]';

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(metadata.url)} — ${escapeHtml(t('report.title'))}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; background: #f9fafb; color: #111827; font-family: system-ui, sans-serif; line-height: 1.5; }
    main { max-width: 64rem; margin: 0 auto; padding: 2rem 1rem; }
    h1 { font-size: 1.5rem; margin: 0 0 .5rem; }
    h2 { font-size: 1.125rem; margin: 0 0 .75rem; }
    h3 { margin: 0; }
    section, .mb-8 { margin-bottom: 2rem; }
    .mb-6 { margin-bottom: 1.5rem; }
    .mb-4 { margin-bottom: 1rem; }
    .mb-3 { margin-bottom: .75rem; }
    .bg-white { background: white; }
    .bg-gray-50 { background: #f9fafb; }
    .bg-red-50, .bg-red-100 { background: #fee2e2; }
    .bg-green-100 { background: #dcfce7; }
    .bg-amber-50, .bg-amber-100 { background: #fef3c7; }
    .rounded-lg, .rounded-xl { border-radius: .75rem; }
    .rounded-full { border-radius: 9999px; }
    .border, .border-b, .border-t { border: 1px solid #e5e7eb; }
    .p-4 { padding: 1rem; }
    .py-8 { padding-top: 2rem; padding-bottom: 2rem; }
    .px-4 { padding-left: 1rem; padding-right: 1rem; }
    .px-3 { padding-left: .75rem; padding-right: .75rem; }
    .px-2\.5 { padding-left: .625rem; padding-right: .625rem; }
    .py-3 { padding-top: .75rem; padding-bottom: .75rem; }
    .py-2 { padding-top: .5rem; padding-bottom: .5rem; }
    .py-0\.5 { padding-top: .125rem; padding-bottom: .125rem; }
    .text-xs { font-size: .75rem; }
    .text-sm { font-size: .875rem; }
    .text-2xl { font-size: 1.5rem; }
    .font-bold { font-weight: 700; }
    .font-semibold { font-weight: 600; }
    .font-medium { font-weight: 500; }
    .font-mono { font-family: ui-monospace, monospace; }
    .text-red-700, .text-red-800 { color: #991b1b; }
    .text-green-700, .text-green-800 { color: #166534; }
    .text-amber-700, .text-amber-800, .text-amber-900 { color: #92400e; }
    .text-gray-400, .text-gray-500, .text-gray-600 { color: #4b5563; }
    .contrast-result { display: flex; align-items: center; justify-content: space-between; gap: .5rem; min-width: 10rem; margin-bottom: .25rem; }
    .contrast-badge { border-radius: 9999px; background: #fee2e2; color: #991b1b; font-size: .6875rem; font-weight: 600; padding: .125rem .5rem; }
    .contrast-meter { height: .625rem; overflow: hidden; border-radius: 9999px; background: #e5e7eb; }
    .contrast-meter-fill { display: block; height: 100%; border-radius: inherit; background: #dc2626; }
    table { width: 100%; border-collapse: collapse; text-align: left; }
    th, td { border-bottom: 1px solid #e5e7eb; vertical-align: top; }
    a { color: #1d4ed8; }
    footer { margin-top: 3rem; padding: 1rem 0; border-top: 1px solid #e5e7eb; text-align: center; }
    @media print {
      .no-print { display: none !important; }
      body { font-size: 12px; color: #000; background: #fff; }
      main { max-width: 100%; padding: 0; }
      .shadow-sm { box-shadow: none; }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; }
      thead { display: table-header-group; }
      section { page-break-before: auto; }
      h2 { page-break-after: avoid; }
      h3 { page-break-after: avoid; }
      a { color: #000; text-decoration: underline; }
      input, button, select { display: none !important; }
    }
  </style>
</head>
<body class="bg-gray-50 min-h-screen">
  <main class="max-w-4xl mx-auto py-8 px-4">
    <!-- Limit banner -->
    <div role="alert" class="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900" data-testid="limit-banner">
      ${escapeHtml(limitBanner)}
    </div>

    <h1 class="text-2xl font-bold text-gray-900 mb-2">${escapeHtml(t('report.title'))}</h1>

    <!-- Metadata -->
    <div class="text-sm text-gray-600 mb-6 space-y-1">
      <p><strong>${escapeHtml(t('report.auditedUrl'))} :</strong> <a href="${escapeHtml(metadata.url)}" class="text-primary-600 hover:underline">${escapeHtml(metadata.url)}</a></p>
      <p><strong>${escapeHtml(t('report.generatedAt'))} :</strong> ${escapeHtml(metadata.date)}</p>
      <p><strong>${escapeHtml(t('report.pagesAudited'))} :</strong> ${metadata.pagesAudited}</p>
    </div>

    <!-- Summary cards -->
    <div class="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-8">
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <p class="text-xs text-gray-500 mb-1">${escapeHtml(t('report.criteriaTotal'))}</p>
        <p class="text-2xl font-bold text-gray-900">${summary.totalCriteria}</p>
      </div>
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <p class="text-xs text-gray-500 mb-1">${escapeHtml(t('report.criteriaViolation'))}</p>
        <p class="text-2xl font-bold text-red-700">${summary.violations}</p>
      </div>
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <p class="text-xs text-gray-500 mb-1">${escapeHtml(t('report.criteriaPass'))}</p>
        <p class="text-2xl font-bold text-green-700">${summary.passes}</p>
      </div>
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <p class="text-xs text-gray-500 mb-1">${escapeHtml(t('report.criteriaManual'))}</p>
        <p class="text-2xl font-bold text-amber-700">${summary.manual}</p>
      </div>
    </div>

    ${topIssuesSection}

    <!-- Criteria by theme -->
    <section class="mb-8">
      <h2 class="text-lg font-semibold text-gray-900 mb-3">${escapeHtml(t('report.htmlCriteriaDetail'))}</h2>
      ${criteriaSection}
    </section>

    ${uncoveredSection}

    ${buildContrastSection(contrastViolations ?? [])}

    <!-- Footer -->
    <footer class="text-center text-xs text-gray-400 mt-12 py-4 border-t border-gray-200">
      ${escapeHtml(t('report.htmlFooter'))}
    </footer>
  </main>

  <!-- Annexe data for offline use (REGLE 8) -->
  <script id="rgaaudit-data" type="application/json">${annexeDataJson}</script>
</body>
</html>`;
}

function buildContrastSection(violations: ContrastViolationItem[]): string {
  if (violations.length === 0) return '';

  const rows = violations.map((v) => {
    const actual = Number.parseFloat(v.contrastRatio.replace(',', '.'));
    const required = Number.parseFloat(v.expectedContrastRatio.replace(',', '.'));
    const percentage = Number.isFinite(actual) && Number.isFinite(required) && required > 0
      ? Math.min(100, Math.max(0, (actual / required) * 100))
      : 0;
    const gaugeLabel = t('report.contrastGaugeLabel', {
      actual: v.contrastRatio,
      required: v.expectedContrastRatio,
    });

    return `
    <tr>
      <td class="px-3 py-2 font-mono text-xs text-gray-500">${escapeHtml(v.rgaaId)}</td>
      <td class="px-3 py-2 text-xs text-gray-700 break-all">${escapeHtml(v.selector)}</td>
      <td class="px-3 py-2 text-xs text-gray-700">
        <div class="contrast-result">
          <strong class="text-red-800">${escapeHtml(v.contrastRatio)}</strong>
          <span class="contrast-badge">${escapeHtml(t('report.contrastInsufficient'))}</span>
        </div>
        <div class="contrast-meter" role="meter" aria-label="${escapeHtml(gaugeLabel)}" aria-valuemin="0" aria-valuemax="${Number.isFinite(required) ? required : 0}" aria-valuenow="${Number.isFinite(actual) ? actual : 0}" aria-valuetext="${escapeHtml(gaugeLabel)}">
          <span class="contrast-meter-fill" style="width: ${percentage}%"></span>
        </div>
      </td>
      <td class="px-3 py-2 text-xs font-semibold text-gray-800">${escapeHtml(v.expectedContrastRatio)}</td>
      <td class="px-3 py-2 text-xs text-gray-500 break-all">${escapeHtml(v.pageUrl)}</td>
    </tr>`;
  }).join('');

  return `
    <section class="mb-8" data-testid="contrast-section">
      <h2 class="text-lg font-semibold text-gray-900 mb-3">${escapeHtml(t('report.contrastDetail'))}</h2>
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table class="w-full text-sm text-left">
          <thead class="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-200">
            <tr>
              <th class="px-3 py-2">${escapeHtml(t('report.htmlColId'))}</th>
              <th class="px-3 py-2">${escapeHtml(t('report.contrastSelector'))}</th>
              <th class="px-3 py-2">${escapeHtml(t('report.contrastRatio'))}</th>
              <th class="px-3 py-2">${escapeHtml(t('report.contrastRequired'))}</th>
              <th class="px-3 py-2">Page</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">${rows}</tbody>
        </table>
      </div>
    </section>`;
}

/** Reset locale cache — for testing only */
export function _resetLocaleCache(): void {
  cachedLocale = null;
}
