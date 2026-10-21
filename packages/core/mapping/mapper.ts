import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { EngineResult, AxeViolation, AxeIncomplete } from '../engines/engine.interface';
import type { AnalyzeResult } from '../engines';
import type { CollectedData } from '../analyzer/data-collector';
import type { HeuristicResult, HeuristicFinding } from '../analyzer/heuristics/heuristic.interface';
import type {
  CriterionCoverage,
  HumanLevel,
  ImplementationLot,
  RgaaCriterion,
  RgaaMapping,
} from './index';
import type { PageComparison } from '../report/comparison';
import { compareCollectedData } from '../report/comparison';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CriterionStatus = 'violation' | 'pass' | 'manual' | 'incomplete';

export interface MappedHeuristicFinding extends HeuristicFinding {
  heuristicId: string;
}

export interface MappedCriterion {
  rgaaId: string;
  title: string;
  theme: string;
  coverage: CriterionCoverage;
  humanLevel: HumanLevel;
  implementationLot: ImplementationLot;
  status: CriterionStatus;
  violations: AxeViolation[];
  incompletes: AxeIncomplete[];
  elements: Array<{ selector: string; flags: string[]; elementIndex?: number }>;
  heuristicFindings: MappedHeuristicFinding[];
  notes: string;
  manualChecks: string[];
}

export interface MappedPage {
  url: string;
  criteria: MappedCriterion[];
}

export interface AggregatedCriterion {
  rgaaId: string;
  title: string;
  theme: string;
  coverage: CriterionCoverage;
  humanLevel: HumanLevel;
  implementationLot: ImplementationLot;
  status: CriterionStatus;
  pagesViolating: string[];
  pagesPass: string[];
  pagesManual: string[];
  pagesIncomplete: string[];
  manualChecks?: string[];
}

/** Coverage counts for the complete 106-criterion register.
 *
 * The counters intentionally overlap: a criterion can be integrated and have
 * a machine signal, while partial criteria also remain subject to human review.
 */
export interface CriterionCoverageSummary {
  total: number;
  integrated: number;
  machineSignal: number;
  humanReview: number;
  full: number;
  partial: number;
  manualShell: number;
}

export interface TopIssue {
  rgaaId: string;
  title: string;
  pagesAffected: number;
}

export interface AuditReportSummary {
  totalCriteria: number;
  automated: number;
  violations: number;
  passes: number;
  manual: number;
  incomplete: number;
  topIssues: TopIssue[];
  criteria: AggregatedCriterion[];
  coverage: CriterionCoverageSummary;
}

export interface AuditConfig {
  url: string;
  date: string;
  pagesAudited: number;
  version: string;
}

export interface Report {
  metadata: {
    url: string;
    date: string;
    version: string;
    pagesAudited: number;
    coveredThemes: string[];
    totalRgaaCriteria: number;
    coveredCriteria: number;
  };
  limitBanner: string;
  coverage: CriterionCoverageSummary;
  overlaysDetected: string[];
  summary: AuditReportSummary;
  uncoveredThemes: Array<{
    id: string;
    name: string;
    manualChecklist: string[];
  }>;
  comparisons?: PageComparison[];
}

export function summarizeCoverage(criteria: RgaaCriterion[]): CriterionCoverageSummary {
  return criteria.reduce<CriterionCoverageSummary>((summary, criterion) => {
    summary.total++;
    if (criterion.implementationLot === 0) summary.integrated++;
    if (criterion.coverage !== 'manual_shell') summary.machineSignal++;
    if (criterion.coverage !== 'full') summary.humanReview++;
    if (criterion.coverage === 'full') summary.full++;
    if (criterion.coverage === 'partial') summary.partial++;
    if (criterion.coverage === 'manual_shell') summary.manualShell++;
    return summary;
  }, {
    total: 0,
    integrated: 0,
    machineSignal: 0,
    humanReview: 0,
    full: 0,
    partial: 0,
    manualShell: 0,
  });
}

