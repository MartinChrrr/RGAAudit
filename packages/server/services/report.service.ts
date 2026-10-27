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
import { compareCollectedData, type PageComparison } from '@rgaaudit/core/report/comparison';
import { JOURNEY_REPORT_ANNEX_SCHEMA_VERSION, type JourneyReportAnnex, type JourneyRunState } from '../../core/journey/journey';
import { runReportExtractor, type ReportExtractor } from '@rgaaudit/core/report/extractors';
import type { HeuristicFinding } from '@rgaaudit/core/analyzer/heuristics/heuristic.interface';
import {
  aggregateHumanStatus,
  coverageStatusesForCriterion,
  machineStatusFromLegacyStatus,
  type AuditDecision,
  type AuditReviewState,
  type CoverageStatus,
  type HumanStatus,
  type ImageAuditDecision,
  type MachineStatus,
} from '@rgaaudit/core/domain/review';
import { pageIdForUrl, redactStructuredText, redactTextUrls, redactUrl } from '../security/url.redaction';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf-8'));
const APP_VERSION: string = pkg.version;

/** Redact absolute and relative URLs embedded in journey observation details. */
function redactJourneyUrlDetails(value: string): string {
  return redactTextUrls(value).replace(/\b(url|href)=([^;\s]+)/gi, (_match, key: string, candidate: string) => (
    `${key}=${redactUrl(candidate)}`
  ));
}

export interface ContrastViolationItem {
  pageUrl: string;
  pageId?: string;
  rgaaId: string;
  selector: string;
  contrastRatio: string;
  expectedContrastRatio: string;
  fgColor: string;
  bgColor: string;
}

export interface ReportExtractorRunMetadata {
  schemaVersion: number;
  extractorId: string;
  extractorVersion: number;
  itemCount: number;
  truncated: boolean;
}

export interface ReportData {
  report: ReturnType<typeof buildReport>;
  mappedPages: MappedPage[];
  allCollected: Array<{
    observationId?: string;
    order?: number;
    url: string;
    observedAt?: string;
    comparisonGroup?: string;
    stepId?: string;
    pageId?: string;
    collectedData: CollectedData | null;
  }>;
  contrastViolations: ContrastViolationItem[];
  extractorRuns: ReportExtractorRunMetadata[];
  heuristicFindings: Array<HeuristicFinding & {
    heuristicId: string;
    rgaaCriteria: string[];
    pageUrl: string;
  }>;
  review: ReviewData;
  journeyAnnex: JourneyReportAnnex;
}

export interface ReviewCriterion {
  rgaaId: string;
  title: string;
  theme: string;
  coverage: CriterionCoverage;
  humanLevel: HumanLevel;
  implementationLot: ImplementationLot;
  coverageStatuses: CoverageStatus[];
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
  pageId?: string;
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
  pages: Array<{ url: string; pageId?: string; criteria: ReviewCriterion[] }>;
  criteria: Array<{
    rgaaId: string;
    coverageStatuses: CoverageStatus[];
    machineStatus: MachineStatus;
    humanStatus: HumanStatus;
  }>;
  imageDecisions: ImageAuditDecision[];
  decisionHistory: AuditDecision[];
  imageDecisionHistory: ImageAuditDecision[];
}

/**
 * Converts an internal report to the representation safe for API responses and
 * generated exports. The session and review files keep the original URLs so
 * that query parameters remain available for exact page identity and replay.
 */
export function toPublicComparisons(comparisons: PageComparison[], sessionId: string): PageComparison[] {
  const publicPageId = (url: string) => pageIdForUrl(sessionId, url);
  const publicSnapshot = (snapshot: PageComparison['before']) => ({
    url: redactUrl(snapshot.url),
    pageId: publicPageId(snapshot.url),
    observedAt: snapshot.observedAt,
    ...(snapshot.stepId ? { stepId: snapshot.stepId } : {}),
    available: snapshot.available,
    selectors: snapshot.selectors.map(redactTextUrls),
  });
  return comparisons.map((comparison) => ({
    before: publicSnapshot(comparison.before),
    after: publicSnapshot(comparison.after),
    added: comparison.added.map(redactTextUrls),
    removed: comparison.removed.map(redactTextUrls),
    ...(comparison.updated ? { updated: comparison.updated.map((change) => ({ key: redactTextUrls(change.key), fields: change.fields })) } : {}),
    changed: comparison.changed,
  }));
}

