import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { getCriterion } from '@rgaaudit/core/mapping';
import { loadSession, saveDecision, saveImageDecision, saveImageDecisions } from '../services/session.store';
import { startAudit, cancelAudit, connectClient } from '../services/audit.service';
import { asyncHandler, HttpError } from '../middleware/error.handler';
import { validateBody } from '../middleware/validate';
import { config } from '../config';
import { isAllowedAuditUrl } from '../security/url.policy';

const sessionIdSchema = z.string().regex(/^[a-zA-Z0-9-]{1,128}$/);

const startAuditSchema = z.object({
  urls: z.array(z.string().refine(isAllowedAuditUrl, 'URL publique http(s) invalide.'))
    .min(1, 'Le champ "urls" doit être un tableau non vide.')
    .max(config.audit.maxUrls, `Maximum ${config.audit.maxUrls} URLs par audit.`),
  options: z.object({
    maxConcurrent: z.number().int().min(1).max(config.audit.maxConcurrent).optional(),
    disableContrasts: z.boolean().optional(),
  }).optional(),
});

const decisionSchema = z.object({
  pageUrl: z.string().url(),
  criterionId: z.string().regex(/^\d{1,2}\.\d{1,2}$/),
  status: z.enum(['not_tested', 'compliant', 'non_compliant', 'not_applicable']),
  comment: z.string().trim().max(5_000).default(''),
});

const imageDecisionSchema = z.object({
  pageUrl: z.string().url(),
  selector: z.string().trim().min(1).max(2_000),
  elementIndex: z.number().int().min(0).optional(),
  decision: z.enum(['decorative', 'informative', 'violation']).nullable(),
  status: z.enum(['not_tested', 'compliant', 'non_compliant', 'not_applicable']).default('not_tested'),
  correctedAlt: z.string().trim().max(2_000).default(''),
  notes: z.string().trim().max(5_000).default(''),
});

const imageDecisionsBatchSchema = z.object({
  decisions: z.array(imageDecisionSchema).min(1).max(2_000),
  markCriteriaNonCompliant: z.boolean().default(false),
});

export const auditRouter = Router();

// POST /api/audit/start
auditRouter.post('/api/audit/start', validateBody(startAuditSchema), (req: Request, res: Response) => {
  const { urls, options } = req.body;

  const sessionId = randomUUID();

  const started = startAudit({
    sessionId,
    urls,
    maxConcurrent: options?.maxConcurrent,
    disableContrasts: options?.disableContrasts,
  });

  if (!started) {
    throw new HttpError(429, 'Un audit est déjà en cours. Réessayez dans quelques instants.');
  }

  res.status(202).json({ sessionId });
});

// GET /api/audit/progress/:sessionId
auditRouter.get('/api/audit/progress/:sessionId', (req: Request, res: Response) => {
  const sessionId = sessionIdSchema.parse(req.params.sessionId);
  connectClient(sessionId, res);
});

// DELETE /api/audit/:sessionId
auditRouter.delete('/api/audit/:sessionId', (req: Request, res: Response) => {
  const sessionId = sessionIdSchema.parse(req.params.sessionId);
  cancelAudit(sessionId);
  res.json({ cancelled: true });
});

// GET /api/audit/session/:sessionId
auditRouter.get('/api/audit/session/:sessionId', asyncHandler(async (req, res) => {
  const sessionId = sessionIdSchema.parse(req.params.sessionId);
  const session = await loadSession(sessionId);

  if (!session) {
    throw new HttpError(404, 'Session introuvable.');
  }

  res.json(session);
}));

// PATCH /api/audit/:sessionId/decision — human verdict for one criterion/page.
auditRouter.patch(
  '/api/audit/:sessionId/decision',
  validateBody(decisionSchema),
  asyncHandler(async (req, res) => {
    const sessionId = sessionIdSchema.parse(req.params.sessionId);
    const session = await loadSession(sessionId);
    if (!session) throw new HttpError(404, 'Session introuvable.');

    const { pageUrl, criterionId, status, comment } = req.body;
    if (!session.results[pageUrl]) throw new HttpError(400, 'Cette page ne fait pas partie de l\'audit.');
    if (!getCriterion(criterionId)) throw new HttpError(400, 'Critère RGAA inconnu.');

    const review = await saveDecision(sessionId, {
      pageUrl,
      criterionId,
      status,
      comment,
      reviewedAt: status === 'not_tested' ? null : new Date().toISOString(),
      source: 'criterion',
    });
    res.json({ review });
  }),
);

auditRouter.patch(
  '/api/audit/:sessionId/image-decision',
  validateBody(imageDecisionSchema),
  asyncHandler(async (req, res) => {
    const sessionId = sessionIdSchema.parse(req.params.sessionId);
    const session = await loadSession(sessionId);
    if (!session) throw new HttpError(404, 'Session introuvable.');

    const { pageUrl, selector, elementIndex, decision, status, correctedAlt, notes } = req.body;
    const page = session.results[pageUrl];
    if (!page) throw new HttpError(400, 'Cette page ne fait pas partie de l\'audit.');
    const images = page.collectedData?.images ?? [];
    const resolvedIndex = elementIndex ?? images.findIndex((image) => image.selector === selector);
    if (resolvedIndex < 0 || images[resolvedIndex]?.selector !== selector) {
      throw new HttpError(400, 'Image inconnue pour cette page.');
    }

    const review = await saveImageDecision(sessionId, {
      pageUrl,
      selector,
      elementIndex: resolvedIndex,
      decision,
      status,
      correctedAlt,
      notes,
      reviewedAt: status === 'not_tested' ? null : new Date().toISOString(),
    }, images.map((image) => image.selector));
    res.json({ review });
  }),
);

auditRouter.patch(
  '/api/audit/:sessionId/image-decisions',
  validateBody(imageDecisionsBatchSchema),
  asyncHandler(async (req, res) => {
    const sessionId = sessionIdSchema.parse(req.params.sessionId);
    const session = await loadSession(sessionId);
    if (!session) throw new HttpError(404, 'Session introuvable.');

    const pageImageSelectorsByUrl: Record<string, string[]> = {};
    const decisions = req.body.decisions.map((input: z.infer<typeof imageDecisionSchema>) => {
      const page = session.results[input.pageUrl];
      if (!page) throw new HttpError(400, 'Une image concerne une page absente de l’audit.');

      const images = page.collectedData?.images ?? [];
      const resolvedIndex = input.elementIndex ?? images.findIndex((image) => image.selector === input.selector);
      if (resolvedIndex < 0 || images[resolvedIndex]?.selector !== input.selector) {
        throw new HttpError(400, 'Une image indiquée est inconnue pour cette page.');
      }
      pageImageSelectorsByUrl[input.pageUrl] = images.map((image) => image.selector);

      return {
        pageUrl: input.pageUrl,
        selector: input.selector,
        elementIndex: resolvedIndex,
        decision: input.decision,
        status: input.status,
        correctedAlt: input.correctedAlt,
        notes: input.notes,
        reviewedAt: input.status === 'not_tested' ? null : new Date().toISOString(),
      };
    });

    const review = await saveImageDecisions(
      sessionId,
      decisions,
      pageImageSelectorsByUrl,
      req.body.markCriteriaNonCompliant,
    );
    res.json({ review });
  }),
);