// ---------------------------------------------------------------------------
// loadMapping — validates and caches
// ---------------------------------------------------------------------------

let cachedMapping: RgaaMapping | null = null;

export function loadMapping(): RgaaMapping {
  if (cachedMapping) return cachedMapping;

  const filePath = resolve(__dirname, 'rgaa-4.1.json');
  let raw: string;
  try {
    raw = readFileSync(filePath, 'utf-8');
  } catch {
    throw new Error(`Fichier de mapping introuvable : ${filePath}`);
  }

  let parsed: RgaaMapping;
  try {
    parsed = JSON.parse(raw) as RgaaMapping;
  } catch {
    throw new Error(`Fichier de mapping invalide (JSON malformé) : ${filePath}`);
  }

  if (!parsed.version) {
    throw new Error('Mapping invalide : version absente');
  }
  if (!Array.isArray(parsed.criteria) || parsed.criteria.length === 0) {
    throw new Error('Mapping invalide : criteria absent ou vide');
  }
  if (parsed.criteria.length !== parsed.totalCriteria) {
    throw new Error(`Mapping invalide : ${parsed.totalCriteria} critères attendus, ${parsed.criteria.length} trouvés`);
  }
  const ids = parsed.criteria.map((criterion) => criterion.rgaa?.id);
  if (ids.some((id) => !/^\d+\.\d+$/.test(id)) || new Set(ids).size !== ids.length) {
    throw new Error('Mapping invalide : identifiants RGAA absents, invalides ou dupliqués');
  }
  for (const criterion of parsed.criteria) {
    if (!['full', 'partial', 'manual_shell'].includes(criterion.coverage)) {
      throw new Error(`Mapping invalide : couverture inconnue pour ${criterion.rgaa.id}`);
    }
    if (!['H0', 'H1', 'H2', 'H3'].includes(criterion.humanLevel)) {
      throw new Error(`Mapping invalide : niveau humain inconnu pour ${criterion.rgaa.id}`);
    }
    if (![0, 1, 2, 3, 4, 5].includes(criterion.implementationLot)) {
      throw new Error(`Mapping invalide : lot d'implémentation inconnu pour ${criterion.rgaa.id}`);
    }
  }

  cachedMapping = parsed;
  return cachedMapping;
}

/** Reset cache — for testing only */
export function _resetCache(): void {
  cachedMapping = null;
}

// ---------------------------------------------------------------------------
// mapPageResults
// ---------------------------------------------------------------------------

export function mapPageResults(
  axeResults: AnalyzeResult | null,
  collectedData: CollectedData | null,
  url: string,
  heuristicResults?: HeuristicResult[],
): MappedPage {
  const mapping = loadMapping();
  const criteria: MappedCriterion[] = [];

  // Index heuristic findings by RGAA criterion
  const heuristicByCriterion = new Map<string, MappedHeuristicFinding[]>();
  if (heuristicResults) {
    for (const result of heuristicResults) {
      for (const finding of result.findings) {
        for (const criterionId of result.rgaaCriteria) {
          if (!heuristicByCriterion.has(criterionId)) {
            heuristicByCriterion.set(criterionId, []);
          }
          heuristicByCriterion.get(criterionId)!.push({
            ...finding,
            heuristicId: result.heuristicId,
          });
        }
      }
    }
  }

  for (const criterion of mapping.criteria) {
    const mapped = mapCriterion(criterion, axeResults, collectedData);
    const findings = heuristicByCriterion.get(criterion.rgaa.id) ?? [];
    mapped.heuristicFindings = findings;

    // Merge heuristic confidence into criterion status
    if (findings.length > 0) {
      const hasCertain = findings.some((f) => f.confidence === 'certain');
      const hasLikely = findings.some((f) => f.confidence === 'likely');
      const hasPossible = findings.some((f) => f.confidence === 'possible');

      if (hasCertain && mapped.status !== 'violation') {
        mapped.status = 'violation';
      } else if (hasLikely && !hasCertain && mapped.status === 'pass') {
        mapped.status = 'incomplete';
      } else if (hasPossible && !hasCertain && !hasLikely && mapped.status === 'pass') {
        mapped.status = 'manual';
      }
    }

    criteria.push(mapped);
  }

  return { url, criteria };
}

