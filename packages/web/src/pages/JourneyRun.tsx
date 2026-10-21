import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { t } from '../locales';

type JourneyStatus = 'running' | 'completed' | 'completed_with_errors' | 'failed';
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

function JourneyStepCard({ step, index }: { step: JourneyStep; index: number }) {
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
          <p className="mt-3 text-sm text-gray-700">{skippedReasonLabel(step.screenshotSkippedReason)}</p>
        ) : screenshotUnavailable ? (
          <p className="mt-3 text-sm text-gray-700">{t('journey.screenshotMissing')}</p>
        ) : (
          <p className="mt-3 text-sm text-gray-700">{t('journey.noScreenshot')}</p>
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
        if (!cancelled) setData(response);
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

  return (
    <main id="main-content" className="min-h-screen bg-gray-50 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <Link to="/" className="text-sm text-primary-700 underline">{t('journey.backHome')}</Link>
        <header className="mt-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">{t('journey.title')}</h1>
          <dl className="mt-4 grid gap-2 text-sm text-gray-700 sm:grid-cols-2">
            <div><dt className="font-medium text-gray-900">{t('journey.statusLabel')}</dt><dd>{statusLabel(run.status)}</dd></div>
            <div><dt className="font-medium text-gray-900">{t('journey.runId')}</dt><dd className="break-all">{run.runId}</dd></div>
            <div><dt className="font-medium text-gray-900">{t('journey.startedAt')}</dt><dd>{formatDate(run.startedAt)}</dd></div>
            <div><dt className="font-medium text-gray-900">{t('journey.finishedAt')}</dt><dd>{formatDate(run.finishedAt)}</dd></div>
          </dl>
          {run.error && <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{run.error}</p>}
        </header>

        <section className="mt-6" aria-labelledby="journey-observations-title">
          <h2 id="journey-observations-title" className="text-xl font-semibold text-gray-900">{t('journey.observationsTitle')}</h2>
          <p className="mt-2 text-sm text-gray-700">{t('journey.observationsDescription')}</p>
          <div className="mt-4 space-y-4">
            {steps.length === 0 ? <p className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-700">{t('journey.noSteps')}</p> : steps.map((step, index) => <JourneyStepCard key={step.stepId} step={step} index={index} />)}
          </div>
        </section>
      </div>
    </main>
  );
}
