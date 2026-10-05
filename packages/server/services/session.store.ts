import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';
import type { SessionState } from '@rgaaudit/core/analyzer/analyzer';
import {
  REVIEW_SCHEMA_VERSION,
  aggregateHumanStatus,
  type AuditDecision,
  type AuditReviewState,
  type ImageAuditDecision,
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
      return JSON.parse(content) as SessionState;
    } catch {
      return null;
    }
  }

  async saveSession(session: SessionState): Promise<void> {
    await atomicJsonWrite(getSessionPath(session.sessionId), session);
  }

  async loadReviews(sessionId: string): Promise<AuditReviewState> {
    try {
      const content = await readFile(getReviewPath(sessionId), 'utf-8');
      const parsed = JSON.parse(content) as Partial<AuditReviewState>;
      if (parsed.schemaVersion === REVIEW_SCHEMA_VERSION && Array.isArray(parsed.decisions)) {
        return {
          ...(parsed as AuditReviewState),
          imageDecisions: Array.isArray(parsed.imageDecisions)
            ? parsed.imageDecisions.map((item) => ({
              ...item,
              decision: item.decision === 'violation' ? 'informative' : item.decision,
              status: item.status ?? (item.decision === 'violation' ? 'non_compliant' : 'not_tested'),
              correctedAlt: item.correctedAlt ?? '',
            }))
            : [],
        };
      }
    } catch {
      // A missing review file means that no human decision has been made yet.
    }

    return {
      schemaVersion: REVIEW_SCHEMA_VERSION,
      sessionId,
      decisions: [],
      imageDecisions: [],
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
      update(review);
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