function getManualChecks(criterion: RgaaCriterion): string[] {
  const configured = criterion.heuristicPatterns.manualChecks;
  if (configured && configured.length > 0) return configured;
  if (criterion.coverage === 'manual_shell' || criterion.evaluationStrategy === 'MANUAL_ONLY') {
    return [
      `Vérifier le critère ${criterion.rgaa.id} (« ${criterion.rgaa.title} ») dans le contexte audité, puis consigner le résultat conforme, non conforme ou non applicable, avec la preuve et le contexte observés.`,
    ];
  }
  return [];
}

function mapCriterion(
  criterion: RgaaCriterion,
  axeResults: AnalyzeResult | null,
  collectedData: CollectedData | null,
): MappedCriterion {
  const base: Omit<MappedCriterion, 'status' | 'violations' | 'incompletes' | 'elements' | 'heuristicFindings'> = {
    rgaaId: criterion.rgaa.id,
    title: criterion.rgaa.title,
    theme: criterion.rgaa.theme,
    coverage: criterion.coverage,
    humanLevel: criterion.humanLevel,
    implementationLot: criterion.implementationLot,
    notes: criterion.limits,
    manualChecks: getManualChecks(criterion),
  };

  // Manual shells and MANUAL_ONLY criteria never produce a machine verdict.
  if (criterion.coverage === 'manual_shell' || criterion.evaluationStrategy === 'MANUAL_ONLY') {
    const elements = extractElements(criterion, collectedData);
    return { ...base, status: 'manual', violations: [], incompletes: [], elements, heuristicFindings: [] };
  }

  const elements = extractElements(criterion, collectedData);

  // If no axe results (error page), return manual
  if (!axeResults || axeResults.error) {
    return { ...base, status: 'manual', violations: [], incompletes: [], elements, heuristicFindings: [] };
  }

  if (criterion.evaluationStrategy === 'COLLECTOR_FLAGS') {
    return {
      ...base,
      status: elements.length > 0 ? 'violation' : criterion.coverage === 'full' ? 'pass' : 'manual',
      violations: [],
      incompletes: [],
      elements,
      heuristicFindings: [],
    };
  }

  const engineResult = axeResults as EngineResult;

  if (criterion.evaluationStrategy === 'ANY_VIOLATION') {
    return mapAnyViolation(criterion, engineResult, elements, base);
  }

  if (criterion.evaluationStrategy === 'ANY_VIOLATION_REVIEW') {
    return mapAnyViolationForReview(criterion, engineResult, elements, base);
  }

  if (criterion.evaluationStrategy === 'ALL_PASS') {
    return mapAllPass(criterion, engineResult, elements, base);
  }

  // Unknown strategy — fallback to manual
  return { ...base, status: 'manual', violations: [], incompletes: [], elements, heuristicFindings: [] };
}

/**
 * A deterministic signal is retained as evidence but never promoted to an
 * RGAA violation when the rule only covers a subset of the criterion.
 */
function mapAnyViolationForReview(
  criterion: RgaaCriterion,
  result: EngineResult,
  elements: Array<{ selector: string; flags: string[]; elementIndex?: number }>,
  base: Omit<MappedCriterion, 'status' | 'violations' | 'incompletes' | 'elements' | 'heuristicFindings'>,
): MappedCriterion {
  const violations = result.violations.filter((v) => criterion.axeRules.includes(v.rule));
  const incompletes = result.incomplete.filter((i) => criterion.axeRules.includes(i.rule));
  const status: CriterionStatus = violations.length > 0 || incompletes.length > 0 ? 'incomplete' : 'manual';
  return { ...base, status, violations, incompletes, elements, heuristicFindings: [] };
}

