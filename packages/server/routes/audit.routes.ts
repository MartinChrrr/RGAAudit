import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { getCriterion } from '@rgaaudit/core/mapping';
import { loadReviews, loadSession, saveDecision, saveImageDecision, saveImageDecisions } from '../services/session.store';
import { startAudit, cancelAudit, connectClient } from '../services/audit.service';
import { asyncHandler, HttpError } from '../middleware/error.handler';
import { validateBody } from '../middleware/validate';
import { config } from '../config';
import { isAllowedAuditUrl } from '../security/url.policy';
import { pageIdForUrl, redactStructuredText, redactTextUrls } from '../security/url.redaction';
import { buildReportFromSession, redactCollectedData, toPublicReportData } from '../services/report.service';

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
  pageId: z.string().regex(/^page-[0-9a-f]{32}$/).optional(),
  pageUrl: z.string().url().optional(),
  criterionId: z.string().regex(/^\d{1,2}\.\d{1,2}$/),
  status: z.enum(['not_tested', 'compliant', 'non_compliant', 'not_applicable']),
  comment: z.string().trim().max(5_000).default(''),
}).refine((input) => Boolean(input.pageId || input.pageUrl), 'Une page doit être fournie.');

const imageDecisionSchema = z.object({
  pageId: z.string().regex(/^page-[0-9a-f]{32}$/).optional(),
  pageUrl: z.string().url().optional(),
  selector: z.string().trim().min(1).max(2_000),
  elementIndex: z.number().int().min(0).optional(),
  decision: z.enum(['decorative', 'informative', 'violation']).nullable(),
  status: z.enum(['not_tested', 'compliant', 'non_compliant', 'not_applicable']).default('not_tested'),
  correctedAlt: z.string().trim().max(2_000).default(''),
  notes: z.string().trim().max(5_000).default(''),
}).refine((input) => Boolean(input.pageId || input.pageUrl), 'Une page doit être fournie.');

const imageDecisionsBatchSchema = z.object({
  decisions: z.array(imageDecisionSchema).min(1).max(2_000),
  markCriteriaNonCompliant: z.boolean().default(false),
});

export const auditRouter = Router();

function resolvePageUrl(
  sessionId: string,
  session: Awaited<ReturnType<typeof loadSession>>,
  pageId?: string,
  pageUrl?: string,
): string | null {
  if (!session) return null;
  const byId = pageId
    ? Object.keys(session.results).find((candidate) => pageIdForUrl(sessionId, candidate) === pageId)
    : undefined;
  if (pageUrl && !session.results[pageUrl]) return null;
  if (byId && pageUrl && byId !== pageUrl) return null;
  return byId ?? pageUrl ?? null;
}

async function publicReview(sessionId: string, session: NonNullable<Awaited<ReturnType<typeof loadSession>>>) {
  const reviews = await loadReviews(sessionId);
  return toPublicReportData(buildReportFromSession(session, reviews), sessionId).review;
}

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

  // The raw session remains on disk for exact identity and replay. This
  // endpoint is public-facing, so do not return result keys containing query
  // parameters.
  const safeResults = Object.fromEntries(Object.entries(session.results).map(([url, result]) => [
    pageIdForUrl(sessionId, url),
    {
      ...result,
      url: undefined,
      axeResults: redactStructuredText(result.axeResults),
      heuristicResults: redactStructuredText(result.heuristicResults),
      error: result.error ? redactTextUrls(result.error) : result.error,
      collectedData: redactCollectedData(result.collectedData),
    },
  ]));
  res.json({
    ...session,
    completedPages: session.completedPages.map((url) => pageIdForUrl(sessionId, url)),
    pendingPages: session.pendingPages.map((url) => pageIdForUrl(sessionId, url)),
    results: safeResults,
  });
}));

