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

export interface AuditDecision {
  pageUrl: string;
  criterionId: string;
  status: HumanStatus;
  comment: string;
  reviewedAt: string | null;
}

export type ImageClassification = 'decorative' | 'informative' | 'violation' | null;

export interface ImageAuditDecision {
  pageUrl: string;
  selector: string;
  decision: ImageClassification;
  notes: string;
  reviewedAt: string | null;
}

export interface AuditReviewState {
  schemaVersion: typeof REVIEW_SCHEMA_VERSION;
  sessionId: string;
  decisions: AuditDecision[];
  imageDecisions: ImageAuditDecision[];
  updatedAt: string;
}

export function machineStatusFromLegacyStatus(
  status: 'violation' | 'pass' | 'manual' | 'incomplete',
): MachineStatus {
  if (status === 'violation') return 'probable_issue';
  if (status === 'pass') return 'no_issue_detected';
  return 'needs_review';
}

export function aggregateHumanStatus(statuses: HumanStatus[]): HumanStatus {
  if (statuses.length === 0 || statuses.includes('not_tested')) return 'not_tested';
  if (statuses.includes('non_compliant')) return 'non_compliant';
  if (statuses.every((status) => status === 'not_applicable')) return 'not_applicable';
  return 'compliant';
}
