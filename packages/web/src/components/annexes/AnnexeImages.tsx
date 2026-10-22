import { useState, useEffect, useCallback, useRef } from 'react';
import { t } from '../../locales';
import ContrastPreview from '../ContrastPreview';

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
  alternativeSources?: Array<'alt' | 'aria-label' | 'aria-labelledby' | 'figcaption' | 'link-text' | 'surrounding-text'>;
  manualChecks?: string[];
  pageUrl?: string;
  pageId?: string;
  elementIndex?: number;
}

export interface ImageDecision {
  decision: 'decorative' | 'informative' | 'violation' | null;
  status: 'not_tested' | 'compliant' | 'non_compliant' | 'not_applicable';
  correctedAlt: string;
  notes: string;
  reviewedAt?: string | null;
}

export interface PersistedImageDecision extends ImageDecision {
  pageUrl: string;
  pageId?: string;
  selector: string;
  elementIndex?: number;
}

type FilterType = 'all' | 'violations' | 'warnings' | 'passes';

interface Props {
  images: ImageItem[];
  sessionId: string;
  initialDecisions?: PersistedImageDecision[];
  initialPageUrl?: string;
  initialPageId?: string;
  focusedSelectors?: string[];
  focusedElementIndexes?: number[];
  focusedCriterionId?: string;
  onSaved?: () => void | Promise<void>;
}

function storageKey(sessionId: string): string {
  return `rgaaudit-images-${sessionId}`;
}

function legacyImageKey(image: Pick<ImageItem, 'pageUrl' | 'pageId' | 'selector'>): string {
  return `${image.pageId ?? image.pageUrl ?? ''}\u001f${image.selector}`;
}

function imageKey(image: Pick<ImageItem, 'pageUrl' | 'pageId' | 'selector' | 'elementIndex'>): string {
  return image.elementIndex === undefined
    ? legacyImageKey(image)
    : `${image.pageId ?? image.pageUrl ?? ''}\u001findex:${image.elementIndex}`;
}

type ImageNature = 'decorative' | 'informative';

function suggestedNature(image: ImageItem): ImageNature {
  return image.altStatus === 'empty' ? 'decorative' : 'informative';
}

export function deriveImageStatus(
  image: ImageItem,
  decision: Pick<ImageDecision, 'decision' | 'correctedAlt'>,
): Extract<ImageDecision['status'], 'compliant' | 'non_compliant'> {
  if (image.altStatus === 'absent') return 'non_compliant';
  if (decision.correctedAlt.trim() !== '') return 'non_compliant';
  if (decision.decision !== suggestedNature(image)) return 'non_compliant';
  return 'compliant';
}

function emptyDecision(image: ImageItem): ImageDecision {
  const decision: ImageDecision = {
    decision: suggestedNature(image),
    status: 'compliant',
    correctedAlt: '',
    notes: '',
    reviewedAt: null,
  };
  return { ...decision, status: deriveImageStatus(image, decision) };
}

function normalizeDecision(decision: Partial<ImageDecision>, image?: ImageItem): ImageDecision {
  const wasLegacyViolation = decision.decision === 'violation';
  const normalized: ImageDecision = {
    decision: wasLegacyViolation
      ? 'informative'
      : (decision.decision ?? (image ? suggestedNature(image) : null)),
    status: decision.status ?? (wasLegacyViolation ? 'non_compliant' : image ? 'compliant' : 'not_tested'),
    correctedAlt: decision.correctedAlt ?? '',
    notes: decision.notes ?? '',
    reviewedAt: decision.reviewedAt ?? null,
  };
  return image
    ? { ...normalized, status: deriveImageStatus(image, normalized) }
    : normalized;
}

function resolveImageSrc(image: Pick<ImageItem, 'src' | 'pageUrl'> & { screenshotPath?: string | null }): string {
  if (image.screenshotPath) return image.screenshotPath;
  if (!image.src) return '';

  try {
    return new URL(image.src, image.pageUrl ?? window.location.href).href;
  } catch {
    return image.src;
  }
}

