import { Router, type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import { sseManager } from '../sse/progress';
import { loadSession } from '../services/session.store';
import { startAudit, cancelAudit, getCompletedAudit } from '../services/audit.service';

export const auditRouter = Router();

// POST /api/audit/start
auditRouter.post('/api/audit/start', (req: Request, res: Response) => {
  const { urls, options } = req.body as {
    urls?: string[];
    options?: { maxConcurrent?: number; disableContrasts?: boolean };
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

  startAudit({
    sessionId,
    urls,
    maxConcurrent: options?.maxConcurrent,
    disableContrasts: options?.disableContrasts,
  });

  res.status(202).json({ sessionId });
});

// GET /api/audit/progress/:sessionId
auditRouter.get('/api/audit/progress/:sessionId', (req: Request, res: Response) => {
  const sessionId = req.params.sessionId as string;

  sseManager.addClient(sessionId, res);

  // If audit already completed, send the event immediately
  const completed = getCompletedAudit(sessionId);
  if (completed) {
    sseManager.send(sessionId, completed.type, completed);
  }
});

// DELETE /api/audit/:sessionId
auditRouter.delete('/api/audit/:sessionId', (req: Request, res: Response) => {
  const sessionId = req.params.sessionId as string;
  cancelAudit(sessionId);
  res.json({ cancelled: true });
});

// GET /api/audit/session/:sessionId
auditRouter.get('/api/audit/session/:sessionId', async (req: Request, res: Response) => {
  const sessionId = req.params.sessionId as string;
  const session = await loadSession(sessionId);

  if (!session) {
    res.status(404).json({ error: 'Session introuvable.' });
    return;
  }

  res.json(session);
});
