import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';
import type { SessionState } from '@rgaaudit/core/analyzer/analyzer';
import {
  REVIEW_SCHEMA_VERSION,
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
  saveImageDecision(sessionId: string, decision: ImageAuditDecision): Promise<AuditReviewState>;
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
          imageDecisions: Array.isArray(parsed.imageDecisions) ? parsed.imageDecisions : [],
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

  async saveImageDecision(sessionId: string, decision: ImageAuditDecision): Promise<AuditReviewState> {
    return this.updateReview(sessionId, (review) => {
      const index = review.imageDecisions.findIndex(
        (item) => item.pageUrl === decision.pageUrl && item.selector === decision.selector,
      );
      if (index === -1) review.imageDecisions.push(decision);
      else review.imageDecisions[index] = decision;
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
): Promise<AuditReviewState> {
  return auditRepository.saveImageDecision(sessionId, decision);
}