function mapAnyViolation(
  criterion: RgaaCriterion,
  result: EngineResult,
  elements: Array<{ selector: string; flags: string[]; elementIndex?: number }>,
  base: Omit<MappedCriterion, 'status' | 'violations' | 'incompletes' | 'elements' | 'heuristicFindings'>,
): MappedCriterion {
  const violations = result.violations.filter((v) => criterion.axeRules.includes(v.rule));
  const incompletes = result.incomplete.filter((i) => criterion.axeRules.includes(i.rule));

  let status: CriterionStatus;
  if (violations.length > 0) {
    status = 'violation';
  } else if (incompletes.length > 0) {
    status = 'incomplete';
  } else if (criterion.coverage !== 'full') {
    // Absence of an axe violation is not equivalent to RGAA compliance when
    // the criterion is only partially covered by the current implementation.
    status = 'manual';
  } else {
    status = 'pass';
  }

  return { ...base, status, violations, incompletes, elements, heuristicFindings: [] };
}

function mapAllPass(
  criterion: RgaaCriterion,
  result: EngineResult,
  elements: Array<{ selector: string; flags: string[]; elementIndex?: number }>,
  base: Omit<MappedCriterion, 'status' | 'violations' | 'incompletes' | 'elements' | 'heuristicFindings'>,
): MappedCriterion {
  const violations = result.violations.filter((v) => criterion.axeRules.includes(v.rule));
  const incompletes = result.incomplete.filter((i) => criterion.axeRules.includes(i.rule));

  if (violations.length > 0) {
    return { ...base, status: 'violation', violations, incompletes, elements, heuristicFindings: [] };
  }

  // ALL_PASS: pass only if ALL rules are in passes
  const passedRules = new Set(result.passes.map((p) => p.rule));
  const allPass = criterion.axeRules.every((rule) => passedRules.has(rule));

  if (allPass && criterion.coverage === 'full') {
    return { ...base, status: 'pass', violations: [], incompletes, elements, heuristicFindings: [] };
  }

  return {
    ...base,
    status: criterion.coverage === 'full' ? 'incomplete' : 'manual',
    violations: [],
    incompletes,
    elements,
    heuristicFindings: [],
  };
}

function extractElements(
  criterion: RgaaCriterion,
  collectedData: CollectedData | null,
): Array<{ selector: string; flags: string[]; elementIndex?: number }> {
  if (!collectedData) return [];

  const elements: Array<{ selector: string; flags: string[]; elementIndex?: number }> = [];
  const relevantFlags = new Set(criterion.dataCollectorFlags);

  // Images
  for (const [elementIndex, img] of collectedData.images.entries()) {
    const matchingFlags = img.flags.filter((f) => relevantFlags.has(f));
    if (matchingFlags.length > 0) {
      elements.push({ selector: img.selector, flags: matchingFlags, elementIndex });
    }
  }

  // Frames
  for (const frame of collectedData.frames ?? []) {
    const matchingFlags = frame.flags.filter((f) => relevantFlags.has(f));
    if (matchingFlags.length > 0) {
      elements.push({ selector: frame.selector, flags: matchingFlags });
    }
  }

  // Links
  for (const link of collectedData.links) {
    const matchingFlags = link.flags.filter((f) => relevantFlags.has(f));
    if (matchingFlags.length > 0) {
      elements.push({ selector: link.selector, flags: matchingFlags });
    }
  }

  // Headings
  for (const heading of collectedData.headings.headings) {
    for (const flag of heading.flags) {
      const flagName = typeof flag === 'string' ? flag : flag.flag;
      if (relevantFlags.has(flagName)) {
        elements.push({ selector: heading.selector, flags: [flagName] });
      }
    }
  }

  // Page-level heading flags (NO_H1, MULTIPLE_H1, TITLE_ABSENT, TITLE_GENERIC)
  for (const flag of collectedData.headings.flags) {
    if (relevantFlags.has(flag)) {
      const alreadyAdded = elements.some((e) => e.flags.includes(flag));
      if (!alreadyAdded) {
        elements.push({ selector: 'document', flags: [flag] });
      }
    }
  }

  // Figure captions
  for (const caption of collectedData.figcaptions ?? []) {
    const matchingFlags = caption.flags.filter((flag) => relevantFlags.has(flag));
    if (matchingFlags.length > 0) {
      elements.push({ selector: caption.selector, flags: matchingFlags });
    }
  }

  return elements;
}

