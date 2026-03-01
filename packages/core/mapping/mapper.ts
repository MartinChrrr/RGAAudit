import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { EngineResult, AxeViolation, AxeIncomplete } from '../engines/engine.interface';
import type { AnalyzeResult } from '../engines';
import type { CollectedData } from '../analyzer/data-collector';
import type { RgaaCriterion, RgaaMapping } from './index';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CriterionStatus = 'violation' | 'pass' | 'manual' | 'incomplete';

export interface MappedCriterion {
  rgaaId: string;
  title: string;
  theme: string;
  status: CriterionStatus;
  violations: AxeViolation[];
  incompletes: AxeIncomplete[];
  elements: Array<{ selector: string; flags: string[] }>;
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
  status: CriterionStatus;
  pagesViolating: string[];
  pagesPass: string[];
  pagesManual: string[];
  pagesIncomplete: string[];
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
  overlaysDetected: string[];
  summary: AuditReportSummary;
  uncoveredThemes: Array<{
    id: string;
    name: string;
    manualChecklist: string[];
  }>;
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
): MappedPage {
  const mapping = loadMapping();
  const criteria: MappedCriterion[] = [];

  for (const criterion of mapping.criteria) {
    const mapped = mapCriterion(criterion, axeResults, collectedData);
    criteria.push(mapped);
  }

  return { url, criteria };
}

function mapCriterion(
  criterion: RgaaCriterion,
  axeResults: AnalyzeResult | null,
  collectedData: CollectedData | null,
): MappedCriterion {
  const base: Omit<MappedCriterion, 'status' | 'violations' | 'incompletes' | 'elements'> = {
    rgaaId: criterion.rgaa.id,
    title: criterion.rgaa.title,
    theme: criterion.rgaa.theme,
    notes: criterion.limits,
    manualChecks: criterion.dataCollectorFlags,
  };

  // MANUAL_ONLY — always manual regardless of axeResults
  if (criterion.evaluationStrategy === 'MANUAL_ONLY') {
    const elements = extractElements(criterion, collectedData);
    return { ...base, status: 'manual', violations: [], incompletes: [], elements };
  }

  // If no axe results (error page), return manual
  if (!axeResults || axeResults.error) {
    const elements = extractElements(criterion, collectedData);
    return { ...base, status: 'manual', violations: [], incompletes: [], elements };
  }

  const engineResult = axeResults as EngineResult;
  const elements = extractElements(criterion, collectedData);

  if (criterion.evaluationStrategy === 'ANY_VIOLATION') {
    return mapAnyViolation(criterion, engineResult, elements, base);
  }

  if (criterion.evaluationStrategy === 'ALL_PASS') {
    return mapAllPass(criterion, engineResult, elements, base);
  }

  // Unknown strategy — fallback to manual
  return { ...base, status: 'manual', violations: [], incompletes: [], elements };
}

function mapAnyViolation(
  criterion: RgaaCriterion,
  result: EngineResult,
  elements: Array<{ selector: string; flags: string[] }>,
  base: Omit<MappedCriterion, 'status' | 'violations' | 'incompletes' | 'elements'>,
): MappedCriterion {
  const violations = result.violations.filter((v) => criterion.axeRules.includes(v.rule));
  const incompletes = result.incomplete.filter((i) => criterion.axeRules.includes(i.rule));

  let status: CriterionStatus;
  if (violations.length > 0) {
    status = 'violation';
  } else if (incompletes.length > 0) {
    status = 'incomplete';
  } else {
    status = 'pass';
  }

  return { ...base, status, violations, incompletes, elements };
}

function mapAllPass(
  criterion: RgaaCriterion,
  result: EngineResult,
  elements: Array<{ selector: string; flags: string[] }>,
  base: Omit<MappedCriterion, 'status' | 'violations' | 'incompletes' | 'elements'>,
): MappedCriterion {
  const violations = result.violations.filter((v) => criterion.axeRules.includes(v.rule));
  const incompletes = result.incomplete.filter((i) => criterion.axeRules.includes(i.rule));

  if (violations.length > 0) {
    return { ...base, status: 'violation', violations, incompletes, elements };
  }

  // ALL_PASS: pass only if ALL rules are in passes
  const passedRules = new Set(result.passes.map((p) => p.rule));
  const allPass = criterion.axeRules.every((rule) => passedRules.has(rule));

  if (allPass) {
    return { ...base, status: 'pass', violations: [], incompletes, elements };
  }

  return { ...base, status: 'incomplete', violations: [], incompletes, elements };
}

function extractElements(
  criterion: RgaaCriterion,
  collectedData: CollectedData | null,
): Array<{ selector: string; flags: string[] }> {
  if (!collectedData) return [];

  const elements: Array<{ selector: string; flags: string[] }> = [];
  const relevantFlags = new Set(criterion.dataCollectorFlags);

  // Images
  for (const img of collectedData.images) {
    const matchingFlags = img.flags.filter((f) => relevantFlags.has(f));
    if (matchingFlags.length > 0) {
      elements.push({ selector: img.selector, flags: matchingFlags });
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

  // Initialize from mapping
  for (const criterion of mapping.criteria) {
    criteriaMap.set(criterion.rgaa.id, {
      rgaaId: criterion.rgaa.id,
      title: criterion.rgaa.title,
      theme: criterion.rgaa.theme,
      status: 'pass',
      pagesViolating: [],
      pagesPass: [],
      pagesManual: [],
      pagesIncomplete: [],
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

  // Detect DUPLICATE_LABEL cross-pages
  if (allCollectedData) {
    detectDuplicateLabels(mappedPages, allCollectedData);
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
  _collectedDataList?: Array<{ url: string; collectedData: CollectedData | null }>,
): Report {
  const mapping = loadMapping();

  // Load locale (RÈGLE 4)
  const localePath = resolve(__dirname, '../locales/fr.json');
  const locale = JSON.parse(readFileSync(localePath, 'utf-8'));

  // Detect overlays — placeholder for now, populated by server layer
  const overlaysDetected: string[] = [];

  // Limit banner from locale
  const coveredCriteria = mapping.criteria.length;
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
    overlaysDetected,
    summary,
    uncoveredThemes: mapping.uncoveredThemes,
  };
}
