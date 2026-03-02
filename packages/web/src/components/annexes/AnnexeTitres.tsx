import { useState } from 'react';
import { t } from '../../locales';

export interface HeadingItem {
  level: number;
  text: string;
  selector: string;
  flags: Array<string | { flag: string; skipFrom: number; skipTo: number }>;
}

export interface HeadingTreeData {
  url: string;
  documentTitle: string;
  headings: HeadingItem[];
  flags: string[];
}

interface Props {
  headingData: HeadingTreeData[];
  sessionId: string;
}

export default function AnnexeTitres({ headingData, sessionId: _sessionId }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (headingData.length === 0) {
    return <p className="text-sm text-gray-500 py-4">{t('annexes.headings.noHeadings')}</p>;
  }

  const current = headingData[currentIndex];

  // Count issues
  const issueCount = current.headings.reduce((sum, h) => {
    return sum + h.flags.filter((f) => typeof f === 'object' || f === 'LEVEL_SKIP').length;
  }, 0) + current.flags.filter((f) => f !== 'LEVEL_SKIP').length;

  const titleStatus = current.flags.includes('TITLE_ABSENT')
    ? 'absent'
    : current.flags.includes('TITLE_GENERIC')
      ? 'generic'
      : 'ok';

  return (
    <div>
      {/* Page selector */}
      <div className="flex items-center gap-3 mb-4">
        <label htmlFor="heading-page-select" className="sr-only">{t('annexes.headings.selectPage')}</label>
        <select
          id="heading-page-select"
          value={currentIndex}
          onChange={(e) => setCurrentIndex(Number(e.target.value))}
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          {headingData.map((page, i) => (
            <option key={page.url} value={i}>{page.url}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
          disabled={currentIndex === 0}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label={t('annexes.headings.prev')}
        >
          {t('annexes.headings.prev')}
        </button>
        <button
          type="button"
          onClick={() => setCurrentIndex((prev) => Math.min(headingData.length - 1, prev + 1))}
          disabled={currentIndex === headingData.length - 1}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label={t('annexes.headings.next')}
        >
          {t('annexes.headings.next')}
        </button>
      </div>

      {/* Summary badge */}
      <div className="mb-4">
        {issueCount === 0 ? (
          <span className="inline-flex items-center rounded-full bg-green-100 text-green-800 px-3 py-1 text-sm font-medium">
            {t('annexes.headings.structureOk')}
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 px-3 py-1 text-sm font-medium">
            {t('annexes.headings.structureIssues', { count: issueCount })}
          </span>
        )}
      </div>

      {/* Page title */}
      <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
        <span className="text-xs text-gray-500 uppercase">{t('annexes.headings.pageTitle')}</span>
        <div className="flex items-center gap-2 mt-1">
          {titleStatus === 'absent' ? (
            <span className="text-red-600 text-sm">{t('annexes.headings.titleAbsent')}</span>
          ) : titleStatus === 'generic' ? (
            <>
              <span className="text-amber-600 text-sm">{current.documentTitle}</span>
              <span className="text-xs text-amber-500">({t('annexes.headings.titleGeneric')})</span>
            </>
          ) : (
            <span className="text-green-700 text-sm">{current.documentTitle}</span>
          )}
        </div>
      </div>

      {/* Heading tree */}
      {current.headings.length === 0 ? (
        <p className="text-sm text-gray-500 py-4">{t('annexes.headings.noHeadings')}</p>
      ) : (
        <ul className="space-y-1">
          {current.headings.map((heading, i) => {
            const indent = (heading.level - 1) * 16;
            const skipFlag = heading.flags.find(
              (f): f is { flag: string; skipFrom: number; skipTo: number } => typeof f === 'object',
            );

            return (
              <li key={`${heading.selector}-${i}`}>
                {skipFlag && (
                  <div
                    className="text-xs text-red-600 font-medium py-1 border-l-2 border-red-300 mb-1"
                    style={{ paddingLeft: `${indent}px` }}
                    data-testid="level-skip"
                  >
                    {t('annexes.headings.levelSkip', {
                      from: skipFlag.skipFrom,
                      to: skipFlag.skipTo,
                      missing: skipFlag.skipFrom + 1,
                    })}
                  </div>
                )}
                <div
                  className={`flex items-center gap-2 py-1 rounded px-2 ${skipFlag ? 'bg-red-50' : 'hover:bg-gray-50'}`}
                  style={{ paddingLeft: `${indent}px` }}
                >
                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs font-bold ${
                    skipFlag ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    h{heading.level}
                  </span>
                  <span className="text-sm text-gray-800">{heading.text || '(vide)'}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
