import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';
import {
  SESSION_SCHEMA_VERSION,
  type PageResult,
  type SessionState,
} from '@rgaaudit/core/analyzer/analyzer';
import {
  REVIEW_SCHEMA_VERSION,
  aggregateHumanStatus,
  type AuditDecision,
  type AuditReviewState,
  type ImageAuditDecision,
  type HumanStatus,
} from '@rgaaudit/core/domain/review';
import { config } from '../config';

const DATA_DIR = config.dataDir || join(homedir(), '.rgaaudit');
const SESSIONS_DIR = join(DATA_DIR, 'sessions');

export interface AuditRepository {
  loadSession(sessionId: string): Promise<SessionState | null>;
  saveSession(session: SessionState): Promise<void>;
  loadReviews(sessionId: string): Promise<AuditReviewState>;
  saveDecision(sessionId: string, decision: AuditDecision): Promise<AuditReviewState>;
  saveImageDecision(
    sessionId: string,
    decision: ImageAuditDecision,
    pageImageSelectors?: string[],
  ): Promise<AuditReviewState>;
  saveImageDecisions(
    sessionId: string,
    decisions: ImageAuditDecision[],
    pageImageSelectorsByUrl: Record<string, string[]>,
    markCriteriaNonCompliant?: boolean,
  ): Promise<AuditReviewState>;
}

const HUMAN_STATUSES: HumanStatus[] = ['not_tested', 'compliant', 'non_compliant', 'not_applicable'];
const IMAGE_DECISIONS: ImageAuditDecision['decision'][] = ['decorative', 'informative', 'violation', null];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeHumanStatus(value: unknown): HumanStatus {
  return typeof value === 'string' && HUMAN_STATUSES.includes(value as HumanStatus)
    ? value as HumanStatus
    : 'not_tested';
}

function normalizeDecision(value: unknown): AuditDecision | null {
  if (!isRecord(value) || typeof value.pageUrl !== 'string' || typeof value.criterionId !== 'string') return null;
  return {
    pageUrl: value.pageUrl,
    criterionId: value.criterionId,
    status: normalizeHumanStatus(value.status),
    comment: typeof value.comment === 'string' ? value.comment : '',
    reviewedAt: typeof value.reviewedAt === 'string' ? value.reviewedAt : null,
    ...(value.source === 'criterion' || value.source === 'annex_images' ? { source: value.source } : {}),
  };
}

function normalizeImageDecision(value: unknown): ImageAuditDecision | null {
  if (!isRecord(value) || typeof value.pageUrl !== 'string' || typeof value.selector !== 'string') return null;
  const legacyDecision = value.decision === 'violation' ? 'informative' : value.decision;
  return {
    pageUrl: value.pageUrl,
    selector: value.selector,
    ...(typeof value.elementIndex === 'number' ? { elementIndex: value.elementIndex } : {}),
    decision: IMAGE_DECISIONS.includes(legacyDecision as ImageAuditDecision['decision'])
      ? legacyDecision as ImageAuditDecision['decision']
      : null,
    status: normalizeHumanStatus(value.status ?? (legacyDecision === 'informative' ? 'non_compliant' : 'not_tested')),
    correctedAlt: typeof value.correctedAlt === 'string' ? value.correctedAlt : '',
    notes: typeof value.notes === 'string' ? value.notes : '',
    reviewedAt: typeof value.reviewedAt === 'string' ? value.reviewedAt : null,
  };
}

/** Migrate persisted review files without discarding old decisions. */
export function migrateReviewState(raw: unknown, sessionId: string): AuditReviewState | null {
  if (!isRecord(raw)) return null;
  const version = typeof raw.schemaVersion === 'number' ? raw.schemaVersion : 0;
  if (version > REVIEW_SCHEMA_VERSION) return null;
  const decisions = Array.isArray(raw.decisions)
    ? raw.decisions.map(normalizeDecision).filter((item): item is AuditDecision => item !== null)
    : [];
  const imageDecisions = Array.isArray(raw.imageDecisions)
    ? raw.imageDecisions.map(normalizeImageDecision).filter((item): item is ImageAuditDecision => item !== null)
    : [];
  return {
    schemaVersion: REVIEW_SCHEMA_VERSION,
    sessionId,
    decisions,
    decisionHistory: Array.isArray(raw.decisionHistory)
      ? raw.decisionHistory.map(normalizeDecision).filter((item): item is AuditDecision => item !== null)
      : [],
    imageDecisions,
    imageDecisionHistory: Array.isArray(raw.imageDecisionHistory)
      ? raw.imageDecisionHistory.map(normalizeImageDecision).filter((item): item is ImageAuditDecision => item !== null)
      : [],
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date(0).toISOString(),
  };
}