/** Serialize a journey run for a public route or a report annex. */
export function toPublicJourneyRun(run: JourneyRunState, publicSessionId = run.sessionId ?? run.runId): JourneyRunState {
  if (!run.run) return run.error ? { ...run, error: redactTextUrls(run.error) } : run;

  return {
    ...run,
    ...(run.error ? { error: redactTextUrls(run.error) } : {}),
    run: {
      ...run.run,
      comparisons: toPublicComparisons(compareCollectedData(run.run.steps.map((step, order) => ({
        observationId: `${run.runId}-${order}`,
        order,
        url: step.url,
        observedAt: step.observedAt,
        comparisonGroup: run.runId,
        stepId: step.stepId,
        collectedData: step.result?.collectedData ?? null,
      }))), publicSessionId),
      steps: run.run.steps.map((step) => {
        const { screenshotPath: _screenshotPath, ...stepWithoutScreenshotPath } = step;
        const publicObservation = {
          ...stepWithoutScreenshotPath,
          url: redactUrl(step.url),
          title: redactTextUrls(step.title),
          evidence: step.evidence.map((evidence) => ({
            ...evidence,
            selector: redactTextUrls(evidence.selector),
            html: redactTextUrls(evidence.html),
            context: evidence.context ? redactTextUrls(evidence.context) : evidence.context,
          })),
          ...(step.keyboard ? {
            keyboard: {
              ...step.keyboard,
              componentSelector: redactTextUrls(step.keyboard.componentSelector),
              before: step.keyboard.before ? {
                ...step.keyboard.before,
                selector: redactTextUrls(step.keyboard.before.selector),
                text: step.keyboard.before.text ? redactTextUrls(step.keyboard.before.text) : step.keyboard.before.text,
              } : null,
              after: step.keyboard.after ? {
                ...step.keyboard.after,
                selector: redactTextUrls(step.keyboard.after.selector),
                text: step.keyboard.after.text ? redactTextUrls(step.keyboard.after.text) : step.keyboard.after.text,
              } : null,
            },
          } : {}),
          ...(step.context ? {
            context: {
              ...step.context,
              trigger: {
                ...step.context.trigger,
                selector: step.context.trigger.selector ? redactTextUrls(step.context.trigger.selector) : step.context.trigger.selector,
              },
              urlBefore: redactUrl(step.context.urlBefore),
              urlAfter: redactUrl(step.context.urlAfter),
              titleBefore: redactTextUrls(step.context.titleBefore),
              titleAfter: redactTextUrls(step.context.titleAfter),
              disruptions: step.context.disruptions.map((disruption) => ({
                ...disruption,
                selector: redactTextUrls(disruption.selector),
                detail: redactTextUrls(disruption.detail),
              })),
              disclosures: (step.context.disclosures ?? []).map((disclosure) => ({
                ...disclosure,
                selector: redactTextUrls(disclosure.selector),
                detail: redactTextUrls(disclosure.detail),
              })),
              additionalContent: (step.context.additionalContent ?? []).map((item) => ({
                ...item,
                selector: redactTextUrls(item.selector),
                detail: redactTextUrls(item.detail),
              })),
              timeLimits: (step.context.timeLimits ?? []).map((item) => ({
                ...item,
                selector: redactTextUrls(item.selector),
                detail: redactJourneyUrlDetails(item.detail),
              })),
              newWindows: (step.context.newWindows ?? []).map((item) => ({
                ...item,
                selector: redactTextUrls(item.selector),
                detail: redactJourneyUrlDetails(item.detail),
              })),
              crypticContent: (step.context.crypticContent ?? []).map((item) => ({
                ...item,
                selector: redactTextUrls(item.selector),
                content: redactTextUrls(item.content),
                alternative: item.alternative ? redactTextUrls(item.alternative) : item.alternative,
                detail: redactTextUrls(item.detail),
              })),
              scriptAlternatives: (step.context.scriptAlternatives ?? []).map((item) => ({
                ...item,
                selector: redactTextUrls(item.selector),
                alternativeSelector: item.alternativeSelector ? redactTextUrls(item.alternativeSelector) : item.alternativeSelector,
                alternative: item.alternative ? redactTextUrls(item.alternative) : item.alternative,
                detail: redactTextUrls(item.detail),
              })),
              scriptControls: (step.context.scriptControls ?? []).map((item) => ({
                ...item,
                selector: redactTextUrls(item.selector),
                pointerEvents: [...item.pointerEvents],
                keyboardEvents: [...item.keyboardEvents],
                detail: redactTextUrls(item.detail),
              })),
              interactions: (step.context.interactions ?? []).map((interaction) => ({
                ...interaction,
                selector: redactTextUrls(interaction.selector),
                detail: redactTextUrls(interaction.detail),
              })),
            },
          } : {}),
          ...(step.result ? {
            result: {
              ...step.result,
              url: redactUrl(step.result.url),
              error: step.result.error ? redactTextUrls(step.result.error) : step.result.error,
              axeResults: redactStructuredText(step.result.axeResults) as typeof step.result.axeResults,
              heuristicResults: redactStructuredText(step.result.heuristicResults) as typeof step.result.heuristicResults,
              collectedData: redactCollectedData(step.result.collectedData),
            },
          } : {}),
          ...(step.error ? { error: redactTextUrls(step.error) } : {}),
        };
        if (!step.screenshotPath) return publicObservation;
        const filename = step.screenshotPath.split(/[\\/]/).pop() ?? '';
        const expectedSuffix = `journeys/${run.runId}/screenshots/${filename}`;
        if (!/^[a-zA-Z0-9_-]{1,128}\.png$/.test(filename)
          || !step.screenshotPath.replaceAll('\\', '/').endsWith(expectedSuffix)) {
          return { ...publicObservation, screenshotSkippedReason: 'capture_error' as const };
        }
        return {
          ...publicObservation,
          screenshotUrl: `/api/journey-runs/${run.runId}/screenshots/${encodeURIComponent(filename)}`,
        };
      }),
      decisions: run.run.decisions?.map((decision) => ({
        ...decision,
        comment: redactTextUrls(decision.comment),
      })),
      decisionHistory: run.run.decisionHistory?.map((decision) => ({
        ...decision,
        comment: redactTextUrls(decision.comment),
      })),
    },
  };
}

