import { auditPages, type ProgressEvent } from '@rgaaudit/core/analyzer/analyzer';
import { sseManager } from '../sse/progress';

interface AuditControl {
  cancelled: boolean;
}

// In-memory state for running and completed audits
const runningAudits = new Map<string, AuditControl>();
const completedAudits = new Map<string, { event: ProgressEvent; expiresAt: number }>();

const COMPLETED_TTL_MS = 30 * 60 * 1000; // 30 minutes

function cleanupExpired(): void {
  const now = Date.now();
  for (const [id, entry] of completedAudits) {
    if (entry.expiresAt <= now) completedAudits.delete(id);
  }
}

export interface StartAuditOptions {
  sessionId: string;
  urls: string[];
  maxConcurrent?: number;
  disableContrasts?: boolean;
}

export function startAudit({ sessionId, urls, maxConcurrent, disableContrasts }: StartAuditOptions): void {
  const control: AuditControl = { cancelled: false };
  runningAudits.set(sessionId, control);

  void (async () => {
    try {
      const disableRules = disableContrasts
        ? ['color-contrast', 'color-contrast-enhanced']
        : undefined;

      const gen = auditPages(urls, {
        sessionId,
        maxConcurrent,
        disableRules,
      });

      for await (const event of gen) {
        if (control.cancelled) break;
        sseManager.send(sessionId, event.type, event);

        if (event.type === 'audit_complete') {
          cleanupExpired();
          completedAudits.set(sessionId, {
            event,
            expiresAt: Date.now() + COMPLETED_TTL_MS,
          });
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      sseManager.send(sessionId, 'audit_error', { type: 'audit_error', error: message });
    } finally {
      runningAudits.delete(sessionId);
    }
  })();
}

export function cancelAudit(sessionId: string): boolean {
  const control = runningAudits.get(sessionId);
  if (control) {
    control.cancelled = true;
    return true;
  }
  return false;
}

export function getCompletedAudit(sessionId: string): ProgressEvent | undefined {
  const entry = completedAudits.get(sessionId);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    completedAudits.delete(sessionId);
    return undefined;
  }
  return entry.event;
}
