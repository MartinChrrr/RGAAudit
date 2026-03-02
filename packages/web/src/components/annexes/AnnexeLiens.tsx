import { useState, useMemo } from 'react';
import { t } from '../../locales';

export interface LinkItem {
  selector: string;
  tagName: string;
  accessibleLabel: string | null;
  href: string | null;
  opensNewWindow: boolean;
  hasNewWindowWarning: boolean;
  flags: string[];
  pageUrl?: string;
}

type FilterType = 'all' | 'empty' | 'generic' | 'duplicates' | 'newWindow';

interface Props {
  links: LinkItem[];
  sessionId: string;
}

interface DuplicateGroup {
  label: string;
  count: number;
  items: LinkItem[];
  expanded: boolean;
}

export default function AnnexeLiens({ links, sessionId: _sessionId }: Props) {
  const [filter, setFilter] = useState<FilterType>('all');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Counts
  const emptyCount = links.filter((l) => l.flags.includes('EMPTY_LABEL')).length;
  const genericCount = links.filter((l) => l.flags.includes('GENERIC_LABEL')).length;
  const newWindowCount = links.filter((l) => l.flags.includes('NEW_WINDOW_NO_WARNING')).length;

  // Build duplicate groups
  const duplicateGroups = useMemo(() => {
    const labelMap = new Map<string, LinkItem[]>();
    for (const link of links) {
      if (!link.accessibleLabel) continue;
      const key = link.accessibleLabel.toLowerCase().trim();
      if (!labelMap.has(key)) labelMap.set(key, []);
      labelMap.get(key)!.push(link);
    }
    const groups: DuplicateGroup[] = [];
    for (const [, items] of labelMap) {
      // Group by same label but different URLs
      const uniqueUrls = new Set(items.map((i) => i.href));
      if (uniqueUrls.size > 1 && items.length > 1) {
        groups.push({
          label: items[0].accessibleLabel!,
          count: items.length,
          items,
          expanded: false,
        });
      }
    }
    return groups.sort((a, b) => b.count - a.count);
  }, [links]);

  const duplicateCount = duplicateGroups.reduce((sum, g) => sum + g.count, 0);

  function toggleGroup(label: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  // Apply filter
  const filtered = useMemo(() => {
    switch (filter) {
      case 'empty': return links.filter((l) => l.flags.includes('EMPTY_LABEL'));
      case 'generic': return links.filter((l) => l.flags.includes('GENERIC_LABEL'));
      case 'newWindow': return links.filter((l) => l.flags.includes('NEW_WINDOW_NO_WARNING'));
      case 'duplicates': return null; // handled separately
      default: return links;
    }
  }, [links, filter]);

  const typeColors: Record<string, string> = {
    a: 'bg-blue-100 text-blue-800',
    button: 'bg-purple-100 text-purple-800',
    input: 'bg-gray-100 text-gray-800',
  };

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <FilterButton active={filter === 'all'} onClick={() => setFilter('all')}>
          {t('annexes.links.filterAll')}
        </FilterButton>
        <FilterButton active={filter === 'empty'} onClick={() => setFilter('empty')}>
          {t('annexes.links.filterEmpty')} ({emptyCount})
        </FilterButton>
        <FilterButton active={filter === 'generic'} onClick={() => setFilter('generic')}>
          {t('annexes.links.filterGeneric')} ({genericCount})
        </FilterButton>
        <FilterButton active={filter === 'duplicates'} onClick={() => setFilter('duplicates')}>
          {t('annexes.links.filterDuplicates')} ({duplicateCount})
        </FilterButton>
        <FilterButton active={filter === 'newWindow'} onClick={() => setFilter('newWindow')}>
          {t('annexes.links.filterNewWindow')} ({newWindowCount})
        </FilterButton>
      </div>

      {/* Duplicate groups view */}
      {filter === 'duplicates' ? (
        duplicateGroups.length === 0 ? (
          <p className="text-sm text-gray-500 py-4">{t('annexes.links.noResults')}</p>
        ) : (
          <div className="space-y-2">
            {duplicateGroups.map((group) => (
              <div key={group.label} className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.label)}
                  className="w-full flex items-center justify-between px-4 py-3 text-sm text-left hover:bg-gray-50 transition-colors"
                  aria-expanded={expandedGroups.has(group.label)}
                >
                  <span className="font-medium text-gray-800" data-testid="duplicate-label">
                    {t('annexes.links.duplicateCount', { label: group.label, count: group.count })}
                  </span>
                  <span className={`transition-transform ${expandedGroups.has(group.label) ? 'rotate-90' : ''}`}>&#x25B6;</span>
                </button>
                {expandedGroups.has(group.label) && (
                  <ul className="border-t border-gray-100 divide-y divide-gray-50">
                    {group.items.map((item, i) => (
                      <li key={i} className="px-4 py-2 text-xs text-gray-600 flex items-center gap-2">
                        <span className="truncate flex-1">{item.href}</span>
                        {item.pageUrl && <span className="text-gray-400 truncate max-w-32">{item.pageUrl}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )
      ) : (
        /* Standard table view */
        filtered && filtered.length === 0 ? (
          <p className="text-sm text-gray-500 py-4">{t('annexes.links.noResults')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-2">{t('annexes.links.colPage')}</th>
                  <th className="px-3 py-2">{t('annexes.links.colLabel')}</th>
                  <th className="px-3 py-2">{t('annexes.links.colType')}</th>
                  <th className="px-3 py-2">{t('annexes.links.colTarget')}</th>
                  <th className="px-3 py-2">{t('annexes.links.colFlags')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered?.map((link, i) => (
                  <tr key={`${link.selector}-${i}`} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-xs text-gray-500 max-w-32 truncate">{link.pageUrl ?? ''}</td>
                    <td className="px-3 py-2">
                      {link.accessibleLabel ? (
                        <span className="text-gray-800">{link.accessibleLabel}</span>
                      ) : (
                        <span className="text-red-600 italic">{t('annexes.links.filterEmpty')}</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${typeColors[link.tagName] ?? 'bg-gray-100 text-gray-800'}`}>
                        {link.tagName}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500 max-w-48 truncate" title={link.href ?? ''}>
                      {link.href}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {link.flags.map((flag) => (
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
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