export function toPublicReportData(data: ReportData, sessionId: string): ReportData {
  const publicPageId = (url: string) => pageIdForUrl(sessionId, url);
  const publicReport = {
    ...data.report,
    metadata: {
      ...data.report.metadata,
      url: redactUrl(data.report.metadata.url),
    },
    summary: {
      ...data.report.summary,
      criteria: data.report.summary.criteria.map((criterion) => ({
        ...criterion,
        pagesViolating: (criterion.pagesViolating ?? []).map(redactUrl),
        pagesPass: (criterion.pagesPass ?? []).map(redactUrl),
        pagesManual: (criterion.pagesManual ?? []).map(redactUrl),
        pagesIncomplete: (criterion.pagesIncomplete ?? []).map(redactUrl),
      })),
    },
    comparisons: data.report.comparisons ? toPublicComparisons(data.report.comparisons, sessionId) : undefined,
  };

  return {
    ...data,
    report: publicReport,
    // Mapped pages are an internal aggregation detail and are not part of
    // any public response. Keeping them empty also prevents raw URLs from
    // leaking through a future spread of this object.
    mappedPages: [],
    allCollected: data.allCollected.map((entry) => ({
      url: redactUrl(entry.url),
      ...(entry.observedAt ? { observedAt: entry.observedAt } : {}),
      pageId: publicPageId(entry.url),
      collectedData: redactCollectedData(entry.collectedData),
    })),
    contrastViolations: data.contrastViolations.map((item) => ({
      ...item,
      pageId: publicPageId(item.pageUrl),
      pageUrl: redactUrl(item.pageUrl),
    })),
    heuristicFindings: data.heuristicFindings.map((finding) => ({
      ...finding,
      pageId: publicPageId(finding.pageUrl),
      pageUrl: redactUrl(finding.pageUrl),
      selector: redactTextUrls(finding.selector),
      html: redactTextUrls(finding.html),
      evidence: redactTextUrls(finding.evidence),
      context: redactTextUrls(finding.context),
    })),
    review: toPublicReviewData(data.review, sessionId),
    journeyAnnex: {
      ...data.journeyAnnex,
      runs: data.journeyAnnex.runs.map((run) => toPublicJourneyRun(run, sessionId)),
    },
  };
}

