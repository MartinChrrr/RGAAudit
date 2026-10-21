import { useEffect, useMemo, useState } from 'react';

export type MachineStatus = 'probable_issue' | 'needs_review' | 'no_issue_detected';
export type HumanStatus = 'not_tested' | 'compliant' | 'non_compliant' | 'not_applicable';
export type CriterionCoverage = 'full' | 'partial' | 'manual_shell';
export type HumanLevel = 'H0' | 'H1' | 'H2' | 'H3';

export interface CriterionCoverageSummary {
  total: number;
  integrated: number;
  machineSignal: number;
  humanReview: number;
  full: number;
  partial: number;
  manualShell: number;
}

export interface ReviewCriterion {
  rgaaId: string;
  title: string;
  theme: string;
  coverage: CriterionCoverage;
  humanLevel: HumanLevel;
  implementationLot: number;
  wcag: string[];
  machineStatus: MachineStatus;
  humanStatus: HumanStatus;
  comment: string;
  reviewedAt: string | null;
  violationsCount: number;
  incompletesCount: number;
  elements: Array<{ selector: string; flags: string[]; elementIndex?: number }>;
  evidence?: Array<{
    proofId?: string;
    resultId?: string;
    pageUrl?: string;
    criterionId?: string;
    kind: 'violation' | 'incomplete';
    rule: string;
    impact?: string;
    description: string;
    helpUrl?: string;
    selector: string;
    target: string[];
    html: string;
    context?: string;
    elementIndex?: number;
  }>;
  proofStatus?: 'linked' | 'missing' | 'not_required';
  missingProofs?: string[];
  manualChecks: string[];
}

export interface ReviewData {
  updatedAt: string;
  coverage?: CriterionCoverageSummary;
  summary: {
    total: number;
    reviewed: number;
    compliant: number;
    nonCompliant: number;
    notApplicable: number;
    notTested: number;
  };
  pages: Array<{ url: string; criteria: ReviewCriterion[] }>;
  imageDecisions?: Array<{
    pageUrl: string;
    selector: string;
    elementIndex?: number;
    decision: 'decorative' | 'informative' | 'violation' | null;
    status: HumanStatus;
    correctedAlt: string;
    notes: string;
    reviewedAt: string | null;
  }>;
}

export type AnnexTab = 'images' | 'media' | 'specialized' | 'frames' | 'links' | 'forms' | 'headings' | 'heuristics';

export interface AnnexTarget {
  tab: AnnexTab;
  pageUrl: string;
  criterionId: string;
  selectors: string[];
  elementIndexes: number[];
}

interface Props {
  sessionId: string;
  review: ReviewData;
  onOpenAnnex?: (target: AnnexTarget) => void;
}

const machineLabels: Record<MachineStatus, string> = {
  probable_issue: 'Anomalies détectées',
  needs_review: 'À vérifier',
  no_issue_detected: 'Aucune anomalie détectée',
};

const machineColors: Record<MachineStatus, string> = {
  probable_issue: 'border-red-300 bg-red-50 text-red-800',
  needs_review: 'border-amber-300 bg-amber-50 text-amber-900',
  no_issue_detected: 'border-green-300 bg-green-50 text-green-800',
};

const humanColors: Record<Exclude<HumanStatus, 'not_tested'>, string> = {
  compliant: 'border-green-300 bg-green-50 text-green-800',
  non_compliant: 'border-red-300 bg-red-50 text-red-800',
  not_applicable: 'border-gray-300 bg-gray-50 text-gray-700',
};

const humanLabels: Record<HumanStatus, string> = {
  not_tested: 'Non vérifié',
  compliant: 'Conforme',
  non_compliant: 'Non conforme',
  not_applicable: 'Non applicable',
};

const coverageLabels: Record<CriterionCoverage, string> = {
  full: 'Couverture complète',
  partial: 'Couverture partielle',
  manual_shell: 'Revue manuelle',
};

const coverageColors: Record<CriterionCoverage, string> = {
  full: 'bg-blue-50 text-blue-800',
  partial: 'bg-amber-50 text-amber-900',
  manual_shell: 'bg-gray-100 text-gray-700',
};

function decisionKey(pageUrl: string, criterionId: string): string {
  return `${pageUrl}\u001f${criterionId}`;
}

function annexForCriterion(criterionId: string): AnnexTab | null {
  const theme = criterionId.split('.')[0];
  if (theme === '1') return 'images';
  if (theme === '4') return 'media';
  if (theme === '13') return 'specialized';
  if (theme === '2') return 'frames';
  if (theme === '6') return 'links';
  if (theme === '11') return 'forms';
  if (theme === '8' || theme === '9') return 'headings';
  if (theme === '7') return 'heuristics';
  return null;
}

