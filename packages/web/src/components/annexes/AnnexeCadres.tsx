import { useEffect, useMemo, useState } from 'react';
import { t } from '../../locales';

export interface FrameItem {
  selector: string;
  tagName: string;
  src: string | null;
  sourceUrl?: string | null;
  origin?: string | null;
  evidenceStatus?: 'readable' | 'unreadable';
  elementIndex?: number;
  titleAttribute: string | null;
  titleStatus: 'absent' | 'empty' | 'present';
  titleEvidence?: {
    criterionId: '2.2';
    state: 'not_applicable' | 'to_review';
    proof: string[];
    limits: string[];
    humanChecks: string[];
  };
  flags: string[];
  pageUrl?: string;
  pageId?: string;
}

interface Props {
  frames: FrameItem[];
  sessionId: string;
  initialPageUrl?: string;
  initialPageId?: string;
  focusedSelectors?: string[];
  focusedCriterionId?: string;
}

export default function AnnexeCadres({
  frames,
  sessionId: _sessionId,
  initialPageUrl,
  initialPageId,
  focusedSelectors,
  focusedCriterionId,
}: Props) {
  const [pageFilter, setPageFilter] = useState(initialPageId ?? initialPageUrl ?? '');

  useEffect(() => setPageFilter(initialPageId ?? initialPageUrl ?? ''), [initialPageId, initialPageUrl]);

  const pages = useMemo(
    () => [...new Map(frames
      .filter((frame) => frame.pageUrl)
      .map((frame) => [frame.pageId ?? frame.pageUrl!, { id: frame.pageId ?? frame.pageUrl!, url: frame.pageUrl! }]),
    ).values()],
    [frames],
  );
  const selectorFilter = focusedSelectors && focusedSelectors.length > 0
    ? new Set(focusedSelectors)
    : null;
  const visibleFrames = frames.filter((frame) => (
    (!pageFilter || (frame.pageId ?? frame.pageUrl) === pageFilter)
    && (!selectorFilter || selectorFilter.has(frame.selector))
  ));
  const issueCount = visibleFrames.filter((frame) => (
    frame.titleStatus !== 'present' || frame.evidenceStatus === 'unreadable'
  )).length;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900">{t('annexes.frames.title')}</h2>
          <p className="mt-1 text-sm text-gray-600">{t('annexes.frames.description')}</p>
        </div>
        {pages.length > 1 && (
          <label className="text-xs text-gray-700">
            {t('annexes.frames.filterByPage')}
            <select
              value={pageFilter}
              onChange={(event) => setPageFilter(event.target.value)}
              className="ml-2 rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-700"
            >
              <option value="">{t('annexes.frames.allPages')}</option>
              {pages.map((page) => <option key={page.id} value={page.id}>{page.url} {page.id.startsWith('page-') ? `(${page.id.slice(-8)})` : ''}</option>)}
            </select>
          </label>
        )}
      </div>

      {focusedCriterionId && (
        <p className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
          {t('annexes.frames.focusedCriterion', {
            count: visibleFrames.length,
            criterion: focusedCriterionId,
          })}
        </p>
      )}

      {visibleFrames.length === 0 ? (
        <p className="py-4 text-sm text-gray-600">{t('annexes.frames.noResults')}</p>
      ) : (
        <>
          <p className={`mb-3 text-sm font-medium ${issueCount > 0 ? 'text-red-700' : 'text-green-700'}`}>
            {issueCount > 0
              ? t('annexes.frames.issueCount', { count: issueCount })
              : t('annexes.frames.noIssues')}
          </p>
          <div
            className="overflow-x-auto"
            role="region"
            tabIndex={0}
            aria-label={`${t('annexes.frames.title')} — faites défiler horizontalement pour consulter toutes les colonnes`}
          >
            <table className="w-full text-left text-sm">
              <caption className="sr-only">{t('annexes.frames.title')}</caption>
              <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-700">
                <tr>
                  <th scope="col" className="px-3 py-2">{t('annexes.frames.colSelector')}</th>
                  <th scope="col" className="px-3 py-2">{t('annexes.frames.colSource')}</th>
                  <th scope="col" className="px-3 py-2">{t('annexes.frames.colOrigin')}</th>
                  <th scope="col" className="px-3 py-2">{t('annexes.frames.colTitle')}</th>
                  <th scope="col" className="px-3 py-2">{t('annexes.frames.colStatus')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visibleFrames.map((frame) => (
                  <tr key={`${frame.pageId ?? frame.pageUrl ?? ''}-${frame.selector}`} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono text-xs text-gray-700">{frame.selector}</td>
                    <td className="max-w-64 break-all px-3 py-2 text-xs text-gray-700">
                      {frame.sourceUrl || frame.src || t('annexes.frames.sourceAbsent')}
                    </td>
                    <td className="max-w-48 break-all px-3 py-2 text-xs text-gray-700">
                      {frame.origin || t('annexes.frames.originAbsent')}
                    </td>
                    <td className="px-3 py-2 text-gray-800">
                      {frame.titleStatus === 'present'
                        ? frame.titleAttribute
                        : <span className="italic text-red-700">{t(`annexes.frames.title${frame.titleStatus === 'absent' ? 'Absent' : 'Empty'}`)}</span>}
                      {frame.titleEvidence && (
                        <details className="mt-2 text-xs text-gray-600">
                          <summary>Pertinence du titre — critère 2.2</summary>
                          <p className="mt-1">État : à vérifier</p>
                          <p className="mt-1">Preuves : {frame.titleEvidence.proof.join(' · ') || 'aucune'}</p>
                          <p className="mt-1">Limites : {frame.titleEvidence.limits.join(' · ') || 'aucune'}</p>
                          <p className="mt-1">Contrôles humains : {frame.titleEvidence.humanChecks.join(' · ') || 'aucun'}</p>
                        </details>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        frame.titleStatus === 'present' && frame.evidenceStatus !== 'unreadable'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {frame.evidenceStatus === 'unreadable'
                          ? t('annexes.frames.evidenceUnreadable')
                          : t(`annexes.frames.status${frame.titleStatus === 'present' ? 'Present' : 'Violation'}`)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