export function redactCollectedData(collectedData: CollectedData | null): CollectedData | null {
  if (!collectedData) return null;
  return {
    ...collectedData,
    images: (collectedData.images ?? []).map((image) => ({
      ...image,
      // Screenshot paths are server-internal filesystem locations. Public
      // consumers must never receive them; previews fall back to the
      // redacted resource URL instead.
      screenshotPath: null,
      src: redactUrl(image.src),
      linkHref: image.linkHref ? redactUrl(image.linkHref) : image.linkHref,
      altAttribute: image.altAttribute ? redactTextUrls(image.altAttribute) : image.altAttribute,
      ariaLabel: image.ariaLabel ? redactTextUrls(image.ariaLabel) : image.ariaLabel,
      ariaLabelledby: image.ariaLabelledby ? redactTextUrls(image.ariaLabelledby) : image.ariaLabelledby,
      surroundingText: redactTextUrls(image.surroundingText),
      parentFigcaption: image.parentFigcaption ? redactTextUrls(image.parentFigcaption) : image.parentFigcaption,
      linkText: image.linkText ? redactTextUrls(image.linkText) : image.linkText,
      detailedDescription: image.detailedDescription
        ? image.detailedDescriptionSource === 'longdesc'
          ? redactUrl(image.detailedDescription)
          : redactTextUrls(image.detailedDescription)
        : image.detailedDescription,
      evidence: image.evidence?.map((evidence) => ({
        ...evidence,
        proof: evidence.proof.map(redactTextUrls),
        limits: evidence.limits.map(redactTextUrls),
        humanChecks: evidence.humanChecks?.map(redactTextUrls),
      })),
    })),
    media: collectedData.media?.map((media) => ({
      ...media,
      sources: media.sources.map(redactUrl),
      tracks: media.tracks.map((track) => ({ ...track, src: track.src ? redactUrl(track.src) : track.src })),
      accessibleName: media.accessibleName ? redactTextUrls(media.accessibleName) : media.accessibleName,
      fallbackText: media.fallbackText ? redactTextUrls(media.fallbackText) : media.fallbackText,
      surroundingText: redactTextUrls(media.surroundingText),
      evidence: media.evidence?.map((evidence) => ({
        ...evidence,
        proof: evidence.proof.map(redactTextUrls),
        limits: evidence.limits.map(redactTextUrls),
        humanChecks: evidence.humanChecks?.map(redactTextUrls),
      })),
    })),
    specializedContent: collectedData.specializedContent?.map((item) => ({
      ...item,
      source: item.source ? redactUrl(item.source) : item.source,
      label: item.label ? redactTextUrls(item.label) : item.label,
      context: redactTextUrls(item.context),
      evidence: item.evidence.map(redactTextUrls),
      documentEvidence: item.documentEvidence ? {
        ...item.documentEvidence,
        proof: item.documentEvidence.proof.map(redactTextUrls),
        limits: item.documentEvidence.limits.map(redactTextUrls),
        humanChecks: item.documentEvidence.humanChecks.map(redactTextUrls),
      } : item.documentEvidence,
    })),
    frames: (collectedData.frames ?? []).map((frame) => ({
      ...frame,
      src: frame.src ? redactUrl(frame.src) : frame.src,
      sourceUrl: frame.sourceUrl ? redactUrl(frame.sourceUrl) : frame.sourceUrl,
      origin: frame.origin ? redactUrl(frame.origin) : frame.origin,
      titleAttribute: frame.titleAttribute ? redactTextUrls(frame.titleAttribute) : frame.titleAttribute,
      titleEvidence: frame.titleEvidence ? {
        ...frame.titleEvidence,
        proof: frame.titleEvidence.proof.map(redactTextUrls),
        limits: frame.titleEvidence.limits.map(redactTextUrls),
        humanChecks: frame.titleEvidence.humanChecks.map(redactTextUrls),
      } : frame.titleEvidence,
    })),
    links: (collectedData.links ?? []).map((link) => ({
      ...link,
      href: link.href ? redactUrl(link.href) : link.href,
      accessibleLabel: link.accessibleLabel ? redactTextUrls(link.accessibleLabel) : link.accessibleLabel,
    })),
    headings: collectedData.headings ? {
      ...collectedData.headings,
      documentTitle: redactTextUrls(collectedData.headings.documentTitle),
      headings: collectedData.headings.headings.map((heading) => ({ ...heading, text: redactTextUrls(heading.text) })),
    } : collectedData.headings,
    structure: collectedData.structure ? {
      ...collectedData.structure,
      tables: collectedData.structure.tables.map((table) => ({
        ...table,
        selector: redactTextUrls(table.selector),
        dataFeatures: table.dataFeatures.map(redactTextUrls),
        flags: table.flags.map(redactTextUrls),
        complexitySignals: table.complexitySignals?.map(redactTextUrls),
        captionText: table.captionText ? redactTextUrls(table.captionText) : table.captionText,
        summaryText: table.summaryText ? redactTextUrls(table.summaryText) : table.summaryText,
        linearizedText: table.linearizedText ? redactTextUrls(table.linearizedText) : table.linearizedText,
      })),
    } : collectedData.structure,
    figcaptions: collectedData.figcaptions?.map((caption) => ({
      ...caption,
      text: redactTextUrls(caption.text),
    })),
    forms: collectedData.forms?.map((form) => ({
      ...form,
      selector: redactTextUrls(form.selector),
      action: form.action ? redactUrl(form.action) : form.action,
      flags: form.flags.map(redactTextUrls),
      controls: form.controls.map((control) => ({
        ...control,
        selector: redactTextUrls(control.selector),
        label: control.label ? redactTextUrls(control.label) : control.label,
        labelSelector: control.labelSelector ? redactTextUrls(control.labelSelector) : control.labelSelector,
        groupSelector: control.groupSelector ? redactTextUrls(control.groupSelector) : control.groupSelector,
        groupLegend: control.groupLegend ? redactTextUrls(control.groupLegend) : control.groupLegend,
        helpText: control.helpText ? redactTextUrls(control.helpText) : control.helpText,
        errorMessage: control.errorMessage ? redactTextUrls(control.errorMessage) : control.errorMessage,
        validationMessage: control.validationMessage ? redactTextUrls(control.validationMessage) : control.validationMessage,
        flags: control.flags.map(redactTextUrls),
        optionGroups: control.optionGroups?.map((group) => ({
          ...group,
          selector: redactTextUrls(group.selector),
          label: group.label ? redactTextUrls(group.label) : group.label,
          flags: group.flags.map(redactTextUrls),
        })),
      })),
      groups: form.groups?.map((group) => ({
        ...group,
        selector: redactTextUrls(group.selector),
        legend: group.legend ? redactTextUrls(group.legend) : group.legend,
        controlSelectors: group.controlSelectors.map(redactTextUrls),
        flags: group.flags.map(redactTextUrls),
      })),
      submitControls: form.submitControls?.map(redactTextUrls),
      sensitiveControlSelectors: form.sensitiveControlSelectors?.map(redactTextUrls),
    })),
    presentation: collectedData.presentation ? {
      ...collectedData.presentation,
      snapshots: collectedData.presentation.snapshots.map((snapshot) => ({
        ...snapshot,
        note: snapshot.note ? redactTextUrls(snapshot.note) : snapshot.note,
        focusObservations: snapshot.focusObservations?.map((focus) => ({
          ...focus,
          selector: redactTextUrls(focus.selector),
          text: focus.text ? redactTextUrls(focus.text) : focus.text,
        })),
      })),
      perceptualCues: collectedData.presentation.perceptualCues?.map((cue) => ({
        ...cue,
        selector: redactTextUrls(cue.selector),
        text: cue.text ? redactTextUrls(cue.text) : cue.text,
        accessibleName: cue.accessibleName ? redactTextUrls(cue.accessibleName) : cue.accessibleName,
      })),
    } : collectedData.presentation,
    navigation: collectedData.navigation ? {
      ...collectedData.navigation,
      systems: collectedData.navigation.systems.map((system) => ({
        ...system,
        selector: redactTextUrls(system.selector),
        label: system.label ? redactTextUrls(system.label) : system.label,
        href: system.href ? redactUrl(system.href) : system.href,
      })),
      manualChecks: collectedData.navigation.manualChecks.map(redactTextUrls),
    } : collectedData.navigation,
  };
}

