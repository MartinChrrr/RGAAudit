import { useEffect, useState } from 'react';
import { t } from '../../locales';

export interface SpecializedContentItem {
  kind: 'media' | 'captcha' | 'document';
  selector: string;
  source: string | null;
  label: string | null;
  context: string;
  criterionIds: string[];
  status: 'review_required';
  evidence: string[];
  flags: string[];
  pageUrl?: string;
}

interface Props {
  items: SpecializedContentItem[];
  initialPageUrl?: string;
}

const kindLabels: Record<SpecializedContentItem['kind'], string> = {
  media: 'Média',
  captcha: 'CAPTCHA',
  document: 'Document',
};

export default function AnnexeContenusSpecialises({ items, initialPageUrl }: Props) {
  const pages = [...new Set(items.map((item) => item.pageUrl).filter(Boolean))] as string[];
  const [pageFilter, setPageFilter] = useState(initialPageUrl ?? '');

  useEffect(() => setPageFilter(initialPageUrl ?? ''), [initialPageUrl]);

  const visible = pageFilter ? items.filter((item) => item.pageUrl === pageFilter) : items;
  const grouped = visible.reduce<Record<string, number>>((counts, item) => {
    counts[item.status] = (counts[item.status] ?? 0) + 1;
    return counts;
  }, {});

  return (
    <div data-testid="annexe-specialized">
      <p className="mb-4 text-sm text-gray-600">{t('annexes.specialized.description')}</p>
      <div className="mb-4 flex flex-wrap gap-2 text-xs" aria-label={t('annexes.specialized.statusSummary')}>
        <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-900">
          {t('annexes.specialized.reviewRequired')}: {grouped.review_required ?? 0}
        </span>
      </div>
      {pages.length > 1 && (
        <div className="mb-4 text-xs text-gray-600">
          <label htmlFor="specialized-page-filter" className="mr-2">{t('annexes.specialized.filterByPage')} :</label>
          <select
            id="specialized-page-filter"
            className="rounded border border-gray-300 bg-white px-2 py-1 text-xs"
            value={pageFilter}
            onChange={(event) => setPageFilter(event.target.value)}
          >
            <option value="">{t('annexes.specialized.allPages')}</option>
            {pages.map((page) => <option key={page} value={page}>{page}</option>)}
          </select>
        </div>
      )}
      {visible.length === 0 ? (
        <p className="py-4 text-sm text-gray-600">{t('annexes.specialized.noResults')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-sm">
            <caption className="sr-only">{t('annexes.specialized.title')}</caption>
            <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-700">
              <tr>
                <th scope="col" className="px-3 py-2">{t('annexes.specialized.colType')}</th>
                <th scope="col" className="px-3 py-2">{t('annexes.specialized.colSource')}</th>
                <th scope="col" className="px-3 py-2">{t('annexes.specialized.colEvidence')}</th>
                <th scope="col" className="px-3 py-2">{t('annexes.specialized.colCriteria')}</th>
                <th scope="col" className="px-3 py-2">{t('annexes.specialized.colStatus')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visible.map((item) => (
                <tr key={`${item.pageUrl ?? ''}:${item.selector}`} className="align-top">
                  <td className="px-3 py-3">
                    <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                      {kindLabels[item.kind]}
                    </span>
                    <p className="mt-1 break-all font-mono text-xs text-gray-600">{item.selector}</p>
                  </td>
                  <td className="max-w-xs px-3 py-3 text-xs text-gray-700">
                    {item.source ?? t('annexes.specialized.sourceAbsent')}
                    {item.label && <p className="mt-1">{item.label}</p>}
                    {item.context && <p className="mt-1 text-gray-500">{item.context}</p>}
                  </td>
                  <td className="max-w-xs px-3 py-3 text-xs text-gray-700">
                    {item.evidence.length > 0 ? item.evidence.join(', ') : t('annexes.specialized.noEvidence')}
                    {item.flags.length > 0 && <p className="mt-2 break-words text-amber-900">{item.flags.join(', ')}</p>}
                  </td>
                  <td className="px-3 py-3 text-xs text-gray-700">{item.criterionIds.join(', ')}</td>
                  <td className="px-3 py-3 text-xs text-amber-900">{t('annexes.specialized.reviewRequired')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
