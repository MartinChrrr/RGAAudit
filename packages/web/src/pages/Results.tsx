import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import { t } from '../locales';
import AnnexeImages, { type ImageItem } from '../components/annexes/AnnexeImages';
import AnnexeMedias, { type MediaItem } from '../components/annexes/AnnexeMedias';
import AnnexeTableaux, { type TableItem } from '../components/annexes/AnnexeTableaux';
import AnnexeStructure, { type StructurePageItem } from '../components/annexes/AnnexeStructure';
import AnnexePresentation, { type PresentationSnapshotItem } from '../components/annexes/AnnexePresentation';
import AnnexeContenusSpecialises, { type SpecializedContentItem } from '../components/annexes/AnnexeContenusSpecialises';
import AnnexeCadres, { type FrameItem } from '../components/annexes/AnnexeCadres';
import AnnexeLiens, { type LinkItem } from '../components/annexes/AnnexeLiens';
import AnnexeTitres, { type HeadingTreeData } from '../components/annexes/AnnexeTitres';
import AnnexeHeuristiques, { type HeuristicFindingItem } from '../components/annexes/AnnexeHeuristiques';
import AnnexeFormulaires, { type FormItem } from '../components/annexes/AnnexeFormulaires';
import ReviewWorkspace, {
  type AnnexTab,
  type AnnexTarget,
  type ReviewData,
} from '../components/ReviewWorkspace';

interface ContrastViolationItem {
  pageUrl: string;
  rgaaId: string;
  selector: string;
  contrastRatio: string;
  expectedContrastRatio: string;
  fgColor: string;
  bgColor: string;
}

interface CriterionCoverageSummary {
  total: number;
  integrated: number;
  machineSignal: number;
  humanReview: number;
  full: number;
  partial: number;
  manualShell: number;
}

type StructureDataItem = StructurePageItem & { tables: TableItem[] };

interface PageComparison {
  before: { url: string; pageId?: string; observedAt: string | null; stepId?: string; comparisonKey?: string; available: boolean; selectors: string[] };
  after: { url: string; pageId?: string; observedAt: string | null; stepId?: string; comparisonKey?: string; available: boolean; selectors: string[] };
  changed: boolean;
  added: string[];
  removed: string[];
  updated?: Array<{ key: string; fields: string[] }>;
}

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
  coverage?: CriterionCoverageSummary;
  summary: {
    totalCriteria: number;
    violations: number;
    passes: number;
    manual: number;
    criteria: Array<{
      rgaaId: string;
      title: string;
      coverage?: 'full' | 'partial' | 'manual_shell';
      status: string;
      pagesViolating?: string[];
      pagesPass?: string[];
    }>;
    topIssues?: Array<{
      rgaaId: string;
      title: string;
      pagesAffected: number;
    }>;
    overlaysDetected?: boolean;
  };
  uncoveredThemes: Array<{
    name: string;
    manualChecklist: string[];
  }>;
  comparisons?: PageComparison[];
  contrastViolations?: ContrastViolationItem[];
  heuristicFindings?: HeuristicFindingItem[];
  review?: ReviewData;
  journeyAnnex?: {
    schemaVersion: number;
    generatedAt: string;
    sessionId: string;
    runs: Array<{
      runId: string;
      journeyId: string;
      status: 'running' | 'completed' | 'completed_with_errors' | 'failed';
      startedAt: string;
      finishedAt?: string;
      run?: {
        steps: Array<{ evidence: unknown[] }>;
        decisions?: unknown[];
      };
    }>;
  };
  allCollected?: Array<{
    url: string;
    pageId?: string;
    observedAt?: string;
    collectedData: {
      images: ImageItem[];
      media?: MediaItem[];
      specializedContent?: SpecializedContentItem[];
      frames: FrameItem[];
      links: LinkItem[];
      forms?: Omit<FormItem, 'pageUrl'>[];
      structure?: StructureDataItem;
      presentation?: { snapshots: PresentationSnapshotItem[] };
      headings: {
        documentTitle: string;
        headings: Array<{
          level: number;
          text: string;
          selector: string;
          flags: Array<string | { flag: string; skipFrom: number; skipTo: number }>;
        }>;
        flags: string[];
      };
    } | null;
  }>;
}

