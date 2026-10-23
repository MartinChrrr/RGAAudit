import type { CriterionCoverage } from '../mapping';

export const REVIEW_SCHEMA_VERSION = 1 as const;

/** A machine signal is evidence for the auditor, never the final verdict. */
export type MachineStatus =
  | 'probable_issue'
  | 'needs_review'
  | 'no_issue_detected';

/** Only a human reviewer can set an RGAA decision. */
export type HumanStatus =
  | 'not_tested'
  | 'compliant'
  | 'non_compliant'
  | 'not_applicable';

/** Lifecycle facts displayed alongside machine and human decisions. */
export type CoverageStatus =
  | 'planned'
  | 'integrated'
  | 'machine_signal'
  | 'human_validated'
  | 'not_tested';

export interface CoverageStatusInput {
  implementationLot: number;
  coverage: CriterionCoverage;
  humanStatus: HumanStatus;
  machineSignal: boolean;
}

export interface AuditDecision {
  pageUrl: string;
  criterionId: string;
  status: HumanStatus;
  comment: string;
  reviewedAt: string | null;
  /** Identifies decisions explicitly entered on a criterion versus an annex summary. */
  source?: 'criterion' | 'annex_images';
}

export type ImageClassification = 'decorative' | 'informative' | 'violation' | null;

export interface ImageAuditDecision {
  pageUrl: string;
  selector: string;
  /** Stable position in the collected page, used when CSS selectors are duplicated. */
  elementIndex?: number;
  decision: ImageClassification;
  status: HumanStatus;
  correctedAlt: string;
  notes: string;
  reviewedAt: string | null;
}

export interface AuditReviewState {
  schemaVersion: typeof REVIEW_SCHEMA_VERSION;
  sessionId: string;
  decisions: AuditDecision[];
  /** Previous criterion decisions, retained when the current decision is revised. */
  decisionHistory?: AuditDecision[];
  imageDecisions: ImageAuditDecision[];
  /** Previous annex image decisions, retained for the same audit trail guarantee. */
  imageDecisionHistory?: ImageAuditDecision[];
  updatedAt: string;
}

/**
 * Derive lifecycle badges without collapsing them into a single verdict.
 *
 * A criterion can be integrated and provide a machine signal while still
 * requiring a human decision. Planned criteria are deliberately kept out of
 * the machine-signal state until their implementation lot is delivered.
 */
export function coverageStatusesForCriterion(input: CoverageStatusInput): CoverageStatus[] {
  const statuses: CoverageStatus[] = [
    input.implementationLot === 0 ? 'integrated' : 'planned',
  ];

  if (input.machineSignal) {
    statuses.push('machine_signal');
  }

  statuses.push(input.humanStatus === 'not_tested' ? 'not_tested' : 'human_validated');
  return statuses;
}

export function machineStatusFromLegacyStatus(
  status: 'violation' | 'pass' | 'manual' | 'incomplete',
  coverage: CriterionCoverage = 'full',
): MachineStatus {
  if (status === 'violation') return 'probable_issue';
  if (status === 'pass' && coverage === 'full') return 'no_issue_detected';
  return 'needs_review';
}

export function aggregateHumanStatus(statuses: HumanStatus[]): HumanStatus {
  if (statuses.includes('non_compliant')) return 'non_compliant';
  if (statuses.length === 0 || statuses.includes('not_tested')) return 'not_tested';
  if (statuses.every((status) => status === 'not_applicable')) return 'not_applicable';
  return 'compliant';
}
