import { useEffect, useState } from 'react';
import { t } from '../../locales';

export interface MediaTrackItem {
  kind: 'subtitles' | 'captions' | 'descriptions' | 'chapters' | 'metadata' | 'unknown';
  src: string | null;
  srcLang: string | null;
  label: string | null;
  isDefault: boolean;
}

export interface MediaItem {
  selector: string;
  kind: 'audio' | 'video' | 'canvas' | 'object' | 'embed';
  sources: string[];
  accessibleName: string | null;
  fallbackText: string | null;
  surroundingText: string;
  controls: boolean;
  autoplay: boolean;
  tracks: MediaTrackItem[];
  alternativeSources: string[];
  criterionIds: string[];
  manualChecks: string[];
  flags: string[];
  requiresHumanReview: true;
  pageUrl?: string;
  pageId?: string;
}

interface Props {
  media: MediaItem[];
  initialPageUrl?: string;
  initialPageId?: string;
}

function trackLabel(track: MediaTrackItem): string {
  const label = track.label ?? track.kind;
  const language = track.srcLang ? ` · ${track.srcLang}` : '';
  const defaultMarker = track.isDefault ? ' · par défaut' : '';
  return `${label}${language}${defaultMarker}`;
}

export default function AnnexeMedias({ media, initialPageUrl, initialPageId }: Props) {
  const pages = [...new Map(media
    .filter((item) => item.pageUrl)
    .map((item) => [item.pageId ?? item.pageUrl!, { id: item.pageId ?? item.pageUrl!, url: item.pageUrl! }]),
  ).values()];
  const [pageFilter, setPageFilter] = useState(initialPageId ?? initialPageUrl ?? '');

  useEffect(() => {
    setPageFilter(initialPageId ?? initialPageUrl ?? '');
  }, [initialPageId, initialPageUrl]);

  const visible = pageFilter ? media.filter((item) => (item.pageId ?? item.pageUrl) === pageFilter) : media;

  return (
    <div data-testid="annexe-media">
      <p className="mb-4 text-sm text-gray-600">{t('annexes.media.description')}</p>
      {pages.length > 1 && (
        <div className="mb-4 text-xs text-gray-600">
          <label htmlFor="media-page-filter" className="mr-2">{t('annexes.media.filterByPage')} :</label>
          <select
            id="media-page-filter"
            className="rounded border border-gray-300 bg-white px-2 py-1 text-xs"
            value={pageFilter}
            onChange={(event) => setPageFilter(event.target.value)}
          >
            <option value="">{t('annexes.media.allPages')}</option>
            {pages.map((page) => <option key={page.id} value={page.id}>{page.url} {page.id.startsWith('page-') ? `(${page.id.slice(-8)})` : ''}</option>)}
          </select>
        </div>
      )}
      {visible.length === 0 ? (
        <p className="py-4 text-sm text-gray-600">{t('annexes.media.noResults')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-sm">
            <caption className="sr-only">{t('annexes.media.title')}</caption>
            <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-700">
              <tr>
                <th scope="col" className="px-3 py-2">{t('annexes.media.colType')}</th>
                <th scope="col" className="px-3 py-2">{t('annexes.media.colSource')}</th>
                <th scope="col" className="px-3 py-2">{t('annexes.media.colContext')}</th>
                <th scope="col" className="px-3 py-2">{t('annexes.media.colAlternatives')}</th>
                <th scope="col" className="px-3 py-2">{t('annexes.media.colTracks')}</th>
                <th scope="col" className="px-3 py-2">{t('annexes.media.manualChecks')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visible.map((item) => (
                <tr key={`${item.pageId ?? item.pageUrl ?? ''}:${item.selector}`} className="align-top">
                  <td className="px-3 py-3">
                    <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                      {item.kind}
                    </span>
                    <p className="mt-1 break-all font-mono text-xs text-gray-600">{item.selector}</p>
                    <p className="mt-1 text-xs text-amber-900">Revue humaine requise</p>
                  </td>
                  <td className="max-w-xs px-3 py-3 text-xs text-gray-700">
                    {item.sources.length > 0 ? (
                      <ul className="space-y-1">
                        {item.sources.map((source) => <li key={source} className="break-all">{source}</li>)}
                      </ul>
                    ) : 'Source absente'}
                  </td>
                  <td className="max-w-xs px-3 py-3 text-xs text-gray-700">
                    {item.pageUrl && <p className="break-all font-medium">{item.pageUrl}</p>}
                    {item.accessibleName && <p className="mt-1">Nom : {item.accessibleName}</p>}
                    {item.surroundingText && <p className="mt-1">{item.surroundingText}</p>}
                    <p className="mt-1">Contrôles : {item.controls ? 'oui' : 'non'} · Autoplay : {item.autoplay ? 'oui' : 'non'}</p>
                  </td>
                  <td className="px-3 py-3 text-xs text-gray-700">
                    {item.alternativeSources.length > 0 ? item.alternativeSources.join(', ') : t('annexes.media.noAlternative')}
                    {item.fallbackText && <p className="mt-1 italic">{item.fallbackText}</p>}
                  </td>
                  <td className="px-3 py-3 text-xs text-gray-700">
                    {item.tracks.length > 0 ? (
                      <ul className="space-y-1">
                        {item.tracks.map((track, index) => <li key={`${track.src ?? track.kind}-${index}`}>{trackLabel(track)}</li>)}
                      </ul>
                    ) : t('annexes.media.noTracks')}
                  </td>
                  <td className="px-3 py-3 text-xs text-amber-900">
                    <ul className="list-disc space-y-1 pl-4">
                      {item.manualChecks.map((check) => <li key={check}>{check}</li>)}
                    </ul>
                    {item.flags.length > 0 && <p className="mt-2 break-words">Signaux : {item.flags.join(', ')}</p>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