/** Migrate session envelopes written before an explicit schema version. */
export function migrateSessionState(raw: unknown, sessionId: string): SessionState | null {
  if (!isRecord(raw)) return null;
  const version = typeof raw.schemaVersion === 'number' ? raw.schemaVersion : 0;
  if (version > SESSION_SCHEMA_VERSION) return null;
  if (!Array.isArray(raw.completedPages) || !Array.isArray(raw.pendingPages) || !isRecord(raw.results)) return null;

  const results: Record<string, PageResult> = {};
  for (const [url, rawResult] of Object.entries(raw.results)) {
    if (!isRecord(rawResult)) continue;
    results[url] = {
      url: typeof rawResult.url === 'string' ? rawResult.url : url,
      auditedAt: typeof rawResult.auditedAt === 'string' ? rawResult.auditedAt : new Date(0).toISOString(),
      axeResults: rawResult.axeResults && typeof rawResult.axeResults === 'object'
        ? rawResult.axeResults as PageResult['axeResults']
        : null,
      collectedData: rawResult.collectedData && typeof rawResult.collectedData === 'object'
        ? rawResult.collectedData as PageResult['collectedData']
        : null,
      heuristicResults: Array.isArray(rawResult.heuristicResults)
        ? rawResult.heuristicResults as PageResult['heuristicResults']
        : [],
      error: typeof rawResult.error === 'string' ? rawResult.error : null,
    };
  }

  return {
    schemaVersion: SESSION_SCHEMA_VERSION,
    sessionId,
    startedAt: typeof raw.startedAt === 'string' ? raw.startedAt : new Date(0).toISOString(),
    totalPages: typeof raw.totalPages === 'number' ? raw.totalPages : Object.keys(results).length,
    completedPages: raw.completedPages.filter((url): url is string => typeof url === 'string'),
    pendingPages: raw.pendingPages.filter((url): url is string => typeof url === 'string'),
    results,
    observations: Array.isArray(raw.observations) ? raw.observations as SessionState['observations'] : [],
  };
}

export function applyImageDecision(
  review: AuditReviewState,
  decision: ImageAuditDecision,
  pageImageSelectors: string[] = [],
  reviewedAt = new Date().toISOString(),
): void {
  const index = review.imageDecisions.findIndex(
    (item) => item.pageUrl === decision.pageUrl && (
      decision.elementIndex !== undefined
        ? item.elementIndex === decision.elementIndex
        : item.elementIndex === undefined && item.selector === decision.selector
    ),
  );
  if (index === -1) review.imageDecisions.push(decision);
  else review.imageDecisions[index] = decision;

  if (pageImageSelectors.length === 0) return;

  const imageStatuses = pageImageSelectors.map((selector, elementIndex) => {
    const exactDecision = review.imageDecisions.find((item) => (
      item.pageUrl === decision.pageUrl && item.elementIndex === elementIndex
    ));
    if (exactDecision) return exactDecision.status;

    // A legacy selector-only decision is associated with its first matching row only.
    if (pageImageSelectors.indexOf(selector) !== elementIndex) return 'not_tested';
    return review.imageDecisions.find((item) => (
      item.pageUrl === decision.pageUrl
      && item.elementIndex === undefined
      && item.selector === selector
    ))?.status ?? 'not_tested';
  });
  const criterionStatus = aggregateHumanStatus(imageStatuses);
  const criterionIndex = review.decisions.findIndex((item) => (
    item.pageUrl === decision.pageUrl && item.criterionId === '1.1'
  ));
  const currentCriterion = criterionIndex === -1 ? undefined : review.decisions[criterionIndex];

  // A verdict entered directly on the criterion always has priority over the annex summary.
  if (currentCriterion && currentCriterion.source !== 'annex_images') return;

  const criterionDecision: AuditDecision = {
    pageUrl: decision.pageUrl,
    criterionId: '1.1',
    status: criterionStatus,
    comment: 'Synthèse des validations enregistrées dans l’annexe Images.',
    reviewedAt: criterionStatus === 'not_tested' ? null : reviewedAt,
    source: 'annex_images',
  };
  if (criterionIndex === -1) review.decisions.push(criterionDecision);
  else review.decisions[criterionIndex] = criterionDecision;
}

