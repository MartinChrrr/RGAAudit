import { useState, useEffect, useCallback, useRef } from 'react';
import { t } from '../../locales';

export interface ImageItem {
  selector: string;
  tagName: string;
  src: string;
  altAttribute: string | null;
  altStatus: 'absent' | 'empty' | 'present';
  automatedStatus: 'violation' | 'pass' | 'manual';
  flags: string[];
  surroundingText: string;
  screenshotPath: string | null;
  isInLink: boolean;
  linkText: string | null;
  pageUrl?: string;
}

export interface ImageDecision {
  decision: 'decorative' | 'informative' | 'violation' | null;
  notes: string;
}

type FilterType = 'all' | 'violations' | 'warnings' | 'passes';

interface Props {
  images: ImageItem[];
  sessionId: string;
}

function storageKey(sessionId: string): string {
  return `rgaaudit-images-${sessionId}`;
}

export default function AnnexeImages({ images, sessionId }: Props) {
  const [filter, setFilter] = useState<FilterType>('all');
  const [pageFilter, setPageFilter] = useState('');
  const [search, setSearch] = useState('');
  const [decisions, setDecisions] = useState<Record<string, ImageDecision>>(() => {
    try {
      const saved = localStorage.getItem(storageKey(sessionId));
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Persist to localStorage with debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      localStorage.setItem(storageKey(sessionId), JSON.stringify(decisions));
    }, 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [decisions, sessionId]);

  const updateDecision = useCallback((selector: string, field: keyof ImageDecision, value: string | null) => {
    setDecisions((prev) => ({
      ...prev,
      [selector]: {
        ...prev[selector] ?? { decision: null, notes: '' },
        [field]: value,
      },
    }));
  }, []);

  // Counts
  const violationCount = images.filter((img) => img.automatedStatus === 'violation').length;
  const warningCount = images.filter((img) => img.automatedStatus === 'manual').length;
  const passCount = images.filter((img) => img.automatedStatus === 'pass').length;

  // Unique pages
  const pages = [...new Set(images.map((img) => img.pageUrl).filter(Boolean))] as string[];

  // Filter + sort
  const filtered = images
    .filter((img) => {
      if (filter === 'violations' && img.automatedStatus !== 'violation') return false;
      if (filter === 'warnings' && img.automatedStatus !== 'manual') return false;
      if (filter === 'passes' && img.automatedStatus !== 'pass') return false;
      if (pageFilter && img.pageUrl !== pageFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const altMatch = img.altAttribute?.toLowerCase().includes(q);
        const srcMatch = img.src.toLowerCase().includes(q);
        if (!altMatch && !srcMatch) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const order: Record<string, number> = { violation: 0, manual: 1, pass: 2 };
      return (order[a.automatedStatus] ?? 3) - (order[b.automatedStatus] ?? 3);
    });

  const altColor: Record<string, string> = {
    absent: 'text-red-600',
    empty: 'text-amber-600',
    present: 'text-green-700',
  };

  const tagColors: Record<string, string> = {
    img: 'bg-blue-100 text-blue-800',
    svg: 'bg-purple-100 text-purple-800',
    input: 'bg-gray-100 text-gray-800',
  };

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <FilterButton active={filter === 'all'} onClick={() => setFilter('all')}>
          {t('annexes.images.filterAll')}
        </FilterButton>
        <FilterButton active={filter === 'violations'} onClick={() => setFilter('violations')}>
          {t('annexes.images.filterViolations')} ({violationCount})
        </FilterButton>
        <FilterButton active={filter === 'warnings'} onClick={() => setFilter('warnings')}>
          {t('annexes.images.filterWarnings')} ({warningCount})
        </FilterButton>
        <FilterButton active={filter === 'passes'} onClick={() => setFilter('passes')}>
          {t('annexes.images.filterPasses')} ({passCount})
        </FilterButton>

        {pages.length > 1 && (
          <select
            value={pageFilter}
            onChange={(e) => setPageFilter(e.target.value)}
            className="ml-auto rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
            aria-label={t('annexes.images.filterByPage')}
          >
            <option value="">{t('annexes.images.allPages')}</option>
            {pages.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        )}
      </div>

      <div className="mb-4">
        <label htmlFor="image-search" className="sr-only">{t('annexes.images.searchPlaceholder')}</label>
        <input
          id="image-search"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('annexes.images.searchPlaceholder')}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <p className="text-sm text-gray-500 py-4">{t('annexes.images.noResults')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-2">{t('annexes.images.colThumbnail')}</th>
                <th className="px-3 py-2">{t('annexes.images.colTag')}</th>
                <th className="px-3 py-2">{t('annexes.images.colAlt')}</th>
                <th className="px-3 py-2">{t('annexes.images.colFlags')}</th>
                <th className="px-3 py-2">{t('annexes.images.colContext')}</th>
                <th className="px-3 py-2">{t('annexes.images.colCriteria')}</th>
                <th className="px-3 py-2">{t('annexes.images.colDecision')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((img) => {
                const dec = decisions[img.selector] ?? { decision: null, notes: '' };
                return (
                  <tr key={img.selector + (img.pageUrl ?? '')} className="hover:bg-gray-50">
                    {/* Thumbnail */}
                    <td className="px-3 py-2">
                      {img.src ? (
                        <img
                          src={img.screenshotPath ?? img.src}
                          width={80}
                          height={80}
                          className="object-contain rounded border border-gray-200 bg-gray-50"
                          alt=""
                          loading="lazy"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      ) : (
                        <div className="w-20 h-20 bg-gray-100 rounded border border-gray-200 flex items-center justify-center text-xs text-gray-400">
                          {img.tagName}
                        </div>
                      )}
                    </td>

                    {/* Tag */}
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tagColors[img.tagName] ?? 'bg-gray-100 text-gray-800'}`}>
                        {img.tagName}
                      </span>
                    </td>

                    {/* Alt */}
                    <td className={`px-3 py-2 ${altColor[img.altStatus] ?? ''}`}>
                      {img.altStatus === 'absent'
                        ? t('annexes.images.altAbsent')
                        : img.altStatus === 'empty'
                          ? t('annexes.images.altEmpty')
                          : img.altAttribute}
                    </td>

                    {/* Flags */}
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {img.flags.map((flag) => (
                          <span
                            key={flag}
                            className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-xs cursor-help"
                            title={t(`flags.${flag}`)}
                          >
                            {flag}
                          </span>
                        ))}
                      </div>
                    </td>

                    {/* Context */}
                    <td className="px-3 py-2 max-w-48">
                      <span
                        className="text-xs text-gray-600 truncate block"
                        title={img.surroundingText}
                      >
                        {img.surroundingText.slice(0, 60)}
                        {img.surroundingText.length > 60 ? '…' : ''}
                      </span>
                    </td>

                    {/* Criteria badges */}
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        {['1.1', '1.2', '1.6'].map((crit) => (
                          <span key={crit} className="rounded-full bg-gray-100 text-gray-600 px-2 py-0.5 text-xs">
                            {crit}
                          </span>
                        ))}
                      </div>
                    </td>

                    {/* Decision */}
                    <td className="px-3 py-2">
                      <fieldset>
                        <legend className="sr-only">{t('annexes.images.colDecision')}</legend>
                        <div className="space-y-1">
                          {(['decorative', 'informative', 'violation'] as const).map((opt) => (
                            <label key={opt} className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer">
                              <input
                                type="radio"
                                name={`decision-${img.selector}`}
                                checked={dec.decision === opt}
                                onChange={() => updateDecision(img.selector, 'decision', opt)}
                                className="h-3 w-3 text-primary-600 focus:ring-primary-500"
                              />
                              {t(`annexes.images.decision${opt.charAt(0).toUpperCase() + opt.slice(1)}`)}
                            </label>
                          ))}
                        </div>
                        <textarea
                          value={dec.notes}
                          onChange={(e) => updateDecision(img.selector, 'notes', e.target.value)}
                          placeholder={t('annexes.images.decisionNotes')}
                          className="mt-1 w-full rounded border border-gray-200 px-2 py-1 text-xs text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-primary-500"
                          rows={1}
                        />
                      </fieldset>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? 'bg-primary-600 text-white'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      }`}
    >
      {children}
    </button>
  );
}