function ratioNumber(value: string): number | null {
  const parsed = Number.parseFloat(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function ContrastGauge({ actual, required }: { actual: string; required: string }) {
  const actualValue = ratioNumber(actual);
  const requiredValue = ratioNumber(required);

  if (actualValue == null || requiredValue == null || requiredValue <= 0) {
    return <span className="text-xs text-gray-700">{actual}</span>;
  }

  const completion = Math.min(100, Math.max(0, (actualValue / requiredValue) * 100));

  return (
    <div className="min-w-40">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="font-semibold text-red-800">{actual}</span>
        <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-800">
          {t('report.contrastInsufficient')}
        </span>
      </div>
      <div
        role="meter"
        aria-label={t('report.contrastGaugeLabel', { actual, required })}
        aria-valuemin={0}
        aria-valuemax={requiredValue}
        aria-valuenow={actualValue}
        aria-valuetext={t('report.contrastGaugeLabel', { actual, required })}
        className="h-2.5 overflow-hidden rounded-full bg-gray-200"
      >
        <div
          className="h-full rounded-full bg-red-600"
          style={{ width: `${completion}%` }}
        />
      </div>
    </div>
  );
}

export default function Results() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<AnnexTab>('images');
  const [annexTarget, setAnnexTarget] = useState<AnnexTarget | null>(null);
  const [uncoveredOpen, setUncoveredOpen] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const tabRefs = useRef<Partial<Record<AnnexTab, HTMLButtonElement | null>>>({});
  const annexPanelRef = useRef<HTMLDivElement | null>(null);
  const hasMountedAnnexTabs = useRef(false);
  const annexTabs: AnnexTab[] = ['images', 'media', 'tables', 'structure', 'presentation', 'specialized', 'frames', 'links', 'forms', 'headings', 'heuristics'];

  useEffect(() => {
    if (!hasMountedAnnexTabs.current) {
      hasMountedAnnexTabs.current = true;
      return;
    }
    annexPanelRef.current?.focus({ preventScroll: true });
  }, [activeTab]);

  const handleAnnexTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, tab: AnnexTab) => {
    const currentIndex = annexTabs.indexOf(tab);
    if (currentIndex < 0) return;
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (currentIndex + 1) % annexTabs.length;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (currentIndex - 1 + annexTabs.length) % annexTabs.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = annexTabs.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    const nextTab = annexTabs[nextIndex];
    setActiveTab(nextTab);
    setAnnexTarget(null);
    requestAnimationFrame(() => tabRefs.current[nextTab]?.focus());
  };

  const loadReport = useCallback(async () => {
    if (!sessionId) return;
    try {
      const response = await fetch(`/api/report/${sessionId}`);
      if (!response.ok) throw new Error(String(response.status));
      setReport(await response.json());
      setError('');
    } catch {
      setError(t('results.error'));
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => { void loadReport(); }, [loadReport]);

  if (loading) {
    return (
      <main id="main-content" className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-700">{t('results.loading')}</p>
      </main>
    );
  }

  if (error || !report) {
    return (
      <main id="main-content" className="min-h-screen bg-gray-50 flex items-center justify-center">
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

  const coverageLabels: Record<string, string> = {
    full: 'Couverture complète',
    partial: 'Couverture partielle',
    manual_shell: 'Revue manuelle',
  };
  const coverageColors: Record<string, string> = {
    full: 'bg-blue-50 text-blue-800',
    partial: 'bg-amber-50 text-amber-900',
    manual_shell: 'bg-gray-100 text-gray-700',
  };

  // Group criteria by theme (first digit of rgaaId)
  const byTheme = new Map<string, typeof report.summary.criteria>();
  for (const c of report.summary.criteria) {
    const themeId = c.rgaaId.split('.')[0];
    if (!byTheme.has(themeId)) byTheme.set(themeId, []);
    byTheme.get(themeId)!.push(c);
  }

  const handlePdfDownload = async () => {
    if (!sessionId || pdfLoading) return;
    setPdfLoading(true);
    try {
      const res = await fetch(`/api/report/${sessionId}/pdf`);
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rapport-rgaa-${sessionId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Download failed silently — user can retry
    } finally {
      setPdfLoading(false);
    }
  };

  const topIssues = (report.summary.topIssues ?? []).slice(0, 5);

  const comparisonPageLabel = (snapshot: PageComparison['before']): string => (
    `${snapshot.url}${snapshot.pageId ? ` — identifiant de page ${snapshot.pageId.slice(-8)}` : ''}`
  );

  const handleOpenAnnex = (target: AnnexTarget) => {
    setAnnexTarget(target);
    setActiveTab(target.tab);
    requestAnimationFrame(() => {
      const annexes = document.getElementById('annexes');
      annexes?.focus({ preventScroll: true });
      annexes?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  // Flatten collected data for annexes
  const allImages: ImageItem[] = (report.allCollected ?? []).flatMap((entry) =>
    (entry.collectedData?.images ?? []).map((img, elementIndex) => ({
      ...img,
      pageUrl: entry.url,
      pageId: entry.pageId,
      elementIndex,
    })),
  );
  const allMedia: MediaItem[] = (report.allCollected ?? []).flatMap((entry) =>
    (entry.collectedData?.media ?? []).map((media) => ({ ...media, pageUrl: entry.url, pageId: entry.pageId })),
  );
  const allTables: TableItem[] = (report.allCollected ?? []).flatMap((entry) =>
    (entry.collectedData?.structure?.tables ?? []).map((table) => ({ ...table, pageUrl: entry.url, pageId: entry.pageId })),
  );
  const allStructure: StructurePageItem[] = (report.allCollected ?? [])
    .filter((entry) => entry.collectedData?.structure)
    .map((entry) => ({
      pageUrl: entry.url,
      pageId: entry.pageId,
      pageFlags: entry.collectedData!.structure!.pageFlags,
      styles: entry.collectedData!.structure!.styles,
      languages: entry.collectedData!.structure!.languages,
      directions: entry.collectedData!.structure!.directions,
      regions: entry.collectedData!.structure!.regions,
      citations: entry.collectedData!.structure!.citations,
    }));
  const allPresentation: PresentationSnapshotItem[] = (report.allCollected ?? []).flatMap((entry) =>
    (entry.collectedData?.presentation?.snapshots ?? []).map((snapshot) => ({ ...snapshot, pageUrl: entry.url, pageId: entry.pageId })),
  );
  const allSpecialized: SpecializedContentItem[] = (report.allCollected ?? []).flatMap((entry) =>
    (entry.collectedData?.specializedContent ?? []).map((item) => ({ ...item, pageUrl: entry.url, pageId: entry.pageId })),
  );
  const allFrames: FrameItem[] = (report.allCollected ?? []).flatMap((entry) =>
    (entry.collectedData?.frames ?? []).map((frame) => ({ ...frame, pageUrl: entry.url, pageId: entry.pageId })),
  );
  const allLinks: LinkItem[] = (report.allCollected ?? []).flatMap((entry) =>
    (entry.collectedData?.links ?? []).map((link) => ({ ...link, pageUrl: entry.url, pageId: entry.pageId })),
  );
  const allForms: FormItem[] = (report.allCollected ?? []).flatMap((entry) =>
    (entry.collectedData?.forms ?? []).map((form) => ({ ...form, pageUrl: entry.url, pageId: entry.pageId })),
  );
  const allHeadings: HeadingTreeData[] = (report.allCollected ?? [])
    .filter((entry) => entry.collectedData?.headings)
    .map((entry) => ({
      url: entry.url,
      pageId: entry.pageId,
      ...entry.collectedData!.headings,
    }));

  return (
    <main id="main-content" className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-[1400px] mx-auto">
        {/* Limit banner — always visible */}
        <div
          role="alert"
          className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"
          data-testid="limit-banner"
        >
          {report.limitBanner}
        </div>

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{t('results.heading')}</h1>
          <button
            type="button"
            onClick={handlePdfDownload}
            disabled={pdfLoading}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="pdf-download-btn"
          >
            {pdfLoading ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {t('pdf.generating')}
              </>
            ) : (
              t('pdf.downloadButton')
            )}
          </button>
        </div>

        <p className="text-xs text-gray-600 mb-4" role="note" data-testid="pdf-a11y-warning">
          {t('pdf.a11yWarning')}
        </p>

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-8">
          <SummaryCard label={t('report.criteriaTotal')} value={report.summary.totalCriteria} />
          <SummaryCard label={t('report.criteriaViolation')} value={report.summary.violations} className="text-red-800" />
          <SummaryCard label={t('report.criteriaPass')} value={report.summary.passes} className="text-green-800" />
          <SummaryCard label={t('report.criteriaManual')} value={report.summary.manual} className="text-amber-900" />
        </div>

        {report.coverage && (
          <section className="mb-8 rounded-lg border border-blue-200 bg-blue-50 p-4" data-testid="coverage-summary">
            <h2 className="text-sm font-semibold text-blue-950">Périmètre du registre RGAA</h2>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <SummaryCard
                label="Critères intégrés"
                value={report.coverage.integrated}
                hint={`sur ${report.coverage.total}`}
              />
              <SummaryCard
                label="Signal automatique"
                value={report.coverage.machineSignal}
                hint="sans verdict de conformité"
                className="text-blue-800"
              />
              <SummaryCard
                label="Revue humaine requise"
                value={report.coverage.humanReview}
                hint="couverture partielle ou manuelle"
                className="text-amber-900"
              />
            </div>
          </section>
        )}

        <div className="mb-8 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900" role="note">
          Le rouge, l’orange et le vert décrivent uniquement la suggestion de la machine. La conformité RGAA doit toujours être confirmée par une décision humaine.
        </div>

        {report.review && sessionId && (
          <ReviewWorkspace
            sessionId={sessionId}
            review={report.review}
            onOpenAnnex={handleOpenAnnex}
          />
        )}

        {report.journeyAnnex && sessionId && (
          <section className="mb-8 rounded-xl border border-violet-200 bg-violet-50 p-4" data-testid="journey-annex">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-violet-950">Annexe — Parcours d’audit</h2>
                <p className="mt-1 text-sm text-violet-900">
                  Photographie versionnée des parcours rattachés à cette session (version {report.journeyAnnex.schemaVersion}).
                </p>
              </div>
              <Link
                to={`/journeys/new?sessionId=${encodeURIComponent(sessionId)}`}
                className="inline-flex rounded-lg border border-violet-300 bg-white px-3 py-2 text-sm font-medium text-violet-900 hover:bg-violet-100 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2"
              >
                Créer un parcours pour cette session
              </Link>
            </div>
            {report.journeyAnnex.runs.length === 0 ? (
              <p className="mt-3 text-sm text-violet-900">Aucun parcours d’audit n’est rattaché à cette session.</p>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-lg border border-violet-200 bg-white">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">Parcours d’audit rattachés</caption>
                  <thead className="bg-violet-100 text-xs uppercase text-violet-950">
                    <tr>
                      <th scope="col" className="px-3 py-2">Exécution</th>
                      <th scope="col" className="px-3 py-2">Parcours</th>
                      <th scope="col" className="px-3 py-2">Statut</th>
                      <th scope="col" className="px-3 py-2">Preuves</th>
                      <th scope="col" className="px-3 py-2">Décisions</th>
                      <th scope="col" className="px-3 py-2">Détail</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-violet-100">
                    {report.journeyAnnex.runs.map((run) => (
                      <tr key={run.runId}>
                        <td className="px-3 py-2 font-mono text-xs text-gray-700">{run.runId}</td>
                        <td className="px-3 py-2 font-mono text-xs text-gray-700">{run.journeyId}</td>
                        <td className="px-3 py-2 text-xs text-gray-700">{journeyStatusLabel(run.status)}</td>
                        <td className="px-3 py-2 text-xs text-gray-700">{run.run?.steps.reduce((count, step) => count + step.evidence.length, 0) ?? 0}</td>
                        <td className="px-3 py-2 text-xs text-gray-700">{run.run?.decisions?.length ?? 0}</td>
                        <td className="px-3 py-2"><Link aria-label={`Ouvrir l’exécution ${run.runId}`} className="text-primary-700 underline" to={`/journey-runs/${encodeURIComponent(run.runId)}`}>Ouvrir</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

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
                    <span className="font-mono text-sm text-gray-700 mr-2">{issue.rgaaId}</span>
                    <span className="text-sm text-gray-800">{issue.title}</span>
                  </div>
                  <span className="text-xs text-gray-600">
                    {t('report.topIssuePages', { count: issue.pagesAffected })}
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
                      <span className="font-mono text-xs text-gray-700 w-10">{c.rgaaId}</span>
                      <span className="text-sm text-gray-700 flex-1">{c.title}</span>
                      {c.coverage && (
                        <span className={`hidden rounded-full px-2 py-0.5 text-[11px] font-medium sm:inline-flex ${coverageColors[c.coverage] ?? 'bg-gray-100 text-gray-700'}`}>
                          {coverageLabels[c.coverage] ?? c.coverage}
                        </span>
                      )}
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

        {/* Contrast violations detail */}
        {(report.contrastViolations ?? []).length > 0 && (
          <section className="mb-8" data-testid="contrast-violations">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">{t('report.contrastDetail')}</h2>
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="hidden border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-700 md:table-header-group">
                  <tr>
                    <th className="px-3 py-2">ID</th>
                    <th className="px-3 py-2">{t('report.contrastSelector')}</th>
                    <th className="px-3 py-2">{t('report.contrastRatio')}</th>
                    <th className="px-3 py-2">{t('report.contrastRequired')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 md:divide-gray-100">
                  {report.contrastViolations!.map((v, i) => (
                    <tr key={i} className="grid grid-cols-2 gap-x-3 gap-y-3 p-4 md:table-row md:p-0">
                      <td className="order-1 p-0 font-mono text-xs text-gray-700 md:table-cell md:px-3 md:py-2">
                        <span className="mb-0.5 block font-sans text-[10px] font-semibold uppercase text-gray-500 md:hidden">ID</span>
                        {v.rgaaId}
                      </td>
                      <td className="order-3 col-span-2 min-w-0 break-all p-0 text-xs text-gray-700 md:table-cell md:px-3 md:py-2">
                        <span className="mb-0.5 block text-[10px] font-semibold uppercase text-gray-500 md:hidden">{t('report.contrastSelector')}</span>
                        {v.selector}
                      </td>
                      <td className="order-4 col-span-2 p-0 text-xs text-gray-700 md:table-cell md:px-3 md:py-2">
                        <span className="mb-1 block text-[10px] font-semibold uppercase text-gray-500 md:hidden">{t('report.contrastRatio')}</span>
                        <ContrastGauge actual={v.contrastRatio} required={v.expectedContrastRatio} />
                      </td>
                      <td className="order-2 p-0 text-right text-xs font-semibold text-gray-800 md:table-cell md:px-3 md:py-2 md:text-left">
                        <span className="mb-0.5 block text-[10px] font-semibold uppercase text-gray-500 md:hidden">{t('report.contrastRequired')}</span>
                        {v.expectedContrastRatio}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

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
              <span className="text-sm font-normal text-gray-600">({report.uncoveredThemes.length})</span>
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

        {report.comparisons && report.comparisons.length > 0 && (
          <section className="mb-8" data-testid="comparison-summary">
            <h2 className="mb-3 text-lg font-semibold text-gray-900">{t('results.comparisonTitle')}</h2>
            <div className="space-y-3">
              {report.comparisons.map((comparison) => (
                <article key={`${comparison.before.pageId ?? comparison.before.url}:${comparison.after.pageId ?? comparison.after.url}`} className="rounded-xl border border-gray-200 bg-white p-4">
                  <h3 className="text-sm font-semibold text-gray-800">
                    Avant : {comparisonPageLabel(comparison.before)} <span aria-hidden="true">→</span> Après : {comparisonPageLabel(comparison.after)}
                  </h3>
                  <p className="mt-1 text-xs text-gray-500">
                    Avant : {comparison.before.observedAt ?? 'horodatage absent'} · Après : {comparison.after.observedAt ?? 'horodatage absent'}
                  </p>
                  {(comparison.before.stepId || comparison.after.stepId) && (
                    <p className="mt-1 text-xs text-gray-500">
                      {comparison.before.stepId && `${t('results.comparisonBefore')} — ${t('results.comparisonStep')} : ${comparison.before.stepId}`}
                      {comparison.before.stepId && comparison.after.stepId ? ' · ' : ''}
                      {comparison.after.stepId && `${t('results.comparisonAfter')} — ${t('results.comparisonStep')} : ${comparison.after.stepId}`}
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

        {/* Annexes tabs */}
        <section id="annexes" tabIndex={-1} className="mb-8 scroll-mt-4 focus:outline-none">
          <div className="flex border-b border-gray-200 mb-4" role="tablist" aria-label="Annexes du rapport">
            {annexTabs.map((tab) => (
              <button
                key={tab}
                id={`annex-tab-${tab}`}
                ref={(element) => { tabRefs.current[tab] = element; }}
                type="button"
                onClick={() => {
                  setActiveTab(tab);
                  setAnnexTarget(null);
                }}
                onKeyDown={(event) => handleAnnexTabKeyDown(event, tab)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-primary-600 text-primary-700'
                    : 'border-transparent text-gray-600 hover:text-gray-800'
                }`}
                aria-selected={activeTab === tab}
                aria-controls="annex-panel"
                tabIndex={activeTab === tab ? 0 : -1}
                role="tab"
              >
                {tab === 'heuristics'
                  ? `\uD83D\uDD0D ${t('results.tabHeuristics')}`
                  : t(`results.tab${tab.charAt(0).toUpperCase() + tab.slice(1)}`)}
              </button>
            ))}
          </div>
          <div ref={annexPanelRef} id="annex-panel" role="tabpanel" aria-labelledby={`annex-tab-${activeTab}`} tabIndex={-1} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            {activeTab === 'images' && (
              <AnnexeImages
                images={allImages}
                sessionId={sessionId!}
                initialDecisions={report.review?.imageDecisions}
                initialPageUrl={annexTarget?.tab === 'images' ? annexTarget.pageUrl : undefined}
                initialPageId={annexTarget?.tab === 'images' ? annexTarget.pageId : undefined}
                focusedSelectors={annexTarget?.tab === 'images' ? annexTarget.selectors : undefined}
                focusedElementIndexes={annexTarget?.tab === 'images' ? annexTarget.elementIndexes : undefined}
                focusedCriterionId={annexTarget?.tab === 'images' ? annexTarget.criterionId : undefined}
                criterionReviews={report.review?.pages.flatMap((page) => page.criteria
                  .filter((criterion) => criterion.rgaaId === '1.3')
                  .map((criterion) => ({
                    pageUrl: page.url,
                    pageId: page.pageId,
                    criterionId: criterion.rgaaId,
                    humanStatus: criterion.humanStatus,
                    decisionSource: criterion.decisionSource,
                  })))}
                onSaved={loadReport}
              />
            )}
            {activeTab === 'media' && (
              <AnnexeMedias
                media={allMedia}
                initialPageUrl={annexTarget?.tab === 'media' ? annexTarget.pageUrl : undefined}
                initialPageId={annexTarget?.tab === 'media' ? annexTarget.pageId : undefined}
              />
            )}
            {activeTab === 'tables' && (
              <AnnexeTableaux
                tables={allTables}
                initialPageUrl={annexTarget?.tab === 'tables' ? annexTarget.pageUrl : undefined}
                initialPageId={annexTarget?.tab === 'tables' ? annexTarget.pageId : undefined}
                focusedSelectors={annexTarget?.tab === 'tables' ? annexTarget.selectors : undefined}
                focusedCriterionId={annexTarget?.tab === 'tables' ? annexTarget.criterionId : undefined}
              />
            )}
            {activeTab === 'structure' && <AnnexeStructure pages={allStructure} />}
            {activeTab === 'presentation' && (
              <AnnexePresentation
                snapshots={allPresentation}
                initialPageUrl={annexTarget?.tab === 'presentation' ? annexTarget.pageUrl : undefined}
                initialPageId={annexTarget?.tab === 'presentation' ? annexTarget.pageId : undefined}
                focusedSelectors={annexTarget?.tab === 'presentation' ? annexTarget.selectors : undefined}
                focusedCriterionId={annexTarget?.tab === 'presentation' ? annexTarget.criterionId : undefined}
              />
            )}
            {activeTab === 'specialized' && (
              <AnnexeContenusSpecialises
                items={allSpecialized}
                initialPageUrl={annexTarget?.tab === 'specialized' ? annexTarget.pageUrl : undefined}
                initialPageId={annexTarget?.tab === 'specialized' ? annexTarget.pageId : undefined}
              />
            )}
            {activeTab === 'frames' && (
              <AnnexeCadres
                frames={allFrames}
                sessionId={sessionId!}
                initialPageUrl={annexTarget?.tab === 'frames' ? annexTarget.pageUrl : undefined}
                initialPageId={annexTarget?.tab === 'frames' ? annexTarget.pageId : undefined}
                focusedSelectors={annexTarget?.tab === 'frames' ? annexTarget.selectors : undefined}
                focusedCriterionId={annexTarget?.tab === 'frames' ? annexTarget.criterionId : undefined}
              />
            )}
            {activeTab === 'links' && (
              <AnnexeLiens
                links={allLinks}
                sessionId={sessionId!}
                initialPageUrl={annexTarget?.tab === 'links' ? annexTarget.pageUrl : undefined}
                initialPageId={annexTarget?.tab === 'links' ? annexTarget.pageId : undefined}
              />
            )}
            {activeTab === 'forms' && (
              <AnnexeFormulaires
                forms={allForms}
                initialPageUrl={annexTarget?.tab === 'forms' ? annexTarget.pageUrl : undefined}
                initialPageId={annexTarget?.tab === 'forms' ? annexTarget.pageId : undefined}
              />
            )}
            {activeTab === 'headings' && (
              <AnnexeTitres
                headingData={allHeadings}
                sessionId={sessionId!}
                initialPageUrl={annexTarget?.tab === 'headings' ? annexTarget.pageUrl : undefined}
                initialPageId={annexTarget?.tab === 'headings' ? annexTarget.pageId : undefined}
              />
            )}
            {activeTab === 'heuristics' && (
              <AnnexeHeuristiques
                findings={report.heuristicFindings ?? []}
                sessionId={sessionId!}
                initialPageUrl={annexTarget?.tab === 'heuristics' ? annexTarget.pageUrl : undefined}
                initialPageId={annexTarget?.tab === 'heuristics' ? annexTarget.pageId : undefined}
              />
            )}
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

function SummaryCard({ label, value, hint, className = '' }: { label: string; value: number; hint?: string; className?: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <p className="text-xs text-gray-600 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${className || 'text-gray-900'}`}>{value}</p>
      {hint && <p className="text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

function journeyStatusLabel(status: 'running' | 'completed' | 'completed_with_errors' | 'failed'): string {
  return {
    running: 'En cours',
    completed: 'Terminée',
    completed_with_errors: 'Terminée avec erreurs',
    failed: 'Échec',
  }[status];
}