export function applyImageDecisions(
  review: AuditReviewState,
  decisions: ImageAuditDecision[],
  pageImageSelectorsByUrl: Record<string, string[]> = {},
  markCriteriaNonCompliant = false,
  reviewedAt = new Date().toISOString(),
): void {
  for (const decision of decisions) {
    applyImageDecision(
      review,
      decision,
      pageImageSelectorsByUrl[decision.pageUrl] ?? [],
      reviewedAt,
    );
  }

  if (!markCriteriaNonCompliant) return;

  for (const pageUrl of new Set(decisions.map((decision) => decision.pageUrl))) {
    const criterion: AuditDecision = {
      pageUrl,
      criterionId: '1.1',
      status: 'non_compliant',
      comment: 'Modification enregistrée dans l’annexe Images : vérification requise.',
      reviewedAt,
      source: 'criterion',
    };
    const index = review.decisions.findIndex((item) => (
      item.pageUrl === pageUrl && item.criterionId === '1.1'
    ));
    if (index === -1) review.decisions.push(criterion);
    else review.decisions[index] = criterion;
  }
}

/** Preserve every replaced decision so a later review can reconstruct the audit trail. */
export function appendRevisionHistory(
  review: AuditReviewState,
  previousDecisions: AuditDecision[],
  previousImageDecisions: ImageAuditDecision[],
): void {
  const decisionHistory = review.decisionHistory ?? (review.decisionHistory = []);
  for (const previous of previousDecisions) {
    const current = review.decisions.find((item) => (
      item.pageUrl === previous.pageUrl && item.criterionId === previous.criterionId
    ));
    if (current && JSON.stringify(current) !== JSON.stringify(previous)) {
      decisionHistory.push(previous);
    }
  }

  const imageDecisionHistory = review.imageDecisionHistory ?? (review.imageDecisionHistory = []);
  for (const previous of previousImageDecisions) {
    const current = review.imageDecisions.find((item) => (
      item.pageUrl === previous.pageUrl
      && (item.elementIndex !== undefined && previous.elementIndex !== undefined
        ? item.elementIndex === previous.elementIndex
        : item.elementIndex === previous.elementIndex && item.selector === previous.selector)
    ));
    if (current && JSON.stringify(current) !== JSON.stringify(previous)) {
      imageDecisionHistory.push(previous);
    }
  }
}

function assertSafeSessionId(sessionId: string): void {
  if (!/^[a-zA-Z0-9-]{1,128}$/.test(sessionId)) {
    throw new Error('Identifiant de session invalide.');
  }
}

async function atomicJsonWrite(path: string, value: unknown): Promise<void> {
  await mkdir(SESSIONS_DIR, { recursive: true });
  const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, JSON.stringify(value, null, 2), 'utf-8');
  await rename(temporaryPath, path);
}

export function getSessionPath(sessionId: string): string {
  assertSafeSessionId(sessionId);
  return join(SESSIONS_DIR, `audit-${sessionId}.json`);
}

export function getReviewPath(sessionId: string): string {
  assertSafeSessionId(sessionId);
  return join(SESSIONS_DIR, `review-${sessionId}.json`);
}

class JsonAuditRepository implements AuditRepository {
  private reviewWriteQueue = Promise.resolve();

