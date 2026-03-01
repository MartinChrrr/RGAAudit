import { Router, type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { auditPages, type ProgressEvent } from '@rgaaudit/core/analyzer/analyzer';
import { sseManager } from '../sse/progress';

export const auditRouter = Router();

// Track running audits for cancellation
const runningAudits = new Map<string, { cancelled: boolean }>();
// Track completed audits for late SSE connections
const completedAudits = new Map<string, ProgressEvent>();

// POST /api/audit/start
auditRouter.post('/api/audit/start', (req: Request, res: Response) => {
  const { urls, options } = req.body as {
    urls?: string[];
    options?: { maxConcurrent?: number };
  };

  if (!Array.isArray(urls) || urls.length === 0) {
    res.status(400).json({ error: 'Le champ "urls" doit être un tableau non vide.' });
    return;
  }

  if (urls.length > 50) {
    res.status(400).json({ error: 'Maximum 50 URLs par audit.' });
    return;
  }

  const sessionId = randomUUID();
  const control = { cancelled: false };
  runningAudits.set(sessionId, control);

  // Launch audit in background — do NOT await
  void (async () => {
    try {
      const gen = auditPages(urls, {
        sessionId,
        maxConcurrent: options?.maxConcurrent,
      });

      for await (const event of gen) {
        if (control.cancelled) break;
        sseManager.send(sessionId, event.type, event);

        if (event.type === 'audit_complete') {
          completedAudits.set(sessionId, event);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      sseManager.send(sessionId, 'audit_error', { type: 'audit_error', error: message });
    } finally {
      runningAudits.delete(sessionId);
    }
  })();

  res.status(202).json({ sessionId });
});

// GET /api/audit/progress/:sessionId
auditRouter.get('/api/audit/progress/:sessionId', (req: Request, res: Response) => {
  const sessionId = req.params.sessionId as string;

  sseManager.addClient(sessionId, res);

  // If audit already completed, send the event immediately
  const completed = completedAudits.get(sessionId);
  if (completed) {
    sseManager.send(sessionId, completed.type, completed);
  }
});

// DELETE /api/audit/:sessionId
auditRouter.delete('/api/audit/:sessionId', (req: Request, res: Response) => {
  const sessionId = req.params.sessionId as string;
  const control = runningAudits.get(sessionId);

  if (control) {
    control.cancelled = true;
  }

  res.json({ cancelled: true });
});

// GET /api/audit/session/:sessionId
auditRouter.get('/api/audit/session/:sessionId', async (req: Request, res: Response) => {
  const sessionId = req.params.sessionId as string;
  const sessionPath = join(homedir(), '.rgaaudit', 'sessions', `audit-${sessionId}.json`);

  try {
    const content = await readFile(sessionPath, 'utf-8');
    res.json(JSON.parse(content));
  } catch {
    res.status(404).json({ error: 'Session introuvable.' });
  }
});