export function toPublicReviewData(review: ReviewData, sessionId: string): ReviewData {
  const publicPageId = (url: string) => pageIdForUrl(sessionId, url);
  return {
    ...review,
    pages: review.pages.map((page) => ({
      ...page,
      pageId: publicPageId(page.url),
      url: redactUrl(page.url),
      criteria: page.criteria.map((criterion) => ({
        ...criterion,
        comment: redactTextUrls(criterion.comment),
        elements: criterion.elements.map((element) => ({
          ...element,
          selector: redactTextUrls(element.selector),
        })),
        evidence: criterion.evidence.map((evidence) => ({
          ...evidence,
          proofId: `proof-${publicPageId(evidence.pageUrl)}-${evidence.criterionId}-${evidence.kind}-${evidence.elementIndex ?? 0}`,
          resultId: `result-${publicPageId(evidence.pageUrl)}-${evidence.criterionId}-${evidence.kind}-${evidence.rule}`,
          pageId: publicPageId(evidence.pageUrl),
          pageUrl: redactUrl(evidence.pageUrl),
          description: redactTextUrls(evidence.description),
          selector: redactTextUrls(evidence.selector),
          target: evidence.target.map(redactTextUrls),
          html: redactTextUrls(evidence.html),
          context: evidence.context ? redactTextUrls(evidence.context) : evidence.context,
        })),
      })),
    })),
    imageDecisions: (review.imageDecisions ?? []).map((decision) => ({
      ...decision,
      pageId: publicPageId(decision.pageUrl),
      pageUrl: redactUrl(decision.pageUrl),
      notes: redactTextUrls(decision.notes),
      correctedAlt: redactTextUrls(decision.correctedAlt),
    })),
    decisionHistory: (review.decisionHistory ?? []).map((decision) => ({
      ...decision,
      pageId: publicPageId(decision.pageUrl),
      pageUrl: redactUrl(decision.pageUrl),
      comment: redactTextUrls(decision.comment),
    })),
    imageDecisionHistory: (review.imageDecisionHistory ?? []).map((decision) => ({
      ...decision,
      pageId: publicPageId(decision.pageUrl),
      pageUrl: redactUrl(decision.pageUrl),
      notes: redactTextUrls(decision.notes),
      correctedAlt: redactTextUrls(decision.correctedAlt),
    })),
  };
}

