import { useState } from 'react';
import { t } from '../../locales';

export interface HeuristicFindingItem {
  selector: string;
  html: string;
  evidence: string;
  confidence: 'certain' | 'likely' | 'possible';
  context: string;
  heuristicId: string;
  rgaaCriteria: string[];
  pageUrl?: string;
}

interface Props {
  findings: HeuristicFindingItem[];
  sessionId: string;
}

type SubTab = 'interactive' | 'structure' | 'svg';
type ConfidenceFilter = 'all' | 'certain' | 'likely';

const HEURISTIC_TO_SUBTAB: Record<string, SubTab> = {
  'fake-interactive': 'interactive',
  'unsemantic-text': 'structure',
  'svg-accessible': 'svg',
};

const SUBTAB_ICONS: Record<SubTab, string> = {
  interactive: '\uD83D\uDD17',
  structure: '\uD83D\uDCDD',
  svg: '\uD83D\uDDBC\uFE0F',
};

const CONFIDENCE_BADGES: Record<string, { icon: string; className: string }> = {
  certain: { icon: '\u274C', className: 'bg-red-100 text-red-800' },
  likely: { icon: '\u26A0\uFE0F', className: 'bg-amber-100 text-amber-800' },
  possible: { icon: '\uD83D\uDD0D', className: 'bg-blue-100 text-blue-800' },
};

export default function AnnexeHeuristiques({ findings }: Props) {
  const [subTab, setSubTab] = useState<SubTab>('interactive');
  const [confidenceFilter, setConfidenceFilter] = useState<ConfidenceFilter>('all');
  const [showPossible, setShowPossible] = useState(false);
  const [copiedSelector, setCopiedSelector] = useState<string | null>(null);
  const [pageFilter, setPageFilter] = useState<string>('');

  // Group findings by sub-tab
  const grouped: Record<SubTab, HeuristicFindingItem[]> = {
    interactive: [],
    structure: [],
    svg: [],
  };

  for (const f of findings) {
    const tab = HEURISTIC_TO_SUBTAB[f.heuristicId] ?? 'interactive';
    grouped[tab].push(f);
  }

  // Count per sub-tab (excluding possible if not shown)
  const countFor = (tab: SubTab) => {
    const items = grouped[tab];
    if (showPossible) return items.length;
    return items.filter((f) => f.confidence !== 'possible').length;
  };

  // Filter current sub-tab findings
  let filtered = grouped[subTab];

  // Page filter
  if (pageFilter) {
    filtered = filtered.filter((f) => f.pageUrl === pageFilter);
  }

  // Hide "possible" by default
  if (!showPossible) {
    filtered = filtered.filter((f) => f.confidence !== 'possible');
  }

  // Confidence filter
  if (confidenceFilter !== 'all') {
    filtered = filtered.filter((f) => f.confidence === confidenceFilter);
  }

  // Get unique pages for the page filter
  const allPages = [...new Set(findings.filter((f) => f.pageUrl).map((f) => f.pageUrl!))];

  const handleCopySelector = async (selector: string) => {
    try {
      await navigator.clipboard.writeText(selector);
      setCopiedSelector(selector);
      setTimeout(() => setCopiedSelector(null), 1500);
    } catch {
      // Clipboard not available
    }
  };

  return (
    <div>
      {/* Header description */}
      <p className="text-sm text-gray-600 mb-4" data-testid="heuristics-description">
        {t('annexes.heuristics.description')}
      </p>

      {/* Sub-tabs */}
      <div className="flex border-b border-gray-200 mb-4" role="tablist">
        {(['interactive', 'structure', 'svg'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setSubTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              subTab === tab
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-gray-600 hover:text-gray-800'
            }`}
            aria-selected={subTab === tab}
            role="tab"
            data-testid={`subtab-${tab}`}
          >
            {SUBTAB_ICONS[tab]} {t(`annexes.heuristics.tab${tab.charAt(0).toUpperCase() + tab.slice(1)}`)} ({countFor(tab)})
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex gap-1">
          {(['all', 'certain', 'likely'] as const).map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => setConfidenceFilter(level)}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                confidenceFilter === level
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              data-testid={`filter-${level}`}
            >
              {level === 'all'
                ? t('annexes.heuristics.filterAll')
                : level === 'certain'
                  ? `${CONFIDENCE_BADGES.certain.icon} ${t('annexes.heuristics.filterCertain')}`
                  : `${CONFIDENCE_BADGES.likely.icon} ${t('annexes.heuristics.filterLikely')}`}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 text-xs text-gray-600">
          <input
            type="checkbox"
            checked={showPossible}
            onChange={(e) => setShowPossible(e.target.checked)}
            data-testid="toggle-possible"
          />
          {t('annexes.heuristics.togglePossible')}
        </label>

        {allPages.length > 1 && (
          <select
            value={pageFilter}
            onChange={(e) => setPageFilter(e.target.value)}
            className="text-xs border border-gray-300 rounded px-2 py-1"
            data-testid="page-filter"
          >
            <option value="">{t('annexes.heuristics.allPages')}</option>
            {allPages.map((url) => (
              <option key={url} value={url}>
                {url}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Findings list */}
      {filtered.length === 0 ? (
        <p className="text-sm text-gray-600 py-8 text-center" data-testid="no-findings">
          {t('annexes.heuristics.noFindings')}
        </p>
      ) : (
        <div className="space-y-3" data-testid="findings-list">
          {filtered.map((finding, i) => {
            const badge = CONFIDENCE_BADGES[finding.confidence];
            return (
              <div
                key={`${finding.selector}-${i}`}
                className="border border-gray-200 rounded-lg p-4"
                data-testid="finding-card"
                data-confidence={finding.confidence}
              >
                <div className="flex items-start justify-between mb-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.className}`}
                    data-testid="confidence-badge"
                  >
                    {badge.icon}{' '}
                    {t(`annexes.heuristics.badge${finding.confidence.charAt(0).toUpperCase() + finding.confidence.slice(1)}`)}
                  </span>
                  <div className="flex gap-1">
                    {finding.rgaaCriteria.map((c) => (
                      <a
                        key={c}
                        href={`#criterion-${c}`}
                        className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-mono text-gray-700 hover:bg-gray-200 transition-colors"
                        data-testid="criteria-badge"
                      >
                        {c}
                      </a>
                    ))}
                  </div>
                </div>

                {/* Selector — copiable */}
                <button
                  type="button"
                  onClick={() => handleCopySelector(finding.selector)}
                  className="block w-full text-left mb-2 font-mono text-xs text-gray-700 bg-gray-50 rounded px-2 py-1 hover:bg-gray-100 transition-colors cursor-pointer"
                  title={finding.selector}
                  data-testid="selector-copy"
                >
                  {copiedSelector === finding.selector
                    ? t('annexes.heuristics.copied')
                    : finding.selector}
                </button>

                {/* HTML excerpt */}
                <pre className="text-xs text-gray-500 bg-gray-50 rounded px-2 py-1 mb-2 overflow-x-auto whitespace-pre-wrap break-all" data-testid="html-excerpt">
                  {finding.html.slice(0, 80)}
                </pre>

                {/* Evidence */}
                <p className="text-sm text-gray-800 mb-1" data-testid="evidence">
                  {finding.evidence}
                </p>

                {/* Context */}
                {finding.context && (
                  <p className="text-xs text-gray-600" data-testid="finding-context">
                    {t('annexes.heuristics.colContext')} : {finding.context}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
