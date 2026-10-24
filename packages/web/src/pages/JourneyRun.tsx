import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { t } from '../locales';

type JourneyStatus = 'running' | 'completed' | 'completed_with_errors' | 'failed';
type HumanStatus = 'not_tested' | 'compliant' | 'non_compliant' | 'not_applicable';
type ScreenshotSkippedReason = 'sensitive_step' | 'quota' | 'too_large' | 'capture_error';

interface JourneyContext {
  trigger: {
    stepId: string;
    action: string;
    selector?: string;
    key?: string;
  };
  urlBefore: string;
  urlAfter: string;
  titleBefore: string;
  titleAfter: string;
  changed: boolean;
  changeTypes: string[];
  disruptions: Array<{ kind: 'motion' | 'sound'; selector: string; detail: string }>;
  criterionIds: string[];
  requiresHumanReview: true;
}

interface JourneyStep {
  stepId: string;
  action: string;
  url: string;
  observedAt: string;
  title: string;
  evidence: Array<{ selector: string; context?: string; criterionIds: string[] }>;
  context?: JourneyContext;
  screenshotUrl?: string;
  screenshotSkippedReason?: ScreenshotSkippedReason;
  error?: string;
}

interface JourneyEvidenceDecision {
  stepId: string;
  evidenceIndex: number;
  criterionId: string;
  status: HumanStatus;
  comment: string;
  reviewedAt: string | null;
}

interface JourneyComparison {
  before: { url: string; pageId?: string; observedAt: string | null; stepId?: string; available: boolean; selectors: string[] };
  after: { url: string; pageId?: string; observedAt: string | null; stepId?: string; available: boolean; selectors: string[] };
  changed: boolean;
  added: string[];
  removed: string[];
  updated?: Array<{ key: string; fields: string[] }>;
}

interface JourneyRunResponse {
  run: {
    runId: string;
    journeyId: string;
    status: JourneyStatus;
    startedAt: string;
    finishedAt?: string;
    error?: string;
    run?: {
      steps: JourneyStep[];
      comparisons?: JourneyComparison[];
      decisions?: JourneyEvidenceDecision[];
    };
  };
}

const changeTypeKeys: Record<string, string> = {
  navigation: 'journey.changeTypes.navigation',
  title: 'journey.changeTypes.title',
  dialog: 'journey.changeTypes.dialog',
  'live-region': 'journey.changeTypes.liveRegion',
  disruption: 'journey.changeTypes.disruption',
};

