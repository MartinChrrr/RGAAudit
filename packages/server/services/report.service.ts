import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  mapPageResults,
  aggregateResults,
  buildReport,
  summarizeCoverage,
  type CriterionCoverageSummary,
  type MappedPage,
} from '@rgaaudit/core/mapping/mapper';
import { getCriterion, loadMapping } from '@rgaaudit/core/mapping';
import type {
  CriterionCoverage,
  HumanLevel,
  ImplementationLot,
} from '@rgaaudit/core/mapping';
import type { SessionState } from '@rgaaudit/core/analyzer/analyzer';
import type { AxeElement } from '@rgaaudit/core/engines/engine.interface';
import type { CollectedData } from '@rgaaudit/core/analyzer/data-collector';
import type { HeuristicFinding } from '@rgaaudit/core/analyzer/heuristics/heuristic.interface';
import {
  aggregateHumanStatus,
  machineStatusFromLegacyStatus,
  type AuditDecision,
  type AuditReviewState,
  type HumanStatus,
  type ImageAuditDecision,
  type MachineStatus,
} from '@rgaaudit/core/domain/review';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf-8'));
const APP_VERSION: string = pkg.version;

export interface ContrastViolationItem {
  pageUrl: string;
  rgaaId: string;
  selector: string;
  contrastRatio: string;
  expectedContrastRatio: string;
  fgColor: string;
  bgColor: string;
}

export interface ReportData {
  report: ReturnType<typeof buildReport>;
  mappedPages: MappedPage[];
  allCollected: { url: string; collectedData: CollectedData | null }[];
  contrastViolations: ContrastViolationItem[];
  heuristicFindings: Array<HeuristicFinding & {
    heuristicId: string;
    rgaaCriteria: string[];
    pageUrl: string;
  }>;
  review: ReviewData;
}

export interface ReviewCriterion {
  rgaaId: string;
  title: string;
  theme: string;
  coverage: CriterionCoverage;
  humanLevel: HumanLevel;
  implementationLot: ImplementationLot;
  wcag: string[];
  machineStatus: MachineStatus;
  humanStatus: HumanStatus;
  comment: string;
  reviewedAt: string | null;
  violationsCount: number;
  incompletesCount: number;
  elements: Array<{ selector: string; flags: string[]; elementIndex?: number }>;
  evidence: ReviewEvidence[];
  proofStatus: 'linked' | 'missing' | 'not_required';
  missingProofs: string[];
  manualChecks: string[];
}

export interface ReviewEvidence {
  proofId: string;
  resultId: string;
  pageUrl: string;
  criterionId: string;
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
}

export interface ReviewData {
  updatedAt: string;
  coverage: CriterionCoverageSummary;
  summary: {
    total: number;
    reviewed: number;
    compliant: number;
    nonCompliant: number;
    notApplicable: number;
    notTested: number;
  };
  pages: Array<{ url: string; criteria: ReviewCriterion[] }>;
  criteria: Array<{
    rgaaId: string;
    machineStatus: MachineStatus;
    humanStatus: HumanStatus;
  }>;
  imageDecisions: ImageAuditDecision[];
}

export function buildReportFromSession(
  session: SessionState,
  reviewState?: AuditReviewState,
): ReportData {
  const mappedPages = Object.values(session.results)
    .filter((r) => !r.error)
    .map((r) => mapPageResults(r.axeResults, r.collectedData, r.url, r.heuristicResults));

  const allCollected = Object.values(session.results)
    .filter((r) => !r.error)
    .map((r) => ({ url: r.url, collectedData: r.collectedData }));

  const summary = aggregateResults(mappedPages, allCollected);

  const firstUrl = session.completedPages[0] ?? '';
  const report = buildReport(summary, {
    url: firstUrl,
    date: session.startedAt,
    pagesAudited: session.completedPages.length,
    version: APP_VERSION,
  }, allCollected);

  const contrastViolations = extractContrastViolations(mappedPages);
  const heuristicFindings = Object.values(session.results).flatMap((page) =>
    (page.heuristicResults ?? []).flatMap((result) =>
      result.findings.map((finding) => ({
        ...finding,
        heuristicId: result.heuristicId,
        rgaaCriteria: result.rgaaCriteria,
        pageUrl: page.url,
      })),
    ),
  );
  const review = buildReviewData(mappedPages, reviewState);

  return { report, mappedPages, allCollected, contrastViolations, heuristicFindings, review };
}