  async loadSession(sessionId: string): Promise<SessionState | null> {
    try {
      const content = await readFile(getSessionPath(sessionId), 'utf-8');
      return migrateSessionState(JSON.parse(content), sessionId);
    } catch {
      return null;
    }
  }

  async saveSession(session: SessionState): Promise<void> {
    await atomicJsonWrite(getSessionPath(session.sessionId), {
      ...session,
      schemaVersion: SESSION_SCHEMA_VERSION,
    });
  }

  async loadReviews(sessionId: string): Promise<AuditReviewState> {
    try {
      const content = await readFile(getReviewPath(sessionId), 'utf-8');
      const migrated = migrateReviewState(JSON.parse(content), sessionId);
      if (migrated) return migrated;
    } catch {
      // A missing review file means that no human decision has been made yet.
    }

    return {
      schemaVersion: REVIEW_SCHEMA_VERSION,
      sessionId,
      decisions: [],
      decisionHistory: [],
      imageDecisions: [],
      imageDecisionHistory: [],
      updatedAt: new Date(0).toISOString(),
    };
  }

  async saveDecision(sessionId: string, decision: AuditDecision): Promise<AuditReviewState> {
    return this.updateReview(sessionId, (review) => {
      const index = review.decisions.findIndex(
        (item) => item.pageUrl === decision.pageUrl && item.criterionId === decision.criterionId,
      );
      if (index === -1) review.decisions.push(decision);
      else review.decisions[index] = decision;
    });
  }

  async saveImageDecision(
    sessionId: string,
    decision: ImageAuditDecision,
    pageImageSelectors: string[] = [],
  ): Promise<AuditReviewState> {
    return this.updateReview(sessionId, (review) => {
      applyImageDecision(review, decision, pageImageSelectors);
    });
  }

  async saveImageDecisions(
    sessionId: string,
    decisions: ImageAuditDecision[],
    pageImageSelectorsByUrl: Record<string, string[]>,
    markCriteriaNonCompliant = false,
  ): Promise<AuditReviewState> {
    return this.updateReview(sessionId, (review) => {
      applyImageDecisions(review, decisions, pageImageSelectorsByUrl, markCriteriaNonCompliant);
    });
  }

  private updateReview(
    sessionId: string,
    update: (review: AuditReviewState) => void,
  ): Promise<AuditReviewState> {
    const operation = this.reviewWriteQueue.then(async () => {
      const review = await this.loadReviews(sessionId);
      const previousDecisions = review.decisions.map((item) => ({ ...item }));
      const previousImageDecisions = review.imageDecisions.map((item) => ({ ...item }));
      update(review);
      appendRevisionHistory(review, previousDecisions, previousImageDecisions);
      review.updatedAt = new Date().toISOString();
      await atomicJsonWrite(getReviewPath(sessionId), review);
      return review;
    });
    this.reviewWriteQueue = operation.then(() => undefined, () => undefined);
    return operation;
  }
}

export const auditRepository: AuditRepository = new JsonAuditRepository();

export function loadSession(sessionId: string): Promise<SessionState | null> {
  return auditRepository.loadSession(sessionId);
}

export function saveSession(session: SessionState): Promise<void> {
  return auditRepository.saveSession(session);
}

export function loadReviews(sessionId: string): Promise<AuditReviewState> {
  return auditRepository.loadReviews(sessionId);
}

export function saveDecision(
  sessionId: string,
  decision: AuditDecision,
): Promise<AuditReviewState> {
  return auditRepository.saveDecision(sessionId, decision);
}

export function saveImageDecision(
  sessionId: string,
  decision: ImageAuditDecision,
  pageImageSelectors?: string[],
): Promise<AuditReviewState> {
  return auditRepository.saveImageDecision(sessionId, decision, pageImageSelectors);
}

export function saveImageDecisions(
  sessionId: string,
  decisions: ImageAuditDecision[],
  pageImageSelectorsByUrl: Record<string, string[]>,
  markCriteriaNonCompliant = false,
): Promise<AuditReviewState> {
  return auditRepository.saveImageDecisions(
    sessionId,
    decisions,
    pageImageSelectorsByUrl,
    markCriteriaNonCompliant,
  );
}