function formatDate(value?: string): string {
  if (!value) return t('journey.unknownDate');
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function statusLabel(status: JourneyStatus): string {
  return t(`journey.status.${status}`);
}

function skippedReasonLabel(reason: ScreenshotSkippedReason): string {
  return t(`journey.screenshotSkipped.${reason}`);
}

const humanStatusKeys: Record<HumanStatus, string> = {
  not_tested: 'journey.humanStatuses.notTested',
  compliant: 'journey.humanStatuses.compliant',
  non_compliant: 'journey.humanStatuses.nonCompliant',
  not_applicable: 'journey.humanStatuses.notApplicable',
};

function decisionKey(decision: Pick<JourneyEvidenceDecision, 'stepId' | 'evidenceIndex' | 'criterionId'>): string {
  return `${decision.stepId}:${decision.evidenceIndex}:${decision.criterionId}`;
}

function JourneyEvidenceReview({
  runId,
  stepId,
  evidenceIndex,
  criterionId,
  decision,
  onSaved,
}: {
  runId: string;
  stepId: string;
  evidenceIndex: number;
  criterionId: string;
  decision?: JourneyEvidenceDecision;
  onSaved: (decisions: JourneyEvidenceDecision[]) => void;
}) {
  const [status, setStatus] = useState<HumanStatus>(decision?.status ?? 'not_tested');
  const [comment, setComment] = useState(decision?.comment ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const groupRef = useRef<HTMLFieldSetElement>(null);

  async function save() {
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      const response = await fetch(`/api/journey-runs/${encodeURIComponent(runId)}/decision`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stepId, evidenceIndex, criterionId, status, comment }),
      });
      const payload = await response.json().catch(() => ({})) as JourneyRunResponse;
      if (!response.ok) throw new Error(String(response.status));
      onSaved(payload.run.run?.decisions ?? []);
      setSaved(true);
      requestAnimationFrame(() => groupRef.current?.focus());
    } catch {
      setError(t('journey.decisionSaveError'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <fieldset ref={groupRef} tabIndex={-1} className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2">
      <legend className="px-1 text-xs font-semibold text-gray-700">{t('journey.humanDecision', { criterion: criterionId })}</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-medium text-gray-700">
          {t('journey.decisionStatus')}
          <select
            aria-label={t('journey.decisionStatusLabel', { stepId, evidence: evidenceIndex + 1, criterion: criterionId })}
            value={status}
            onChange={(event) => { setStatus(event.target.value as HumanStatus); setSaved(false); }}
            className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
          >
            {(Object.keys(humanStatusKeys) as HumanStatus[]).map((option) => (
              <option key={option} value={option}>{t(humanStatusKeys[option])}</option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-gray-700">
          {t('journey.decisionComment')}
          <textarea
            aria-label={t('journey.decisionCommentLabel', { stepId, evidence: evidenceIndex + 1, criterion: criterionId })}
            value={comment}
            onChange={(event) => { setComment(event.target.value); setSaved(false); }}
            rows={2}
            maxLength={5000}
            className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
          />
        </label>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button type="button" onClick={save} disabled={saving} className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:opacity-50">
          {saving ? t('journey.savingDecision') : t('journey.saveDecision')}
        </button>
        {saved && <span role="status" className="text-xs text-green-800">{t('journey.decisionSaved')}</span>}
        {error && <span role="alert" className="text-xs text-red-800">{error}</span>}
      </div>
    </fieldset>
  );
}

function JourneyStepCard({
  runId,
  step,
  index,
  decisions,
  onDecisionsSaved,
}: {
  runId: string;
  step: JourneyStep;
  index: number;
  decisions: JourneyEvidenceDecision[];
  onDecisionsSaved: (next: JourneyEvidenceDecision[]) => void;
}) {
  const [screenshotUnavailable, setScreenshotUnavailable] = useState(false);
  const contextId = `journey-context-${step.stepId}`;
  const screenshotId = `journey-screenshot-${step.stepId}`;

  return (
    <article className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">
        {t('journey.stepTitle', { index: index + 1, id: step.stepId })}
      </h2>
      <dl className="mt-3 grid gap-2 text-sm text-gray-700 sm:grid-cols-2">
        <div>
          <dt className="font-medium text-gray-900">{t('journey.action')}</dt>
          <dd>{step.action}</dd>
        </div>
        <div>
          <dt className="font-medium text-gray-900">{t('journey.observedAt')}</dt>
          <dd>{formatDate(step.observedAt)}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="font-medium text-gray-900">{t('journey.url')}</dt>
          <dd className="break-all">{step.url}</dd>
        </div>
      </dl>

      {step.error && (
        <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {t('journey.stepError', { error: step.error })}
        </p>
      )}

      <section aria-labelledby={contextId} className="mt-5 border-t border-gray-100 pt-4">
        <h3 id={contextId} className="text-base font-semibold text-gray-900">
          {t('journey.contextTitle')}
        </h3>
        <p className="mt-2 text-sm text-amber-900">
          {step.context?.changed ? t('journey.contextChanged') : t('journey.contextUnchanged')}
        </p>
        {step.context && (
          <div className="mt-3 space-y-3 text-sm text-gray-700">
            <dl className="grid gap-2 sm:grid-cols-2">
              <div>
                <dt className="font-medium text-gray-900">{t('journey.before')}</dt>
                <dd className="break-all">{step.context.urlBefore}</dd>
                <dd>{step.context.titleBefore || t('journey.emptyTitle')}</dd>
              </div>
              <div>
                <dt className="font-medium text-gray-900">{t('journey.after')}</dt>
                <dd className="break-all">{step.context.urlAfter}</dd>
                <dd>{step.context.titleAfter || t('journey.emptyTitle')}</dd>
              </div>
            </dl>
            {step.context.changeTypes.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900">{t('journey.changeTypesTitle')}</h4>
                <ul className="mt-1 list-disc pl-5">
                  {step.context.changeTypes.map((type) => (
                    <li key={type}>{changeTypeKeys[type] ? t(changeTypeKeys[type]) : type}</li>
                  ))}
                </ul>
              </div>
            )}
            <div>
              <h4 className="font-medium text-gray-900">{t('journey.disruptionsTitle')}</h4>
              {step.context.disruptions.length === 0 ? (
                <p>{t('journey.noDisruptions')}</p>
              ) : (
                <ul className="mt-1 space-y-1">
                  {step.context.disruptions.map((disruption, disruptionIndex) => (
                    <li key={`${disruption.kind}-${disruption.selector}-${disruptionIndex}`}>
                      <span className="font-medium">{disruption.kind === 'motion' ? t('journey.motion') : t('journey.sound')}</span>
                      {' — '}{disruption.selector}: {disruption.detail}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {step.context.criterionIds.length > 0 && (
              <p><span className="font-medium">{t('journey.criteria')}:</span> {step.context.criterionIds.join(', ')}</p>
            )}
          </div>
        )}
      </section>

      <section className="mt-5 border-t border-gray-100 pt-4" aria-labelledby={screenshotId}>
        <h3 id={screenshotId} className="text-base font-semibold text-gray-900">
          {t('journey.screenshotTitle')}
        </h3>
        <p className="mt-2 text-sm text-gray-700">{t('journey.humanReview')}</p>
        {step.screenshotUrl && !screenshotUnavailable ? (
          <figure className="mt-3">
            <img
              src={step.screenshotUrl}
              alt={t('journey.screenshotAlt', { id: step.stepId })}
              className="max-h-96 max-w-full rounded-lg border border-gray-200"
              onError={() => setScreenshotUnavailable(true)}
            />
            <figcaption className="mt-2 text-sm text-gray-600">
              {t('journey.screenshotAvailable')}
            </figcaption>
          </figure>
        ) : step.screenshotSkippedReason ? (
          <p role="status" className="mt-3 text-sm text-gray-700">{skippedReasonLabel(step.screenshotSkippedReason)}</p>
        ) : screenshotUnavailable ? (
          <p role="status" className="mt-3 text-sm text-gray-700">{t('journey.screenshotMissing')}</p>
        ) : (
          <p role="status" className="mt-3 text-sm text-gray-700">{t('journey.noScreenshot')}</p>
        )}
      </section>

      {step.evidence.length > 0 && (
        <section className="mt-5 border-t border-gray-100 pt-4" aria-labelledby={`journey-evidence-${step.stepId}`}>
            <h3 id={`journey-evidence-${step.stepId}`} className="text-base font-semibold text-gray-900">
              {t('journey.evidenceTitle')}
            </h3>
            <ul className="mt-2 space-y-2 text-sm text-gray-700">
              {step.evidence.map((evidence, evidenceIndex) => (
                <li key={`${evidence.selector}-${evidenceIndex}`}>
                  <span className="font-medium">{evidence.selector}</span>
                  {evidence.context ? ` — ${evidence.context}` : ''}
                  {evidence.criterionIds.length > 0 ? ` (${evidence.criterionIds.join(', ')})` : ''}
                  {evidence.criterionIds.map((criterionId) => {
                    const currentDecision = decisions.find((decision) => decisionKey(decision) === decisionKey({
                      stepId: step.stepId,
                      evidenceIndex,
                      criterionId,
                    }));
                    return (
                      <JourneyEvidenceReview
                        key={`${evidenceIndex}-${criterionId}`}
                        runId={runId}
                        stepId={step.stepId}
                        evidenceIndex={evidenceIndex}
                        criterionId={criterionId}
                        decision={currentDecision}
                        onSaved={onDecisionsSaved}
                      />
                    );
                  })}
                </li>
              ))}
            </ul>
        </section>
      )}
    </article>
  );
}

export default function JourneyRun() {
  const { runId } = useParams<{ runId: string }>();
  const [data, setData] = useState<JourneyRunResponse | null>(null);
  const [decisions, setDecisions] = useState<JourneyEvidenceDecision[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!runId) return;
    let cancelled = false;
    void fetch(`/api/journey-runs/${encodeURIComponent(runId)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json() as Promise<JourneyRunResponse>;
      })
      .then((response) => {
        if (!cancelled) {
          setData(response);
          setDecisions(response.run.run?.decisions ?? []);
        }
      })
      .catch(() => {
        if (!cancelled) setError(t('journey.error'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [runId]);

  if (loading) {
    return <main id="main-content" className="min-h-screen bg-gray-50 p-6"><p>{t('journey.loading')}</p></main>;
  }

  if (error || !data) {
    return (
      <main id="main-content" className="min-h-screen bg-gray-50 p-6">
        <p role="alert" className="text-red-700">{error || t('journey.error')}</p>
        <Link to="/" className="mt-4 inline-block text-primary-700 underline">{t('journey.backHome')}</Link>
      </main>
    );
  }

  const run = data.run;
  const steps = run.run?.steps ?? [];
  const comparisons = run.run?.comparisons ?? [];
  const comparisonPageLabel = (snapshot: JourneyComparison['before']): string => (
    `${snapshot.url}${snapshot.pageId ? ` — identifiant de page ${snapshot.pageId.slice(-8)}` : ''}`
  );

  return (
    <main id="main-content" className="min-h-screen bg-gray-50 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <Link to="/" className="text-sm text-primary-700 underline">{t('journey.backHome')}</Link>
        <header className="mt-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">{t('journey.title')}</h1>
          <dl className="mt-4 grid gap-2 text-sm text-gray-700 sm:grid-cols-2">
            <div>
              <dt className="font-medium text-gray-900">{t('journey.statusLabel')}</dt>
              <dd role="status" aria-live="polite">{statusLabel(run.status)}</dd>
            </div>
            <div><dt className="font-medium text-gray-900">{t('journey.runId')}</dt><dd className="break-all">{run.runId}</dd></div>
            <div><dt className="font-medium text-gray-900">{t('journey.startedAt')}</dt><dd>{formatDate(run.startedAt)}</dd></div>
            <div><dt className="font-medium text-gray-900">{t('journey.finishedAt')}</dt><dd>{formatDate(run.finishedAt)}</dd></div>
          </dl>
          {run.error && <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{run.error}</p>}
          <Link to={`/journeys/${encodeURIComponent(run.journeyId)}/edit`} className="mt-4 inline-block text-sm font-medium text-primary-700 underline">
            {t('journey.editJourney')}
          </Link>
        </header>

        <section className="mt-6" aria-labelledby="journey-observations-title">
          <h2 id="journey-observations-title" className="text-xl font-semibold text-gray-900">{t('journey.observationsTitle')}</h2>
          <p className="mt-2 text-sm text-gray-700">{t('journey.observationsDescription')}</p>
          <div className="mt-4 space-y-4">
            {steps.length === 0 ? <p className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-700">{t('journey.noSteps')}</p> : steps.map((step, index) => (
              <JourneyStepCard
                key={step.stepId}
                runId={run.runId}
                step={step}
                index={index}
                decisions={decisions}
                onDecisionsSaved={setDecisions}
              />
            ))}
          </div>
        </section>

        {comparisons.length > 0 && (
          <section className="mt-8" aria-labelledby="journey-comparisons-title" data-testid="journey-comparison-summary">
            <h2 id="journey-comparisons-title" className="text-xl font-semibold text-gray-900">{t('results.comparisonTitle')}</h2>
            <div className="mt-4 space-y-3">
              {comparisons.map((comparison) => (
                <article key={`${comparison.before.pageId ?? comparison.before.url}:${comparison.after.pageId ?? comparison.after.url}`} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <h3 className="text-sm font-semibold text-gray-800">
                    {t('results.comparisonBefore')} : {comparisonPageLabel(comparison.before)} <span aria-hidden="true">→</span> {t('results.comparisonAfter')} : {comparisonPageLabel(comparison.after)}
                  </h3>
                  <p className="mt-1 text-xs text-gray-500">
                    {t('results.comparisonBefore')} : {comparison.before.observedAt ?? t('journey.unknownDate')} · {t('results.comparisonAfter')} : {comparison.after.observedAt ?? t('journey.unknownDate')}
                  </p>
                  {(comparison.before.stepId || comparison.after.stepId) && (
                    <p className="mt-1 text-xs text-gray-600">
                      {comparison.before.stepId && `${t('results.comparisonBefore')} : ${t('results.comparisonStep')} ${comparison.before.stepId}`}
                      {comparison.before.stepId && comparison.after.stepId ? ' · ' : ''}
                      {comparison.after.stepId && `${t('results.comparisonAfter')} : ${t('results.comparisonStep')} ${comparison.after.stepId}`}
                    </p>
                  )}
                  <p className={`mt-2 text-sm ${comparison.changed ? 'text-amber-900' : 'text-green-800'}`}>
                    {!comparison.before.available || !comparison.after.available
                      ? t('results.comparisonUnavailable')
                      : comparison.changed
                        ? t('results.comparisonChanged')
                        : t('results.comparisonNoSelectorChange')}
                  </p>
                  {comparison.changed && (
                    <div className="mt-2 grid gap-2 text-xs text-gray-700 sm:grid-cols-2">
                      <p>{t('results.comparisonAdded')} : {comparison.added.length > 0 ? comparison.added.join(', ') : 'aucun'}</p>
                      <p>{t('results.comparisonRemoved')} : {comparison.removed.length > 0 ? comparison.removed.join(', ') : 'aucune'}</p>
                      {(comparison.updated ?? []).length > 0 && (
                        <p className="sm:col-span-2">
                          {t('results.comparisonUpdated')} : {comparison.updated!.map((change) => `${change.key} (${change.fields.join(', ')})`).join(' · ')}
                        </p>
                      )}
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