function buildReviewData(mappedPages: MappedPage[], state?: AuditReviewState): ReviewData {
  const decisions = state?.decisions ?? [];
  const decisionByCriterion = new Map<string, AuditDecision>();
  for (const decision of decisions) {
    decisionByCriterion.set(`${decision.pageUrl}\u001f${decision.criterionId}`, decision);
  }

  const pages = mappedPages.map((page) => ({
    url: page.url,
    criteria: page.criteria.map((criterion): ReviewCriterion => {
      const decision = decisionByCriterion.get(`${page.url}\u001f${criterion.rgaaId}`);
      return {
        rgaaId: criterion.rgaaId,
        title: criterion.title,
        theme: criterion.theme,
        coverage: criterion.coverage,
        humanLevel: criterion.humanLevel,
        implementationLot: criterion.implementationLot,
        wcag: getCriterion(criterion.rgaaId)?.wcag ?? [],
        machineStatus: machineStatusFromLegacyStatus(criterion.status, criterion.coverage),
        humanStatus: decision?.status ?? 'not_tested',
        comment: decision?.comment ?? '',
        reviewedAt: decision?.reviewedAt ?? null,
        violationsCount: criterion.violations?.length ?? 0,
        incompletesCount: criterion.incompletes?.length ?? 0,
        elements: criterion.elements ?? [],
        evidence: [
          ...criterion.violations.flatMap((violation) => violation.elements.map((element, index) => toReviewEvidence(page.url, criterion.rgaaId, 'violation', violation, element, index))),
          ...criterion.incompletes.flatMap((incomplete) => incomplete.elements.map((element, index) => toReviewEvidence(page.url, criterion.rgaaId, 'incomplete', incomplete, element, index))),
        ],
        proofStatus: getProofStatus(criterion),
        missingProofs: getProofStatus(criterion) === 'missing'
          ? ['Aucune preuve automatique ou élément collecté n’est rattaché à ce résultat. Une vérification humaine est nécessaire.']
          : [],
        manualChecks: criterion.manualChecks ?? [],
      };
    }),
  }));

  const allCriteria = pages.flatMap((page) => page.criteria);
  const reviewed = allCriteria.filter((criterion) => criterion.humanStatus !== 'not_tested');
  const criterionIds = [...new Set(allCriteria.map((criterion) => criterion.rgaaId))];

  return {
    updatedAt: state?.updatedAt ?? new Date(0).toISOString(),
    coverage: summarizeCoverage(loadMapping().criteria),
    summary: {
      total: allCriteria.length,
      reviewed: reviewed.length,
      compliant: reviewed.filter((criterion) => criterion.humanStatus === 'compliant').length,
      nonCompliant: reviewed.filter((criterion) => criterion.humanStatus === 'non_compliant').length,
      notApplicable: reviewed.filter((criterion) => criterion.humanStatus === 'not_applicable').length,
      notTested: allCriteria.length - reviewed.length,
    },
    pages,
    criteria: criterionIds.map((rgaaId) => {
      const pageCriteria = allCriteria.filter((criterion) => criterion.rgaaId === rgaaId);
      const machineStatus = pageCriteria.some((criterion) => criterion.machineStatus === 'probable_issue')
        ? 'probable_issue'
        : pageCriteria.some((criterion) => criterion.machineStatus === 'needs_review')
          ? 'needs_review'
          : 'no_issue_detected';
      return {
        rgaaId,
        machineStatus,
        humanStatus: aggregateHumanStatus(pageCriteria.map((criterion) => criterion.humanStatus)),
      };
    }),
    imageDecisions: state?.imageDecisions ?? [],
  };
}

function toReviewEvidence(
  pageUrl: string,
  criterionId: string,
  kind: ReviewEvidence['kind'],
  result: { rule: string; impact?: string; description: string; helpUrl?: string },
  element: AxeElement,
  elementIndex: number,
): ReviewEvidence {
  const resultId = `result-${encodeURIComponent(pageUrl)}-${criterionId}-${kind}-${result.rule}`;
  const proofId = `proof-${encodeURIComponent(pageUrl)}-${criterionId}-${kind}-${result.rule}-${elementIndex}`;
  return {
    proofId,
    resultId,
    pageUrl,
    criterionId,
    kind,
    rule: result.rule,
    ...(result.impact ? { impact: result.impact } : {}),
    description: result.description,
    ...(result.helpUrl ? { helpUrl: result.helpUrl } : {}),
    selector: element.target.join(' > '),
    target: element.target,
    html: element.html,
    ...(element.context ? { context: element.context } : {}),
    ...(element.elementIndex !== undefined ? { elementIndex: element.elementIndex } : {}),
  };
}

function getProofStatus(criterion: MappedPage['criteria'][number]): ReviewCriterion['proofStatus'] {
  if (criterion.violations.length > 0 || criterion.incompletes.length > 0 || criterion.elements.length > 0) {
    return 'linked';
  }
  if (criterion.status === 'violation' || criterion.status === 'incomplete' || criterion.coverage !== 'full') {
    return 'missing';
  }
  return 'not_required';
}

function extractContrastViolations(mappedPages: MappedPage[]): ContrastViolationItem[] {
  const contrastRules = ['color-contrast', 'color-contrast-enhanced'];
  const rgaaIdByRule: Record<string, string> = {
    'color-contrast': '3.2',
    'color-contrast-enhanced': '3.3',
  };
  const items: ContrastViolationItem[] = [];

  for (const page of mappedPages) {
    for (const criterion of page.criteria) {
      if (!['3.2', '3.3'].includes(criterion.rgaaId)) continue;
      for (const violation of criterion.violations) {
        if (!contrastRules.includes(violation.rule)) continue;
        for (const el of violation.elements) {
          const data = el.data ?? {};
          items.push({
            pageUrl: page.url,
            rgaaId: rgaaIdByRule[violation.rule] ?? criterion.rgaaId,
            selector: el.target.join(', '),
            contrastRatio: formatContrastRatio(data.contrastRatio),
            expectedContrastRatio: formatContrastRatio(data.expectedContrastRatio),
            fgColor: typeof data.fgColor === 'string' ? data.fgColor : '',
            bgColor: typeof data.bgColor === 'string' ? data.bgColor : '',
          });
        }
      }
    }
  }

  return items;
}

export function formatContrastRatio(value: unknown): string {
  if (value == null) return '';

  const normalized = String(value).trim().replace(',', '.');
  const ratio = normalized.match(/^(\d+(?:\.\d+)?)\s*(?::\s*1)*$/);
  return ratio ? `${ratio[1]}:1` : normalized;
}
