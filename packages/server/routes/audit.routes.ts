import { Router, type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import { loadSession } from '../services/session.store';
import { startAudit, cancelAudit, connectClient } from '../services/audit.service';
import { asyncHandler, HttpError } from '../middleware/error.handler';

export const auditRouter = Router();

// POST /api/audit/start
auditRouter.post('/api/audit/start', (req: Request, res: Response) => {
  const { urls, options } = req.body as {
    urls?: string[];
    options?: { maxConcurrent?: number; disableContrasts?: boolean };
  };

  if (!Array.isArray(urls) || urls.length === 0) {
    throw new HttpError(400, 'Le champ "urls" doit être un tableau non vide.');
  }

  if (urls.length > 50) {
    throw new HttpError(400, 'Maximum 50 URLs par audit.');
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
  connectClient(sessionId, res);
});

// DELETE /api/audit/:sessionId
auditRouter.delete('/api/audit/:sessionId', (req: Request, res: Response) => {
  const sessionId = req.params.sessionId as string;
  cancelAudit(sessionId);
  res.json({ cancelled: true });
});

// GET /api/audit/session/:sessionId
auditRouter.get('/api/audit/session/:sessionId', asyncHandler(async (req, res) => {
  const sessionId = req.params.sessionId as string;
  const session = await loadSession(sessionId);

  if (!session) {
    throw new HttpError(404, 'Session introuvable.');
  }

  res.json(session);
}));
