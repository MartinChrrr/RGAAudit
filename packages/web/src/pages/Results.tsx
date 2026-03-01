import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { t } from '../locales';

interface ReportData {
  metadata: {
    url: string;
    date: string;
    pagesAudited: number;
    coveredThemes: string[];
    totalRgaaCriteria: number;
    coveredCriteria: number;
  };
  limitBanner: string;
  summary: {
    totalCriteria: number;
    violations: number;
    passes: number;
    manual: number;
    criteria: Array<{
      rgaaId: string;
      title: string;
      status: string;
      pagesViolating?: string[];
      pagesPass?: string[];
    }>;
    topIssues?: Array<{
      rgaaId: string;
      title: string;
      pagesViolating: string[];
    }>;
    overlaysDetected?: boolean;
  };
  uncoveredThemes: Array<{
    name: string;
    manualChecklist: string[];
  }>;
}

export default function Results() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'images' | 'links' | 'headings'>('images');
  const [uncoveredOpen, setUncoveredOpen] = useState(false);

  useEffect(() => {
    if (!sessionId) return;

    fetch(`/api/report/${sessionId}`)
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json();
      })
      .then((data) => setReport(data))
      .catch(() => setError(t('results.error')))
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">{t('results.loading')}</p>
      </main>
    );
  }

  if (error || !report) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || t('results.error')}</p>
          <Link to="/" className="text-primary-600 hover:underline">{t('results.backHome')}</Link>
        </div>
      </main>
    );
  }

  const statusColor: Record<string, string> = {
    violation: 'bg-red-100 text-red-800',
    pass: 'bg-green-100 text-green-800',
    manual: 'bg-amber-100 text-amber-800',
    incomplete: 'bg-gray-100 text-gray-800',
  };

  // Group criteria by theme (first digit of rgaaId)
  const byTheme = new Map<string, typeof report.summary.criteria>();
  for (const c of report.summary.criteria) {
    const themeId = c.rgaaId.split('.')[0];
    if (!byTheme.has(themeId)) byTheme.set(themeId, []);
    byTheme.get(themeId)!.push(c);
  }

  const topIssues = (report.summary.topIssues ?? []).slice(0, 5);

  return (
    <main className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Limit banner — always visible */}
        <div
          role="alert"
          className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"
          data-testid="limit-banner"
        >
          {report.limitBanner}
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-6">{t('results.heading')}</h1>

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-8">
          <SummaryCard label={t('report.criteriaTotal')} value={report.summary.totalCriteria} />
          <SummaryCard label={t('report.criteriaViolation')} value={report.summary.violations} className="text-red-700" />
          <SummaryCard label={t('report.criteriaPass')} value={report.summary.passes} className="text-green-700" />
          <SummaryCard label={t('report.criteriaManual')} value={report.summary.manual} className="text-amber-700" />
        </div>

        {/* Pages audited */}
        <p className="text-sm text-gray-600 mb-6">
          {t('results.pagesAudited', { count: report.metadata.pagesAudited })}
        </p>

        {/* Overlays */}
        {report.summary.overlaysDetected && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {t('results.overlaysDetected')}
          </div>
        )}

        {/* Top 5 issues */}
        {topIssues.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">{t('results.topIssues')}</h2>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 divide-y divide-gray-100">
              {topIssues.map((issue) => (
                <div key={issue.rgaaId} className="p-4 flex items-center justify-between">
                  <div>
                    <span className="font-mono text-sm text-gray-500 mr-2">{issue.rgaaId}</span>
                    <span className="text-sm text-gray-800">{issue.title}</span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {t('report.topIssuePages', { count: issue.pagesViolating.length })}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Criteria by theme */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">{t('results.criteriaSection')}</h2>
          <div className="space-y-4">
            {Array.from(byTheme.entries()).map(([themeId, criteria]) => (
              <div key={themeId} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-800">
                    {t(`themes.${themeId}`)}
                  </h3>
                </div>
                <ul className="divide-y divide-gray-100">
                  {criteria.map((c) => (
                    <li key={c.rgaaId} className="px-4 py-3 flex items-center gap-3">
                      <span className="font-mono text-xs text-gray-500 w-10">{c.rgaaId}</span>
                      <span className="text-sm text-gray-700 flex-1">{c.title}</span>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor[c.status] ?? 'bg-gray-100 text-gray-800'}`}>
                        {t(`status.${c.status}`)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Uncovered themes */}
        {report.uncoveredThemes.length > 0 && (
          <section className="mb-8">
            <button
              type="button"
              onClick={() => setUncoveredOpen(!uncoveredOpen)}
              className="flex items-center gap-2 text-lg font-semibold text-gray-900 mb-3 hover:text-primary-700 transition-colors"
              aria-expanded={uncoveredOpen}
            >
              <span className={`transition-transform ${uncoveredOpen ? 'rotate-90' : ''}`}>&#x25B6;</span>
              {t('results.uncoveredThemes')}
              <span className="text-sm font-normal text-gray-500">({report.uncoveredThemes.length})</span>
            </button>
            {uncoveredOpen && (
              <div className="space-y-3">
                {report.uncoveredThemes.map((theme) => (
                  <div key={theme.name} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                    <h3 className="text-sm font-semibold text-gray-800 mb-2">{theme.name}</h3>
                    <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                      {theme.manualChecklist.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Annexes tabs (placeholder for step 9) */}
        <section className="mb-8">
          <div className="flex border-b border-gray-200 mb-4">
            {(['images', 'links', 'headings'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-primary-600 text-primary-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
                aria-selected={activeTab === tab}
                role="tab"
              >
                {t(`results.tab${tab.charAt(0).toUpperCase() + tab.slice(1)}`)}
              </button>
            ))}
          </div>
          <div role="tabpanel" className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center text-sm text-gray-500">
            {t('results.comingSoon')}
          </div>
        </section>

        {/* Back home */}
        <div className="text-center">
          <Link
            to="/"
            className="inline-flex items-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors"
          >
            {t('results.backHome')}
          </Link>
        </div>
      </div>
    </main>
  );
}

function SummaryCard({ label, value, className = '' }: { label: string; value: number; className?: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${className || 'text-gray-900'}`}>{value}</p>
    </div>
  );
}
