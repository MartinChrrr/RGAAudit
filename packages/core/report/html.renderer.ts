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

interface RenderOptions {
  report: Report;
  allCollected?: Array<{ url: string; collectedData: CollectedData | null }>;
}

export function renderReportHtml({ report, allCollected }: RenderOptions): string {
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
    ? escapeHtml(JSON.stringify(allCollected))
    : '[]';

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(metadata.url)} — ${escapeHtml(t('report.title'))}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            primary: {
              50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd',
              400: '#60a5fa', 500: '#2563eb', 600: '#1d4ed8', 700: '#1e40af',
              800: '#1e3a8a', 900: '#1e3163',
            },
          },
        },
      },
    }
  </script>
  <style>
    @media print {
      .no-print { display: none !important; }
      body { font-size: 12px; }
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

/** Reset locale cache — for testing only */
export function _resetLocaleCache(): void {
  cachedLocale = null;
}
