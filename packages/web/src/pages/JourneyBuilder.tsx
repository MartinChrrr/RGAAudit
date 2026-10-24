import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { t } from '../locales';

type JourneyAction = 'navigate' | 'click' | 'fill' | 'press' | 'wait';
type JourneyStep = {
  id: string;
  action: JourneyAction;
  url?: string;
  selector?: string;
  value?: string;
  sensitive?: boolean;
  key?: string;
  waitMs?: number;
};

const ACTIONS: JourneyAction[] = ['navigate', 'click', 'fill', 'press', 'wait'];

function newStep(index: number): JourneyStep {
  return { id: `step-${index + 1}`, action: 'click', selector: '' };
}

export default function JourneyBuilder() {
  const { journeyId } = useParams<{ journeyId: string }>();
  const navigate = useNavigate();
  const editing = Boolean(journeyId);
  const [name, setName] = useState('');
  const [startUrl, setStartUrl] = useState('');
  const [steps, setSteps] = useState<JourneyStep[]>([newStep(0)]);
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!loading) headingRef.current?.focus();
  }, [editing, journeyId, loading]);

  useEffect(() => {
    if (!journeyId) return;
    let cancelled = false;
    void fetch(`/api/journeys/${encodeURIComponent(journeyId)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json() as Promise<{ journey: { name: string; startUrl: string; steps: JourneyStep[] } }>;
      })
      .then(({ journey }) => {
        if (cancelled) return;
        setName(journey.name);
        setStartUrl(journey.startUrl);
        setSteps(journey.steps.length > 0 ? journey.steps : [newStep(0)]);
      })
      .catch(() => { if (!cancelled) setError(t('journeyBuilder.loadError')); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [journeyId]);

  function updateStep(index: number, patch: Partial<JourneyStep>) {
    setSteps((current) => current.map((step, stepIndex) => stepIndex === index ? { ...step, ...patch } : step));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payloadSteps = steps.map((step) => (
        step.sensitive && !step.value
          ? { ...step, value: undefined }
          : step
      ));
      const response = await fetch(editing ? `/api/journeys/${encodeURIComponent(journeyId!)}` : '/api/journeys', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, startUrl, steps: payloadSteps }),
      });
      const payload = await response.json().catch(() => ({})) as { journey?: { id: string }; error?: string };
      if (!response.ok || !payload.journey) throw new Error(payload.error ?? String(response.status));
      navigate(`/journeys/${payload.journey.id}/edit`);
    } catch (cause) {
      setError(t('journeyBuilder.saveError', { error: cause instanceof Error ? cause.message : String(cause) }));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <main id="main-content" className="min-h-screen bg-gray-50 p-6"><p>{t('journeyBuilder.loading')}</p></main>;

  return (
    <main id="main-content" className="min-h-screen bg-gray-50 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <Link to="/" className="text-sm text-primary-700 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2">{t('journeyBuilder.backHome')}</Link>
        <header className="mt-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-bold text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2">{editing ? t('journeyBuilder.editTitle') : t('journeyBuilder.title')}</h1>
          <p className="mt-2 text-sm text-gray-600">{t('journeyBuilder.description')}</p>
        </header>

        <form onSubmit={submit} className="mt-6 space-y-6">
          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">{t('journeyBuilder.definition')}</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium text-gray-700">{t('journeyBuilder.name')}
                <input required value={name} onChange={(event) => setName(event.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2" />
              </label>
              <label className="text-sm font-medium text-gray-700">{t('journeyBuilder.startUrl')}
                <input required type="url" value={startUrl} onChange={(event) => setStartUrl(event.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2" />
              </label>
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm" aria-labelledby="journey-steps-title">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="journey-steps-title" className="text-lg font-semibold text-gray-900">{t('journeyBuilder.steps')}</h2>
              <button type="button" onClick={() => setSteps((current) => [...current, newStep(current.length)])} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2">{t('journeyBuilder.addStep')}</button>
            </div>
            <div className="mt-4 space-y-4">
              {steps.map((step, index) => (
                <fieldset key={`${step.id}-${index}`} className="rounded-lg border border-gray-200 p-4">
                  <legend className="px-1 font-medium text-gray-900">{t('journeyBuilder.step', { index: index + 1 })}</legend>
                  <div className="flex items-center justify-between gap-3">
                    <span aria-hidden="true" />
                    {steps.length > 1 && <button type="button" onClick={() => setSteps((current) => current.filter((_, stepIndex) => stepIndex !== index))} className="text-sm text-red-700 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2">{t('journeyBuilder.removeStep')}</button>}
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="text-sm font-medium text-gray-700">{t('journeyBuilder.action')}
                      <select value={step.action} onChange={(event) => updateStep(index, { action: event.target.value as JourneyAction })} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2">
                        {ACTIONS.map((action) => <option key={action} value={action}>{action}</option>)}
                      </select>
                    </label>
                    <label className="text-sm font-medium text-gray-700">{t('journeyBuilder.stepId')}
                      <input required value={step.id} onChange={(event) => updateStep(index, { id: event.target.value })} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2" />
                    </label>
                    {step.action === 'navigate' && <label className="text-sm font-medium text-gray-700 sm:col-span-2">{t('journeyBuilder.url')}
                      <input required type="url" value={step.url ?? ''} onChange={(event) => updateStep(index, { url: event.target.value })} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2" />
                    </label>}
                    {['click', 'fill', 'press'].includes(step.action) && <label className="text-sm font-medium text-gray-700">{t('journeyBuilder.selector')}
                      <input required value={step.selector ?? ''} onChange={(event) => updateStep(index, { selector: event.target.value })} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2" />
                    </label>}
                    {step.action === 'fill' && <label className="text-sm font-medium text-gray-700">{t('journeyBuilder.value')}
                      <input value={step.value ?? ''} onChange={(event) => updateStep(index, { value: event.target.value })} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2" />
                    </label>}
                    {step.action === 'press' && <label className="text-sm font-medium text-gray-700">{t('journeyBuilder.key')}
                      <input required value={step.key ?? ''} onChange={(event) => updateStep(index, { key: event.target.value })} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2" />
                    </label>}
                    {step.action === 'wait' && <label className="text-sm font-medium text-gray-700">{t('journeyBuilder.waitMs')}
                      <input required type="number" min="0" max="30000" value={step.waitMs ?? 500} onChange={(event) => updateStep(index, { waitMs: Number(event.target.value) })} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2" />
                    </label>}
                    {step.action === 'fill' && <label className="flex items-center gap-2 text-sm text-gray-700 sm:col-span-2">
                      <input type="checkbox" checked={step.sensitive ?? false} onChange={(event) => updateStep(index, { sensitive: event.target.checked })} className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2" />
                      {t('journeyBuilder.sensitive')}
                    </label>}
                  </div>
                </fieldset>
              ))}
            </div>
          </section>

          {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
          <div className="flex justify-end">
            <button type="submit" disabled={saving} className="rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:opacity-50">
              {saving ? t('journeyBuilder.saving') : t('journeyBuilder.save')}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
