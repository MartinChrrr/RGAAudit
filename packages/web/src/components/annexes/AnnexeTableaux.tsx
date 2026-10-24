import { useEffect, useState } from 'react';
import { t } from '../../locales';

export interface TableItem {
  selector: string;
  dataFeatures: string[];
  flags: string[];
  tableKind?: 'data_candidate' | 'presentation_candidate' | 'undetermined';
  complexitySignals?: string[];
  captionText?: string | null;
  summaryText?: string | null;
  linearizedText?: string;
  pageUrl?: string;
  pageId?: string;
}

interface Props {
  tables: TableItem[];
  initialPageUrl?: string;
  initialPageId?: string;
  focusedSelectors?: string[];
  focusedCriterionId?: string;
}

function kindLabel(kind: TableItem['tableKind']): string {
  if (kind === 'data_candidate') return t('annexes.tables.kindData');
  if (kind === 'presentation_candidate') return t('annexes.tables.kindPresentation');
  return t('annexes.tables.kindUndetermined');
}

export default function AnnexeTableaux({ tables, initialPageUrl, initialPageId, focusedSelectors, focusedCriterionId }: Props) {
  const pages = [...new Map(tables
    .filter((item) => item.pageUrl)
    .map((item) => [item.pageId ?? item.pageUrl!, { id: item.pageId ?? item.pageUrl!, url: item.pageUrl! }]),
  ).values()];
  const [pageFilter, setPageFilter] = useState(initialPageId ?? initialPageUrl ?? '');

  useEffect(() => setPageFilter(initialPageId ?? initialPageUrl ?? ''), [initialPageId, initialPageUrl]);

  const selectorFilter = focusedSelectors && focusedSelectors.length > 0 ? new Set(focusedSelectors) : null;
  const visible = tables.filter((item) => (
    (!pageFilter || (item.pageId ?? item.pageUrl) === pageFilter)
    && (!selectorFilter || selectorFilter.has(item.selector))
  ));

  return (
    <div data-testid="annexe-tables">
      <p className="mb-4 text-sm text-gray-600">{t('annexes.tables.description')}</p>
      {focusedCriterionId && <p className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">{t('annexes.tables.focusedCriterion', { criterion: focusedCriterionId, count: visible.length })}</p>}
      {pages.length > 1 && (
        <div className="mb-4 text-xs text-gray-600">
          <label htmlFor="tables-page-filter" className="mr-2">{t('annexes.tables.filterByPage')} :</label>
          <select id="tables-page-filter" className="rounded border border-gray-300 bg-white px-2 py-1 text-xs" value={pageFilter} onChange={(event) => setPageFilter(event.target.value)}>
            <option value="">{t('annexes.tables.allPages')}</option>
            {pages.map((page) => <option key={page.id} value={page.id}>{page.url}</option>)}
          </select>
        </div>
      )}
      {visible.length === 0 ? <p className="py-4 text-sm text-gray-600">{t('annexes.tables.noResults')}</p> : (
        <div className="overflow-x-auto" role="region" tabIndex={0} aria-label={t('annexes.tables.tableScrollLabel')}>
          <table className="w-full min-w-[1000px] text-left text-sm">
            <caption className="sr-only">{t('annexes.tables.title')}</caption>
            <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-700">
              <tr>
                <th scope="col" className="px-3 py-2">{t('annexes.tables.colPage')}</th>
                <th scope="col" className="px-3 py-2">{t('annexes.tables.colClassification')}</th>
                <th scope="col" className="px-3 py-2">{t('annexes.tables.colSignals')}</th>
                <th scope="col" className="px-3 py-2">{t('annexes.tables.colLinearized')}</th>
                <th scope="col" className="px-3 py-2">{t('annexes.tables.colDecision')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visible.map((table, index) => (
                <tr key={`${table.pageId ?? table.pageUrl ?? ''}:${table.selector}:${index}`} className="align-top">
                  <td className="px-3 py-3 text-xs text-gray-700"><div className="break-all">{table.pageUrl ?? '—'}</div><code className="break-all">{table.selector}</code></td>
                  <td className="px-3 py-3 text-xs text-gray-700"><strong>{kindLabel(table.tableKind)}</strong><div>{table.captionText ?? t('annexes.tables.noCaption')}</div><div className="text-gray-500">{table.summaryText ?? t('annexes.tables.noSummary')}</div></td>
                  <td className="px-3 py-3 text-xs text-gray-700">
                    <div>{t('annexes.tables.observedFeatures')} : {table.dataFeatures.join(', ') || 'aucune'}</div>
                    <div className="mt-1">{table.complexitySignals?.join(', ') || t('annexes.tables.noComplexity')}</div>
                    <div className="mt-1">{table.flags.join(', ') || '—'}</div>
                  </td>
                  <td className="whitespace-pre-wrap px-3 py-3 text-xs text-gray-700">{table.linearizedText ?? '—'}</td>
                  <td className="px-3 py-3 text-xs text-amber-900">{t('annexes.tables.reviewRequired')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
