import { auditPages, type ProgressEvent } from '@rgaaudit/core/analyzer/analyzer';
import { sseManager } from '../sse/progress';
import { config } from '../config';
import { loadSession, saveSession } from './session.store';
import { isPublicNetworkUrl } from '../security/url.policy';
import { pageIdForUrl, redactStructuredText, redactTextUrls, redactUrl } from '../security/url.redaction';
import { redactCollectedData } from './report.service';

interface AuditControl {
  cancelled: boolean;
}

// In-memory state for running and completed audits
const runningAudits = new Map<string, AuditControl>();
const completedAudits = new Map<string, { event: ProgressEvent; expiresAt: number }>();

const COMPLETED_TTL_MS = config.audit.completedTtlMs;

function publicProgressEvent(sessionId: string, event: ProgressEvent): Record<string, unknown> {
  if (event.type === 'audit_complete') return event;
  return {
    ...event,
    pageId: pageIdForUrl(sessionId, event.url),
    url: redactUrl(event.url),
    ...(event.type === 'page_error' ? { error: redactTextUrls(event.error) } : {}),
    ...(event.type === 'page_complete'
      ? {
        result: {
          ...event.result,
          url: redactUrl(event.result.url),
          axeResults: redactStructuredText(event.result.axeResults),
          heuristicResults: redactStructuredText(event.result.heuristicResults),
          collectedData: redactCollectedData(event.result.collectedData),
        },
      }
      : {}),
  };
}

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

export function startAudit({ sessionId, urls, maxConcurrent, disableContrasts }: StartAuditOptions): boolean {
  if (runningAudits.size >= config.audit.maxRunning) return false;

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
        persistState: saveSession,
        isRequestAllowed: isPublicNetworkUrl,
      });

      for await (const event of gen) {
        if (control.cancelled) break;
        sseManager.send(sessionId, event.type, publicProgressEvent(sessionId, event));

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
      sseManager.send(sessionId, 'audit_error', { type: 'audit_error', error: redactTextUrls(message) });
    } finally {
      runningAudits.delete(sessionId);
    }
  })();

  return true;
}

export function cancelAudit(sessionId: string): boolean {
  const control = runningAudits.get(sessionId);
  if (control) {
    control.cancelled = true;
    return true;
  }
  return false;
}

export function connectClient(sessionId: string, res: import('express').Response): void {
  sseManager.addClient(sessionId, res);

  // Rehydrate progress after refresh or when a very short audit finishes before SSE connects.
  void loadSession(sessionId).then((session) => {
    if (!session) return;
    for (const url of [...session.completedPages, ...session.pendingPages]) {
      sseManager.send(sessionId, 'page_start', {
        type: 'page_start',
        pageId: pageIdForUrl(sessionId, url),
        url: redactUrl(url),
      });
    }
    for (const url of session.completedPages) {
      const result = session.results[url];
      if (!result) continue;
      if (result.error) {
        sseManager.send(sessionId, 'page_error', {
          type: 'page_error',
          pageId: pageIdForUrl(sessionId, url),
          url: redactUrl(url),
          error: redactTextUrls(result.error),
        });
      } else {
        sseManager.send(sessionId, 'page_complete', publicProgressEvent(sessionId, {
          type: 'page_complete',
          url,
          result,
        }));
      }
    }
  }).catch(() => {}).finally(() => {
    const completed = getCompletedAudit(sessionId);
    if (completed) sseManager.send(sessionId, completed.type, publicProgressEvent(sessionId, completed));
  });
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