export default function AnnexeImages({
  images,
  sessionId,
  initialDecisions = [],
  initialPageUrl,
  initialPageId,
  focusedSelectors = [],
  focusedElementIndexes = [],
  focusedCriterionId,
  onSaved,
}: Props) {
  const [filter, setFilter] = useState<FilterType>('all');
  const [pageFilter, setPageFilter] = useState(initialPageId ?? initialPageUrl ?? '');
  const [search, setSearch] = useState('');
  const [showAllFocused, setShowAllFocused] = useState(false);
  const [dirtyKeys, setDirtyKeys] = useState<Set<string>>(new Set());
  const [savingAll, setSavingAll] = useState(false);
  const [savedAll, setSavedAll] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<Record<string, ImageDecision>>(() => {
    if (initialDecisions.length > 0) {
      return Object.fromEntries(initialDecisions.map((item) => [
        imageKey(item),
        normalizeDecision(item, images.find((image) => imageKey(image) === imageKey(item))),
      ]));
    }
    try {
      const saved = localStorage.getItem(storageKey(sessionId));
      if (!saved) return {};
      return Object.fromEntries(Object.entries(JSON.parse(saved) as Record<string, Partial<ImageDecision>>)
        .map(([key, decision]) => [
          key,
          normalizeDecision(decision, images.find((image) => imageKey(image) === key || image.selector === key)),
        ]));
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

  useEffect(() => {
    if (initialDecisions.length === 0) return;
    const serverDecisions = Object.fromEntries(initialDecisions.map((item) => [
      imageKey(item),
      normalizeDecision(item, images.find((image) => imageKey(image) === imageKey(item))),
    ]));
    setDecisions((current) => ({ ...current, ...serverDecisions }));
  }, [initialDecisions]);

  useEffect(() => {
    setPageFilter(initialPageId ?? initialPageUrl ?? '');
    setShowAllFocused(false);
    setFilter('all');
  }, [initialPageId, initialPageUrl, focusedCriterionId]);

  const updateDecision = useCallback((image: ImageItem, update: Partial<ImageDecision>) => {
    const key = imageKey(image);
    setDecisions((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] ?? emptyDecision(image)),
        ...update,
      },
    }));
    setDirtyKeys((current) => new Set(current).add(key));
    setSavedAll(false);
  }, []);

  const persistAll = useCallback(async () => {
    const pending = images
      .filter((image) => dirtyKeys.has(imageKey(image)))
      .map((image) => {
        const decision = decisions[imageKey(image)] ?? emptyDecision(image);
        const status = deriveImageStatus(image, decision);
        return {
          ...(image.pageId ? { pageId: image.pageId } : { pageUrl: image.pageUrl }),
          selector: image.selector,
          elementIndex: image.elementIndex,
          decision: decision.decision,
          status,
          correctedAlt: decision.correctedAlt,
          notes: decision.notes,
        };
      })
      .filter((decision) => Boolean(
        (decision as { pageId?: string; pageUrl?: string }).pageId
        || (decision as { pageId?: string; pageUrl?: string }).pageUrl,
      ));

    if (pending.length === 0) return;

    setSavingAll(true);
    setSavedAll(false);
    setSaveError(null);
    try {
      const response = await fetch(`/api/audit/${sessionId}/image-decisions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decisions: pending, markCriteriaNonCompliant: false }),
      });
      if (!response.ok) throw new Error(String(response.status));
      const payload = await response.json() as { review?: { imageDecisions?: PersistedImageDecision[] } };
      if (payload.review?.imageDecisions) {
        const savedDecisions = Object.fromEntries(payload.review.imageDecisions.map((item) => [
          imageKey(item), normalizeDecision(item, images.find((image) => imageKey(image) === imageKey(item))),
        ]));
        setDecisions((current) => ({ ...current, ...savedDecisions }));
      }
      setDirtyKeys(new Set());
      setSavedAll(true);
      await onSaved?.();
    } catch {
      setSaveError('Les modifications des images n’ont pas pu être enregistrées.');
    } finally {
      setSavingAll(false);
    }
  }, [decisions, dirtyKeys, images, onSaved, sessionId]);

  // Counts
  const violationCount = images.filter((img) => img.automatedStatus === 'violation').length;
  const warningCount = images.filter((img) => img.automatedStatus === 'manual').length;
  const passCount = images.filter((img) => img.automatedStatus === 'pass').length;

  // Unique pages
  const pages = [...new Map(images
    .filter((image) => image.pageUrl)
    .map((image) => [image.pageId ?? image.pageUrl!, { id: image.pageId ?? image.pageUrl!, url: image.pageUrl! }]),
  ).values()];
  const focusedSelectorSet = new Set(focusedSelectors);
  const focusedIndexSet = new Set(focusedElementIndexes);
  const usesIndexFocus = focusedElementIndexes.length > 0;
  const matchesFocus = (image: ImageItem) => usesIndexFocus
    ? image.elementIndex !== undefined && focusedIndexSet.has(image.elementIndex)
    : focusedSelectorSet.has(image.selector);
  const hasMatchingFocusedImages = (usesIndexFocus || focusedSelectors.length > 0) && images.some((image) => (
    (!initialPageId && !initialPageUrl || (image.pageId ?? image.pageUrl) === (initialPageId ?? initialPageUrl)) && matchesFocus(image)
  ));

  // Filter + sort
  const filtered = images
    .filter((img) => {
      if (filter === 'violations' && img.automatedStatus !== 'violation') return false;
      if (filter === 'warnings' && img.automatedStatus !== 'manual') return false;
      if (filter === 'passes' && img.automatedStatus !== 'pass') return false;
      if (pageFilter && (img.pageId ?? img.pageUrl) !== pageFilter) return false;
      if (hasMatchingFocusedImages && !showAllFocused && !matchesFocus(img)) return false;
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
    absent: 'text-red-700',
    empty: 'text-amber-800',
    present: 'text-green-800',
  };

  const tagColors: Record<string, string> = {
    img: 'bg-blue-100 text-blue-800',
    svg: 'bg-purple-100 text-purple-800',
    input: 'bg-gray-100 text-gray-800',
  };

  return (
    <div>
      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
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
            onChange={(e) => {
              setPageFilter(e.target.value);
              setShowAllFocused(true);
            }}
            className="ml-auto rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
            aria-label={t('annexes.images.filterByPage')}
          >
            <option value="">{t('annexes.images.allPages')}</option>
            {pages.map((p) => <option key={p.id} value={p.id}>{p.url} {p.id.startsWith('page-') ? `(${p.id.slice(-8)})` : ''}</option>)}
          </select>
        )}

        <div className="ml-auto flex items-center gap-2">
          {dirtyKeys.size > 0 && (
            <span className="text-xs text-amber-800">
              {dirtyKeys.size} modification(s) non enregistrée(s)
            </span>
          )}
          <button
            type="button"
            onClick={() => { void persistAll(); }}
            disabled={savingAll || dirtyKeys.size === 0}
            className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700 disabled:cursor-default disabled:opacity-50"
          >
            {savingAll ? 'Enregistrement…' : savedAll && dirtyKeys.size === 0 ? 'Tout est enregistré' : 'Enregistrer les modifications'}
          </button>
        </div>
      </div>

      {hasMatchingFocusedImages && !showAllFocused && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
          <span>
            {usesIndexFocus ? focusedElementIndexes.length : focusedSelectors.length} élément(s) lié(s) au critère {focusedCriterionId} sur {initialPageUrl}.
          </span>
          <button
            type="button"
            onClick={() => setShowAllFocused(true)}
            className="font-medium underline underline-offset-2"
          >
            Afficher toutes les images
          </button>
        </div>
      )}

      {saveError && (
        <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{saveError}</p>
      )}

      <div className="mb-4">
        <label htmlFor="image-search" className="sr-only">{t('annexes.images.searchPlaceholder')}</label>
        <input
          id="image-search"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('annexes.images.searchPlaceholder')}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <p className="text-sm text-gray-600 py-4">{t('annexes.images.noResults')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] text-sm text-left">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-2">{t('annexes.images.colThumbnail')}</th>
                <th className="px-3 py-2">Image analysée</th>
                <th className="px-3 py-2">Suggestion automatique</th>
                <th className="px-3 py-2">{t('annexes.images.colDecision')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((img) => {
                const key = imageKey(img);
                const isFirstSelectorOccurrence = images.findIndex((candidate) => (
                  (candidate.pageId ?? candidate.pageUrl) === (img.pageId ?? img.pageUrl)
                  && candidate.selector === img.selector
                )) === images.indexOf(img);
                const legacyDecision = isFirstSelectorOccurrence
                  ? decisions[legacyImageKey(img)] ?? decisions[img.selector]
                  : undefined;
                const storedDecision = decisions[key] ?? legacyDecision;
                const stored = storedDecision ?? emptyDecision(img);
                const dec = { ...stored, status: deriveImageStatus(img, stored) };
                const suggestion = suggestedNature(img);
                return (
                  <tr key={key} className="hover:bg-gray-50">
                    {/* Thumbnail */}
                    <td className="px-3 py-2">
                      {img.src ? (
                        <ContrastPreview
                          src={resolveImageSrc(img)}
                          width={80}
                          height={80}
                          alt=""
                          onImageError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                      ) : (
                        <div className="w-20 h-20 bg-gray-100 rounded border border-gray-200 flex items-center justify-center text-xs text-gray-600">
                          {img.tagName}
                        </div>
                      )}
                    </td>

                    {/* Analysed element */}
                    <td className="px-3 py-3 align-top">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tagColors[img.tagName] ?? 'bg-gray-100 text-gray-800'}`}>
                          {img.tagName}
                        </span>
                        {['1.1', '1.2', '1.3', '1.4', '1.5', '1.6', '1.7', '1.8'].map((criterion) => (
                          <a
                            key={criterion}
                            href={`#criterion-${criterion}`}
                            className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 hover:bg-primary-50 hover:text-primary-700"
                          >
                            {criterion}
                          </a>
                        ))}
                      </div>
                      <p className={`mt-2 break-words text-sm ${altColor[img.altStatus] ?? ''}`}>
                        <span className="font-medium text-gray-700">Alt actuel : </span>
                        {img.altStatus === 'absent'
                          ? t('annexes.images.altAbsent')
                          : img.altStatus === 'empty'
                            ? t('annexes.images.altEmpty')
                            : img.altAttribute}
                      </p>
                      {img.surroundingText && (
                        <p className="mt-1 max-w-72 text-xs text-gray-600" title={img.surroundingText}>
                          Contexte : {img.surroundingText.slice(0, 100)}{img.surroundingText.length > 100 ? '…' : ''}
                        </p>
                      )}
                      {img.alternativeSources && img.alternativeSources.length > 0 && (
                        <p className="mt-1 text-xs text-gray-600">
                          Alternatives détectées : {img.alternativeSources.join(', ')}
                        </p>
                      )}
                      {(img.manualChecks ?? []).length > 0 && (
                        <details className="mt-2 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-900">
                          <summary className="cursor-pointer font-medium">Contrôles manuels associés (1.4 à 1.8)</summary>
                          <ul className="mt-1 list-disc space-y-1 pl-4">
                            {img.manualChecks!.map((check) => <li key={check}>{check}</li>)}
                          </ul>
                        </details>
                      )}
                      <div className="mt-2 flex flex-wrap gap-1">
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

                    {/* Automatic suggestion */}
                    <td className="w-[24%] px-3 py-3 align-top">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${dec.status === 'non_compliant' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                        {dec.status === 'non_compliant' ? 'Non conforme' : 'Conforme'}
                      </span>
                      <p className="mt-2 text-xs text-gray-700">
                        Suggestion : <strong>{suggestion === 'decorative' ? 'décorative' : 'porteuse d’information'}</strong>
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        Signal automatique : {img.automatedStatus === 'violation'
                          ? 'anomalie probable'
                          : img.automatedStatus === 'manual'
                            ? 'à vérifier'
                            : 'aucune anomalie détectée'}
                      </p>
                    </td>

                    {/* Decision */}
                    <td className="min-w-[680px] px-3 py-3 align-top">
                      <div className="grid grid-cols-[180px_minmax(170px,0.8fr)_minmax(240px,1.2fr)] gap-3">
                        <label className="block text-xs font-medium text-gray-800">
                          Nature validée
                          <select
                            value={dec.decision ?? suggestion}
                            onChange={(event) => {
                              const option = event.target.value as ImageNature;
                              updateDecision(img, {
                                decision: option,
                              });
                            }}
                            className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-800"
                            aria-label={`Nature validée pour ${img.selector}`}
                          >
                            <option value="decorative">Décorative</option>
                            <option value="informative">Porteuse d’information</option>
                          </select>
                        </label>

                        {dec.decision !== 'informative' && (
                          <p className="pt-5 text-xs text-gray-600">Aucun texte alternatif attendu.</p>
                        )}

                        <div className="space-y-2">
                          {dec.decision === 'informative' && (
                            <label className="block text-xs font-medium text-gray-800">
                              Correction proposée du alt
                              <textarea
                                value={dec.correctedAlt}
                                onChange={(event) => updateDecision(img, { correctedAlt: event.target.value })}
                                placeholder="Texte alternatif corrigé"
                                className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                                rows={2}
                                maxLength={2_000}
                              />
                            </label>
                          )}

                          <label className="block text-xs font-medium text-gray-800">
                            Commentaire ou preuve
                            <textarea
                              value={dec.notes}
                              onChange={(event) => updateDecision(img, { notes: event.target.value })}
                              placeholder={t('annexes.images.decisionNotes')}
                              className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                              rows={2}
                              maxLength={5_000}
                            />
                          </label>
                        </div>
                      </div>

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
