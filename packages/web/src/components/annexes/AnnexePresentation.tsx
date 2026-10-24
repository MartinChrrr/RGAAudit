import { useEffect, useState } from 'react';
import { t } from '../../locales';

export interface PresentationFocusItem {
  selector: string;
  tagName: string;
  role: string | null;
  text: string | null;
  focusVisible: boolean;
  flags: string[];
}

export interface PresentationSnapshotItem {
  scenario: string;
  status: 'observed' | 'not_observed';
  viewportWidth: number | null;
  viewportHeight: number | null;
  documentScrollWidth: number | null;
  documentClientWidth: number | null;
  focusObservations?: PresentationFocusItem[];
  flags: string[];
  note?: string;
  pageUrl?: string;
  pageId?: string;
}

interface Props {
  snapshots: PresentationSnapshotItem[];
  initialPageUrl?: string;
  initialPageId?: string;
  focusedSelectors?: string[];
  focusedCriterionId?: string;
}

function scenarioLabel(scenario: string): string {
  const labels: Record<string, string> = {
    baseline: t('annexes.presentation.scenarioBaseline'),
    'styles-disabled': t('annexes.presentation.scenarioStylesDisabled'),
    'viewport-320x256': t('annexes.presentation.scenarioViewport320'),
    'zoom-200-probe': t('annexes.presentation.scenarioZoom200'),
  };
  return labels[scenario] ?? scenario;
}

function statusLabel(status: PresentationSnapshotItem['status']): string {
  return status === 'observed'
    ? t('annexes.presentation.statusObserved')
    : t('annexes.presentation.statusNotObserved');
}

function focusedTarget(value: string): { selector: string; scenario?: string } {
  const match = value.match(/^(.*)\[(baseline|styles-disabled|viewport-320x256|zoom-200-probe)\]$/);
  return match ? { selector: match[1], scenario: match[2] } : { selector: value };
}

export default function AnnexePresentation({
  snapshots,
  initialPageUrl,
  initialPageId,
  focusedSelectors = [],
  focusedCriterionId,
}: Props) {
  const pages = [...new Map(snapshots
    .filter((item) => item.pageUrl)
    .map((item) => [item.pageId ?? item.pageUrl!, { id: item.pageId ?? item.pageUrl!, url: item.pageUrl! }]),
  ).values()];
  const [pageFilter, setPageFilter] = useState(initialPageId ?? initialPageUrl ?? '');
  useEffect(() => setPageFilter(initialPageId ?? initialPageUrl ?? ''), [initialPageId, initialPageUrl]);
  const targets = focusedSelectors.map(focusedTarget);
  const visible = snapshots
    .filter((item) => !pageFilter || (item.pageId ?? item.pageUrl) === pageFilter)
    .map((item) => {
      if (targets.length === 0) return item;
      const matchingTargets = targets.filter((target) => !target.scenario || target.scenario === item.scenario);
      const documentTarget = matchingTargets.some((target) => target.selector === 'document');
      const focusObservations = documentTarget
        ? item.focusObservations
        : (item.focusObservations ?? []).filter((focus) => matchingTargets.some((target) => target.selector === focus.selector));
      return { ...item, focusObservations };
    })
    .filter((item) => targets.length === 0 || (item.focusObservations?.length ?? 0) > 0 || targets.some((target) => target.selector === 'document' && (!target.scenario || target.scenario === item.scenario)));

  return (
    <div data-testid="annexe-presentation">
      <h2 className="mb-2 text-base font-semibold text-gray-900">{t('annexes.presentation.title')}</h2>
      <p className="mb-4 text-sm text-gray-600">{t('annexes.presentation.description')}</p>
      {focusedCriterionId && <p className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">{t('annexes.presentation.focusedCriterion', { criterion: focusedCriterionId, count: visible.length })}</p>}
      {pages.length > 1 && (
        <label className="mb-4 block text-xs text-gray-700">
          {t('annexes.presentation.filterByPage')} :
          <select className="ml-2 rounded border border-gray-300 px-2 py-1" value={pageFilter} onChange={(event) => setPageFilter(event.target.value)}>
            <option value="">{t('annexes.presentation.allPages')}</option>
            {pages.map((page) => <option key={page.id} value={page.id}>{page.url}</option>)}
          </select>
        </label>
      )}
      {visible.length === 0 ? <p className="py-4 text-sm text-gray-600">{t('annexes.presentation.noResults')}</p> : (
        <div className="overflow-x-auto" role="region" tabIndex={0} aria-label={t('annexes.presentation.tableScrollLabel')}>
          <table className="w-full min-w-[1000px] text-left text-sm">
            <caption className="sr-only">{t('annexes.presentation.title')}</caption>
            <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-700"><tr>
              <th scope="col" className="px-3 py-2">{t('annexes.presentation.colScenario')}</th>
              <th scope="col" className="px-3 py-2">{t('annexes.presentation.colPage')}</th>
              <th scope="col" className="px-3 py-2">{t('annexes.presentation.colViewport')}</th>
              <th scope="col" className="px-3 py-2">{t('annexes.presentation.colFocus')}</th>
              <th scope="col" className="px-3 py-2">{t('annexes.presentation.colSignals')}</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {visible.map((snapshot, index) => (
                <tr key={`${snapshot.pageId ?? snapshot.pageUrl ?? ''}:${snapshot.scenario}:${index}`} className="align-top">
                  <td className="px-3 py-3 text-xs text-gray-700">{scenarioLabel(snapshot.scenario)}<br /><span className="text-gray-500">{statusLabel(snapshot.status)}</span></td>
                  <td className="break-all px-3 py-3 text-xs text-gray-700">{snapshot.pageUrl ?? '—'}</td>
                  <td className="px-3 py-3 text-xs text-gray-700">{snapshot.viewportWidth == null ? '—' : `${snapshot.viewportWidth} × ${snapshot.viewportHeight ?? '—'}`}<br />{snapshot.documentScrollWidth ?? '—'} / {snapshot.documentClientWidth ?? '—'}</td>
                  <td className="px-3 py-3 text-xs text-gray-700">{snapshot.focusObservations?.length ? snapshot.focusObservations.map((focus) => <div key={focus.selector}><code>{focus.selector}</code> — <span className={focus.focusVisible ? 'text-green-800' : 'text-amber-900'}>{focus.focusVisible ? t('annexes.presentation.focusVisible') : t('annexes.presentation.focusNotVisible')}</span></div>) : t('annexes.presentation.noFocusTarget')}</td>
                  <td className="px-3 py-3 text-xs text-amber-900">{snapshot.flags.join(', ') || '—'}{snapshot.note && <div className="mt-1">{snapshot.note}</div>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
