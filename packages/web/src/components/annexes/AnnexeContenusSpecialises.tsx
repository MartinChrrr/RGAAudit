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
  documentEvidence?: {
    state: 'proof' | 'violation' | 'to_review' | 'manual';
    declaredMime: string | null;
    declaredSizeBytes: number | null;
    downloadDeclared: boolean;
    sourceExtension: string | null;
    localAnalysis: 'not_executed';
    proof: string[];
    limits: string[];
    humanChecks: string[];
  };
  pageUrl?: string;
  pageId?: string;
}

interface Props {
  items: SpecializedContentItem[];
  initialPageUrl?: string;
  initialPageId?: string;
}

const kindLabels: Record<SpecializedContentItem['kind'], string> = {
  media: 'Média',
  captcha: 'CAPTCHA',
  document: 'Document',
};

const signalLabels: Record<string, string> = {
  CAPTCHA_REQUIRES_HUMAN_REVIEW: 'Vérification humaine du CAPTCHA à effectuer',
  CAPTCHA_ALTERNATIVE_ABSENT: 'Alternative du CAPTCHA non observée',
  DOCUMENT_REQUIRES_HUMAN_REVIEW: 'Accessibilité du document à vérifier',
  DOCUMENT_ACCESSIBLE_VERSION_UNKNOWN: 'Version accessible non identifiée',
  MEDIA_REQUIRES_HUMAN_REVIEW: 'Écoute ou visionnage requis',
  SPECIALIZED_EVIDENCE_TRUNCATED: 'Preuves tronquées pour limiter le volume',
  DOCUMENT_MIME_HTTP_UNKNOWN: 'MIME HTTP non récupéré — à vérifier',
  DOCUMENT_SIZE_HTTP_UNKNOWN: 'Taille HTTP non récupérée — à vérifier',
  DOCUMENT_LOCAL_ANALYSIS_NOT_EXECUTED: 'Analyse locale non exécutée automatiquement',
  DOCUMENT_DOWNLOAD_ATTRIBUTE_NOT_OBSERVED: 'Attribut download non observé',
};

const evidenceLabels: Record<string, string> = {
  alt: 'attribut alt observé',
  'aria-label': 'nom aria observé',
  'aria-labelledby': 'nom aria référencé observé',
  figcaption: 'légende observée',
  'link-text': 'texte du lien observé',
  'surrounding-text': 'texte environnant observé',
  'fallback-text': 'texte de remplacement observé',
  title: 'attribut title observé',
  'label observed': 'libellé observé',
};

function readableSignal(value: string): string {
  return signalLabels[value] ?? value;
}

function readableEvidence(value: string): string {
  return evidenceLabels[value] ?? value;
}

export default function AnnexeContenusSpecialises({ items, initialPageUrl, initialPageId }: Props) {
  const pages = [...new Map(items
    .filter((item) => item.pageUrl)
    .map((item) => [item.pageId ?? item.pageUrl!, { id: item.pageId ?? item.pageUrl!, url: item.pageUrl! }]),
  ).values()];
  const [pageFilter, setPageFilter] = useState(initialPageId ?? initialPageUrl ?? '');

  useEffect(() => setPageFilter(initialPageId ?? initialPageUrl ?? ''), [initialPageId, initialPageUrl]);

  const visible = pageFilter ? items.filter((item) => (item.pageId ?? item.pageUrl) === pageFilter) : items;
  const grouped = visible.reduce<Record<string, number>>((counts, item) => {
    counts[item.status] = (counts[item.status] ?? 0) + 1;
    return counts;
  }, {});

  return (
    <div data-testid="annexe-specialized">
      <h2 className="mb-3 text-lg font-semibold text-gray-900">{t('annexes.specialized.title')}</h2>
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
            {pages.map((page) => <option key={page.id} value={page.id}>{page.url} {page.id.startsWith('page-') ? `(${page.id.slice(-8)})` : ''}</option>)}
          </select>
        </div>
      )}
      {visible.length === 0 ? (
        <p className="py-4 text-sm text-gray-600">{t('annexes.specialized.noResults')}</p>
      ) : (
        <div
          className="overflow-x-auto"
          role="region"
          tabIndex={0}
          aria-label={`${t('annexes.specialized.title')} — faites défiler horizontalement pour consulter toutes les colonnes`}
        >
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
                <tr key={`${item.pageId ?? item.pageUrl ?? ''}:${item.selector}`} className="align-top">
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
                    {item.evidence.length > 0 ? item.evidence.map(readableEvidence).join(', ') : t('annexes.specialized.noEvidence')}
                    {item.kind === 'document' && item.documentEvidence && (
                      <details className="mt-2">
                        <summary>Contrôles document (13.3–13.4)</summary>
                        <dl className="mt-1 space-y-1 text-gray-600">
                          <div><dt className="inline font-medium">État : </dt><dd className="inline">{item.documentEvidence.state === 'to_review' ? 'à vérifier' : item.documentEvidence.state}</dd></div>
                          <div><dt className="inline font-medium">MIME déclaré : </dt><dd className="inline">{item.documentEvidence.declaredMime ?? 'non observé'}</dd></div>
                          <div><dt className="inline font-medium">Taille déclarée : </dt><dd className="inline">{item.documentEvidence.declaredSizeBytes === null ? 'non observée' : `${item.documentEvidence.declaredSizeBytes} octets`}</dd></div>
                          <div><dt className="inline font-medium">Téléchargement : </dt><dd className="inline">{item.documentEvidence.downloadDeclared ? 'attribut observé' : 'non observé'}</dd></div>
                          <div><dt className="inline font-medium">Extension : </dt><dd className="inline">{item.documentEvidence.sourceExtension ? `.${item.documentEvidence.sourceExtension}` : 'non observée'}</dd></div>
                          <div><dt className="inline font-medium">Analyse locale : </dt><dd className="inline">non exécutée automatiquement</dd></div>
                        </dl>
                        <p className="mt-1 text-gray-600">Preuves : {item.documentEvidence.proof.join(' · ') || 'aucune'}</p>
                        <p className="mt-1 text-gray-600">Limites : {item.documentEvidence.limits.join(' · ') || 'aucune'}</p>
                        <p className="mt-1 text-gray-600">Contrôles humains : {item.documentEvidence.humanChecks.join(' · ') || 'aucun'}</p>
                        <p className="mt-1 text-amber-900">Revue humaine requise ; ces signaux ne constituent pas un verdict.</p>
                      </details>
                    )}
                    {item.flags.length > 0 && (
                      <details className="mt-2 text-amber-900">
                        <summary>Signaux techniques</summary>
                        <span className="break-words">{item.flags.map(readableSignal).join(', ')}</span>
                      </details>
                    )}
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