const annexLabels: Record<AnnexTab, string> = {
  images: 'Images',
  media: 'Médias',
  specialized: 'Contenus spécialisés',
  frames: 'Cadres',
  links: 'Liens',
  forms: 'Formulaires',
  headings: 'Titres',
  heuristics: 'Sémantique HTML',
};

export default function ReviewWorkspace({ sessionId, review, onOpenAnnex }: Props) {
  const [activePage, setActivePage] = useState(review.pages[0]?.url ?? '');
  const [criteria, setCriteria] = useState(review.pages);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setCriteria(review.pages), [review.pages]);

  const page = criteria.find((item) => item.url === activePage) ?? criteria[0];
  const localSummary = useMemo(() => {
    const all = criteria.flatMap((item) => item.criteria);
    const reviewed = all.filter((criterion) => criterion.humanStatus !== 'not_tested');
    return { total: all.length, reviewed: reviewed.length };
  }, [criteria]);

  const updateCriterion = (
    pageUrl: string,
    criterionId: string,
    update: Partial<Pick<ReviewCriterion, 'humanStatus' | 'comment'>>,
  ) => {
    setCriteria((current) => current.map((item) => item.url !== pageUrl ? item : ({
      ...item,
      criteria: item.criteria.map((criterion) => criterion.rgaaId === criterionId
        ? { ...criterion, ...update }
        : criterion),
    })));
  };

  const persist = async (pageUrl: string, criterion: ReviewCriterion) => {
    const key = decisionKey(pageUrl, criterion.rgaaId);
    setSaving(key);
    setSaved(null);
    setError(null);
    try {
      const response = await fetch(`/api/audit/${sessionId}/decision`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageUrl,
          criterionId: criterion.rgaaId,
          status: criterion.humanStatus,
          comment: criterion.comment,
        }),
      });
      if (!response.ok) throw new Error(String(response.status));
      setSaved(key);
    } catch {
      setError('La décision n’a pas pu être enregistrée.');
    } finally {
      setSaving(null);
    }
  };

  if (!page) return null;

  return (
    <section className="mb-8" aria-labelledby="review-heading" data-testid="review-workspace">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="review-heading" className="text-lg font-semibold text-gray-900">
            Validation humaine
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            {localSummary.reviewed} décision(s) enregistrée(s) sur {localSummary.total}. Les couleurs sont des suggestions, jamais un verdict automatique.
          </p>
        </div>
        {criteria.length > 1 && (
          <label className="text-sm text-gray-700">
            Page à vérifier
            <select
              value={page.url}
              onChange={(event) => setActivePage(event.target.value)}
              className="mt-1 block max-w-sm rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              {criteria.map((item) => <option key={item.url} value={item.url}>{item.url}</option>)}
            </select>
          </label>
        )}
      </div>

      {review.coverage && (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4" data-testid="review-coverage-summary">
          <h3 className="text-sm font-semibold text-blue-950">Périmètre du registre RGAA</h3>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-white p-3 shadow-sm">
              <p className="text-xs text-gray-600">Critères intégrés</p>
              <p className="text-xl font-bold text-gray-900">{review.coverage.integrated}</p>
              <p className="text-xs text-gray-500">sur {review.coverage.total}</p>
            </div>
            <div className="rounded-lg bg-white p-3 shadow-sm">
              <p className="text-xs text-gray-600">Signal automatique</p>
              <p className="text-xl font-bold text-blue-800">{review.coverage.machineSignal}</p>
              <p className="text-xs text-gray-500">sans verdict de conformité</p>
            </div>
            <div className="rounded-lg bg-white p-3 shadow-sm">
              <p className="text-xs text-gray-600">Revue humaine requise</p>
              <p className="text-xl font-bold text-amber-800">{review.coverage.humanReview}</p>
              <p className="text-xs text-gray-500">couverture partielle ou manuelle</p>
            </div>
          </div>
        </div>
      )}

      {error && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}

      <div className="space-y-3">
        {page.criteria.map((criterion) => {
          const key = decisionKey(page.url, criterion.rgaaId);
          const annex = annexForCriterion(criterion.rgaaId);
          return (
            <article key={criterion.rgaaId} id={`criterion-${criterion.rgaaId}`} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-gray-800">{criterion.rgaaId}</span>
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${coverageColors[criterion.coverage]}`}>
                      {coverageLabels[criterion.coverage]}
                    </span>
                    {criterion.humanStatus === 'not_tested' ? (
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${machineColors[criterion.machineStatus]}`}>
                        {machineLabels[criterion.machineStatus]}
                      </span>
                    ) : (
                      <>
                        <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${humanColors[criterion.humanStatus]}`}>
                          Auditeur : {humanLabels[criterion.humanStatus]}
                        </span>
                        <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">
                          Signal automatique : {machineLabels[criterion.machineStatus]}
                        </span>
                      </>
                    )}
                    {criterion.wcag.map((wcag) => (
                      <span key={wcag} className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">WCAG {wcag}</span>
                    ))}
                  </div>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">{criterion.title}</h3>
                  {criterion.manualChecks.length > 0 && (
                    <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                      <p className="font-semibold">Action de vérification humaine</p>
                      <ul className="mt-1 list-disc space-y-1 pl-4">
                        {criterion.manualChecks.map((check) => <li key={check}>{check}</li>)}
                      </ul>
                    </div>
                  )}
                  {criterion.proofStatus === 'missing' && (
                    <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                      Preuve manquante — revue manuelle requise{criterion.missingProofs?.[0] ? ` : ${criterion.missingProofs[0]}` : '.'}
                    </p>
                  )}
                  {(criterion.violationsCount > 0 || criterion.elements.length > 0) && (
                    <p className="mt-1 text-xs text-gray-600">
                      {criterion.violationsCount} anomalie(s) automatisée(s), {criterion.elements.length} élément(s) à examiner.
                    </p>
                  )}
                  {(criterion.evidence?.length ?? 0) > 0 && (
                    <div className="mt-3 space-y-2" data-testid={`criterion-evidence-${criterion.rgaaId}`}>
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-700">Preuves automatisées</h4>
                      {(criterion.evidence ?? []).map((evidence, index) => (
                        <details key={`${evidence.rule}-${evidence.selector}-${index}`} className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs">
                          <summary className="cursor-pointer font-medium text-gray-800">
                            {evidence.rule} · {evidence.kind === 'violation' ? 'anomalie' : 'à vérifier'} · {evidence.selector || evidence.target.join(' > ')}
                          </summary>
                          <dl className="mt-2 space-y-2 text-gray-700">
                            <div><dt className="font-semibold">Description</dt><dd>{evidence.description}</dd></div>
                            <div><dt className="font-semibold">Cible</dt><dd><code>{evidence.target.join(' > ')}</code></dd></div>
                            <div><dt className="font-semibold">HTML</dt><dd><code className="block max-h-24 overflow-auto whitespace-pre-wrap">{evidence.html}</code></dd></div>
                            {evidence.context && <div><dt className="font-semibold">Contexte</dt><dd><code className="block max-h-32 overflow-auto whitespace-pre-wrap">{evidence.context}</code></dd></div>}
                            {(evidence.proofId || evidence.resultId || evidence.pageUrl) && <div><dt className="font-semibold">Traçabilité</dt><dd>{evidence.proofId && <><code>{evidence.proofId}</code> · </>}{evidence.resultId && <>résultat <code>{evidence.resultId}</code>{evidence.pageUrl ? ' · ' : ''}</>}{evidence.pageUrl && <a className="text-primary-700 underline" href={evidence.pageUrl} target="_blank" rel="noreferrer">ouvrir la page auditée</a>}</dd></div>}
                          </dl>
                        </details>
                      ))}
                    </div>
                  )}
                  {annex && onOpenAnnex && (
                    <button
                      type="button"
                      onClick={() => onOpenAnnex({
                        tab: annex,
                        pageUrl: page.url,
                        criterionId: criterion.rgaaId,
                        selectors: criterion.elements.map((element) => element.selector),
                        elementIndexes: criterion.elements.flatMap((element) => (
                          element.elementIndex === undefined ? [] : [element.elementIndex]
                        )),
                      })}
                      className="mt-2 inline-flex items-center rounded-md text-xs font-medium text-primary-700 underline decoration-primary-300 underline-offset-2 hover:text-primary-900"
                    >
                      Examiner dans l’annexe {annexLabels[annex]}
                      {criterion.elements.length > 0 ? ` (${criterion.elements.length})` : ''}
                    </button>
                  )}
                </div>

                <label className="text-xs font-medium text-gray-700">
                  Décision de l’auditeur
                  <select
                    aria-label={`Décision humaine pour le critère ${criterion.rgaaId}`}
                    value={criterion.humanStatus}
                    onChange={(event) => updateCriterion(page.url, criterion.rgaaId, {
                      humanStatus: event.target.value as HumanStatus,
                    })}
                    className="mt-1 block rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  >
                    {(Object.keys(humanLabels) as HumanStatus[]).map((status) => (
                      <option key={status} value={status}>{humanLabels[status]}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="mt-3 flex flex-wrap items-end gap-3">
                <label className="min-w-64 flex-1 text-xs font-medium text-gray-700">
                  Commentaire ou preuve
                  <textarea
                    value={criterion.comment}
                    onChange={(event) => updateCriterion(page.url, criterion.rgaaId, { comment: event.target.value })}
                    rows={2}
                    maxLength={5_000}
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    placeholder="Contexte, sélecteur, justification…"
                  />
                </label>
                <button
                  type="button"
                  disabled={saving === key}
                  onClick={() => persist(page.url, criterion)}
                  className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  {saving === key ? 'Enregistrement…' : saved === key ? 'Enregistré' : 'Enregistrer'}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