// PATCH /api/audit/:sessionId/decision — human verdict for one criterion/page.
auditRouter.patch(
  '/api/audit/:sessionId/decision',
  validateBody(decisionSchema),
  asyncHandler(async (req, res) => {
    const sessionId = sessionIdSchema.parse(req.params.sessionId);
    const session = await loadSession(sessionId);
    if (!session) throw new HttpError(404, 'Session introuvable.');

    const { pageId, pageUrl, criterionId, status, comment } = req.body;
    const resolvedPageUrl = resolvePageUrl(sessionId, session, pageId, pageUrl);
    if (!resolvedPageUrl) throw new HttpError(400, 'Cette page ne fait pas partie de l\'audit.');
    if (!getCriterion(criterionId)) throw new HttpError(400, 'Critère RGAA inconnu.');

    await saveDecision(sessionId, {
      pageUrl: resolvedPageUrl,
      criterionId,
      status,
      comment,
      reviewedAt: status === 'not_tested' ? null : new Date().toISOString(),
      source: 'criterion',
    });
    res.json({ review: await publicReview(sessionId, session) });
  }),
);

auditRouter.patch(
  '/api/audit/:sessionId/image-decision',
  validateBody(imageDecisionSchema),
  asyncHandler(async (req, res) => {
    const sessionId = sessionIdSchema.parse(req.params.sessionId);
    const session = await loadSession(sessionId);
    if (!session) throw new HttpError(404, 'Session introuvable.');

    const { pageId, pageUrl, selector, elementIndex, decision, status, correctedAlt, notes } = req.body;
    const resolvedPageUrl = resolvePageUrl(sessionId, session, pageId, pageUrl);
    if (!resolvedPageUrl) throw new HttpError(400, 'Cette page ne fait pas partie de l\'audit.');
    const page = session.results[resolvedPageUrl];
    if (!page) throw new HttpError(400, 'Cette page ne fait pas partie de l\'audit.');
    const images = page.collectedData?.images ?? [];
    const resolvedIndex = elementIndex ?? images.findIndex((image) => image.selector === selector);
    if (resolvedIndex < 0 || images[resolvedIndex]?.selector !== selector) {
      throw new HttpError(400, 'Image inconnue pour cette page.');
    }

    await saveImageDecision(sessionId, {
      pageUrl: resolvedPageUrl,
      selector,
      elementIndex: resolvedIndex,
      decision,
      status,
      correctedAlt,
      notes,
      reviewedAt: status === 'not_tested' ? null : new Date().toISOString(),
    }, images.map((image) => image.selector));
    res.json({ review: await publicReview(sessionId, session) });
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
      const resolvedPageUrl = resolvePageUrl(sessionId, session, input.pageId, input.pageUrl);
      if (!resolvedPageUrl) throw new HttpError(400, 'Une image concerne une page absente de l’audit.');
      const page = session.results[resolvedPageUrl];
      if (!page) throw new HttpError(400, 'Une image concerne une page absente de l’audit.');

      const images = page.collectedData?.images ?? [];
      const resolvedIndex = input.elementIndex ?? images.findIndex((image) => image.selector === input.selector);
      if (resolvedIndex < 0 || images[resolvedIndex]?.selector !== input.selector) {
        throw new HttpError(400, 'Une image indiquée est inconnue pour cette page.');
      }
      pageImageSelectorsByUrl[resolvedPageUrl] = images.map((image) => image.selector);

      return {
        pageUrl: resolvedPageUrl,
        selector: input.selector,
        elementIndex: resolvedIndex,
        decision: input.decision,
        status: input.status,
        correctedAlt: input.correctedAlt,
        notes: input.notes,
        reviewedAt: input.status === 'not_tested' ? null : new Date().toISOString(),
      };
    });

    await saveImageDecisions(
      sessionId,
      decisions,
      pageImageSelectorsByUrl,
      req.body.markCriteriaNonCompliant,
    );
    res.json({ review: await publicReview(sessionId, session) });
  }),
);