export function buildReportFromSession(
  session: SessionState,
  reviewState?: AuditReviewState,
  journeyRuns: JourneyRunState[] = [],
): ReportData {
  const mappedPages = Object.values(session.results)
    .filter((r) => !r.error)
    .map((r) => mapPageResults(r.axeResults, r.collectedData, r.url, r.heuristicResults));

  const allCollected = Object.values(session.results)
    .filter((r) => !r.error)
    .map((r, order) => ({
      observationId: `${session.sessionId}-legacy-${order}`,
      order,
      url: r.url,
      observedAt: r.auditedAt,
      collectedData: r.collectedData,
    }));

  const observations = session.observations && session.observations.length > 0
    ? session.observations
    : allCollected;

  const summary = aggregateResults(mappedPages, observations);

  const firstUrl = session.completedPages[0] ?? '';
  const report = buildReport(summary, {
    url: firstUrl,
    date: session.startedAt,
    pagesAudited: session.completedPages.length,
    version: APP_VERSION,
  }, observations);

  const contrastRun = runReportExtractor(CONTRAST_EXTRACTOR, mappedPages);
  const contrastViolations = contrastRun.items;
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

  return {
    report,
    mappedPages,
    allCollected: observations,
    contrastViolations,
    extractorRuns: [{
      schemaVersion: contrastRun.schemaVersion,
      extractorId: contrastRun.extractorId,
      extractorVersion: contrastRun.extractorVersion,
      itemCount: contrastRun.items.length,
      truncated: contrastRun.truncated,
    }],
    heuristicFindings,
    review,
    journeyAnnex: {
      schemaVersion: JOURNEY_REPORT_ANNEX_SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
      sessionId: session.sessionId,
      // Copy the run envelopes so the report annex is a point-in-time
      // snapshot even if a later review updates the persisted run.
      runs: journeyRuns.map((run) => structuredClone(run)),
    },
  };
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
      const mappingCriterion = getCriterion(criterion.rgaaId);
      return {
        rgaaId: criterion.rgaaId,
        title: criterion.title,
        theme: criterion.theme,
        coverage: criterion.coverage,
        humanLevel: criterion.humanLevel,
        implementationLot: criterion.implementationLot,
        coverageStatuses: coverageStatusesForCriterion({
          implementationLot: criterion.implementationLot,
          coverage: criterion.coverage,
          humanStatus: decision?.status ?? 'not_tested',
          machineSignal: (mappingCriterion?.axeRules.length ?? 0) > 0
            || (mappingCriterion?.dataCollectorFlags.length ?? 0) > 0,
        }),
        wcag: mappingCriterion?.wcag ?? [],
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
      const humanStatus = aggregateHumanStatus(pageCriteria.map((criterion) => criterion.humanStatus));
      const mappingCriterion = getCriterion(rgaaId);
      return {
        rgaaId,
        coverageStatuses: mappingCriterion
          ? coverageStatusesForCriterion({
            implementationLot: mappingCriterion.implementationLot,
            coverage: mappingCriterion.coverage,
            humanStatus,
            machineSignal: mappingCriterion.axeRules.length > 0 || mappingCriterion.dataCollectorFlags.length > 0,
          })
          : ['not_tested'],
        machineStatus,
        humanStatus,
      };
    }),
    imageDecisions: state?.imageDecisions ?? [],
    decisionHistory: state?.decisionHistory ?? [],
    imageDecisionHistory: state?.imageDecisionHistory ?? [],
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

const CONTRAST_EXTRACTOR: ReportExtractor<MappedPage[], ContrastViolationItem> = {
  id: 'contrast-violations',
  version: 1,
  maxItems: 2_000,
  extract: (mappedPages) => collectContrastViolations(mappedPages),
};

export function extractContrastViolations(mappedPages: MappedPage[]): ContrastViolationItem[] {
  return runReportExtractor(CONTRAST_EXTRACTOR, mappedPages).items;
}

function collectContrastViolations(mappedPages: MappedPage[]): ContrastViolationItem[] {
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