// ---------------------------------------------------------------------------
// aggregateResults
// ---------------------------------------------------------------------------

export function aggregateResults(
  mappedPages: MappedPage[],
  allCollectedData?: Array<{ url: string; collectedData: CollectedData | null }>,
): AuditReportSummary {
  const mapping = loadMapping();
  const criteriaMap = new Map<string, AggregatedCriterion>();

  // Cross-page evidence must be applied before the aggregate statuses are computed.
  if (allCollectedData) {
    detectDuplicateLabels(mappedPages, allCollectedData);
  }

  // Initialize from mapping
  for (const criterion of mapping.criteria) {
    criteriaMap.set(criterion.rgaa.id, {
      rgaaId: criterion.rgaa.id,
      title: criterion.rgaa.title,
      theme: criterion.rgaa.theme,
      coverage: criterion.coverage,
      humanLevel: criterion.humanLevel,
      implementationLot: criterion.implementationLot,
      status: 'pass',
      pagesViolating: [],
      pagesPass: [],
      pagesManual: [],
      pagesIncomplete: [],
      manualChecks: getManualChecks(criterion),
    });
  }

  // Aggregate per-page results
  for (const page of mappedPages) {
    for (const criterion of page.criteria) {
      const agg = criteriaMap.get(criterion.rgaaId);
      if (!agg) continue;

      switch (criterion.status) {
        case 'violation':
          agg.pagesViolating.push(page.url);
          break;
        case 'pass':
          agg.pagesPass.push(page.url);
          break;
        case 'manual':
          agg.pagesManual.push(page.url);
          break;
        case 'incomplete':
          agg.pagesIncomplete.push(page.url);
          break;
      }
    }
  }

  // Compute final status per criterion
  for (const agg of criteriaMap.values()) {
    if (agg.pagesViolating.length > 0) {
      agg.status = 'violation';
    } else if (agg.pagesIncomplete.length > 0) {
      agg.status = 'incomplete';
    } else if (agg.pagesManual.length > 0 && agg.pagesPass.length === 0) {
      agg.status = 'manual';
    } else if (agg.pagesPass.length > 0) {
      agg.status = 'pass';
    } else {
      agg.status = 'manual';
    }
  }

  const criteria = [...criteriaMap.values()];

  // Counts
  let violations = 0;
  let passes = 0;
  let manual = 0;
  let incomplete = 0;

  for (const c of criteria) {
    switch (c.status) {
      case 'violation': violations++; break;
      case 'pass': passes++; break;
      case 'manual': manual++; break;
      case 'incomplete': incomplete++; break;
    }
  }

  // Top 5 issues — criteria with most pages violating
  const topIssues: TopIssue[] = criteria
    .filter((c) => c.pagesViolating.length > 0)
    .sort((a, b) => b.pagesViolating.length - a.pagesViolating.length)
    .slice(0, 5)
    .map((c) => ({
      rgaaId: c.rgaaId,
      title: c.title,
      pagesAffected: c.pagesViolating.length,
    }));

  return {
    totalCriteria: criteria.length,
    automated: criteria.filter((c) => c.status !== 'manual').length,
    violations,
    passes,
    manual,
    incomplete,
    topIssues,
    criteria,
    coverage: summarizeCoverage(mapping.criteria),
  };
}

function detectDuplicateLabels(
  mappedPages: MappedPage[],
  allCollectedData: Array<{ url: string; collectedData: CollectedData | null }>,
): void {
  // Group all links by accessible label across all pages
  const labelMap = new Map<string, Set<string>>();

  for (const { collectedData } of allCollectedData) {
    if (!collectedData) continue;
    for (const link of collectedData.links) {
      if (!link.accessibleLabel || link.accessibleLabel.trim() === '') continue;
      const normalized = link.accessibleLabel.toLowerCase().trim();
      if (!labelMap.has(normalized)) {
        labelMap.set(normalized, new Set());
      }
      if (link.href) {
        labelMap.get(normalized)!.add(link.href);
      }
    }
  }

  // Find labels pointing to multiple different URLs
  const duplicateLabels = new Set<string>();
  for (const [label, urls] of labelMap) {
    if (urls.size > 1) {
      duplicateLabels.add(label);
    }
  }

  if (duplicateLabels.size === 0) return;

  // Update criterion 6.1 in all mapped pages
  for (const page of mappedPages) {
    const criterion61 = page.criteria.find((c) => c.rgaaId === '6.1');
    if (!criterion61) continue;

    const pageData = allCollectedData.find((d) => d.url === page.url);
    if (!pageData?.collectedData) continue;

    for (const link of pageData.collectedData.links) {
      if (!link.accessibleLabel) continue;
      const normalized = link.accessibleLabel.toLowerCase().trim();
      if (duplicateLabels.has(normalized)) {
        // Add DUPLICATE_LABEL flag to the elements in this criterion
        const existingEl = criterion61.elements.find((e) => e.selector === link.selector);
        if (existingEl) {
          if (!existingEl.flags.includes('DUPLICATE_LABEL')) {
            existingEl.flags.push('DUPLICATE_LABEL');
          }
        } else {
          criterion61.elements.push({ selector: link.selector, flags: ['DUPLICATE_LABEL'] });
        }

        // If criterion was pass, upgrade to violation
        if (criterion61.status === 'pass') {
          criterion61.status = 'violation';
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// buildReport
// ---------------------------------------------------------------------------

export function buildReport(
  summary: AuditReportSummary,
  config: AuditConfig,
  collectedDataList?: Array<{ url: string; observedAt?: string; stepId?: string; collectedData: CollectedData | null }>,
): Report {
  const mapping = loadMapping();

  // Load locale (RÈGLE 4)
  const localePath = resolve(__dirname, '../locales/fr.json');
  const locale = JSON.parse(readFileSync(localePath, 'utf-8'));

  // Detect overlays — placeholder for now, populated by server layer
  const overlaysDetected: string[] = [];

  // Limit banner from locale
  // Le registre contient les 106 critères, mais seuls les critères du lot 0
  // sont réellement intégrés au parcours actuel.
  const coveredCriteria = mapping.criteria.filter((criterion) => criterion.implementationLot === 0).length;
  const coverage = summarizeCoverage(mapping.criteria);
  const limitBanner = locale.report.limitBanner
    .replace('{covered}', String(coveredCriteria))
    .replace('{total}', String(mapping.totalCriteria))
    .replace('{remaining}', String(mapping.totalCriteria - coveredCriteria));

  return {
    metadata: {
      url: config.url,
      date: config.date,
      version: config.version,
      pagesAudited: config.pagesAudited,
      coveredThemes: mapping.coveredThemes,
      totalRgaaCriteria: mapping.totalCriteria,
      coveredCriteria,
    },
    limitBanner,
    coverage,
    overlaysDetected,
    summary,
    uncoveredThemes: mapping.uncoveredThemes,
    comparisons: collectedDataList ? compareCollectedData(collectedDataList) : [],
  };
}
