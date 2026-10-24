import { Router, type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getCriterion } from '../../core/mapping';
import type { JourneyDefinition, JourneyEvidenceDecision, JourneyRunState, JourneyStep } from '../../core/journey/journey';
import { asyncHandler, HttpError } from '../middleware/error.handler';
import { validateBody } from '../middleware/validate';
import { journeyInputSchema, validateJourneySteps } from '../services/journey.validation';
import {
  getMissingSensitiveStepIds,
  loadJourney,
  loadJourneyRun,
  readJourneyScreenshot,
  redactJourney,
  redactJourneyForEditor,
  saveJourney,
  saveJourneyEvidenceDecision,
} from '../services/journey.store';
import { startJourneyReplay } from '../services/journey.service';
import { loadSession } from '../services/session.store';
import { toPublicJourneyRun } from '../services/report.service';

export const journeyRouter = Router();

const journeyDecisionSchema = z.object({
  stepId: z.string().trim().min(1).max(128),
  evidenceIndex: z.number().int().min(0).max(500),
  criterionId: z.string().regex(/^\d{1,2}\.\d{1,2}$/),
  status: z.enum(['not_tested', 'compliant', 'non_compliant', 'not_applicable']),
  comment: z.string().trim().max(5_000).default(''),
});

const journeyReplaySchema = z.object({
  sessionId: z.string().regex(/^[a-zA-Z0-9-]{1,128}$/).optional(),
}).default({});

function exposeJourneyRun(run: JourneyRunState): JourneyRunState {
  return toPublicJourneyRun(run);
}

journeyRouter.post('/api/journeys', validateBody(journeyInputSchema), asyncHandler(async (req: Request, res: Response) => {
  const validationError = validateJourneySteps(req.body.steps);
  if (validationError) throw new HttpError(400, validationError);
  const steps: JourneyStep[] = req.body.steps.map((step: Omit<JourneyStep, 'id'> & { id?: string }, index: number): JourneyStep => ({
    ...step,
    id: step.id ?? `step-${index + 1}`,
  }));
  const normalizedValidationError = validateJourneySteps(steps);
  if (normalizedValidationError) throw new HttpError(400, normalizedValidationError);
  const journey: JourneyDefinition = {
    id: randomUUID(),
    name: req.body.name,
    startUrl: req.body.startUrl,
    steps,
    createdAt: new Date().toISOString(),
  };
  await saveJourney(journey);
  res.status(201).json({ journey: redactJourney(journey) });
}));

journeyRouter.put('/api/journeys/:journeyId', validateBody(journeyInputSchema), asyncHandler(async (req: Request, res: Response) => {
  const journeyId = String(req.params.journeyId);
  const current = await loadJourney(journeyId);
  if (!current) throw new HttpError(404, 'Parcours introuvable.');

  const validationError = validateJourneySteps(req.body.steps);
  if (validationError) throw new HttpError(400, validationError);
  const steps: JourneyStep[] = req.body.steps.map((step: Omit<JourneyStep, 'id'> & { id?: string }, index: number): JourneyStep => {
    const id = step.id ?? `step-${index + 1}`;
    const previous = current.steps.find((candidate) => candidate.id === id);
    return step.sensitive && step.value === undefined && previous?.sensitive && previous.secretRef
      ? { ...step, id, secretRef: previous.secretRef }
      : { ...step, id };
  });
  const normalizedValidationError = validateJourneySteps(steps);
  if (normalizedValidationError) throw new HttpError(400, normalizedValidationError);

  const journey: JourneyDefinition = {
    ...current,
    name: req.body.name,
    startUrl: req.body.startUrl,
    steps,
  };
  await saveJourney(journey);
  res.json({ journey: redactJourney(journey) });
}));

journeyRouter.get('/api/journeys/:journeyId', asyncHandler(async (req, res) => {
  const journey = await loadJourney(String(req.params.journeyId));
  if (!journey) throw new HttpError(404, 'Parcours introuvable.');
  const editorView = req.query.view === 'editor';
  res.json({ journey: editorView ? redactJourneyForEditor(journey) : redactJourney(journey) });
}));

journeyRouter.post('/api/journeys/:journeyId/replay', validateBody(journeyReplaySchema), asyncHandler(async (req, res) => {
  const journey = await loadJourney(String(req.params.journeyId));
  if (!journey) throw new HttpError(404, 'Parcours introuvable.');
  const missingSecrets = getMissingSensitiveStepIds(journey);
  if (missingSecrets.length > 0) {
    throw new HttpError(409, 'Ce parcours contient des secrets à réinjecter avant le rejeu.');
  }
  const { sessionId } = req.body;
  if (sessionId && !(await loadSession(sessionId))) {
    throw new HttpError(404, 'Session introuvable.');
  }
  const runId = sessionId
    ? await startJourneyReplay(journey, { sessionId })
    : await startJourneyReplay(journey);
  if (!runId) throw new HttpError(429, 'Trop de rejeux sont déjà en cours. Réessayez plus tard.');
  res.status(202).json({ runId, journeyId: journey.id, ...(sessionId ? { sessionId } : {}) });
}));

journeyRouter.get('/api/journey-runs/:runId', asyncHandler(async (req, res) => {
  const run = await loadJourneyRun(String(req.params.runId));
  if (!run) throw new HttpError(404, 'Exécution de parcours introuvable.');
  res.json({ run: exposeJourneyRun(run) });
}));

journeyRouter.patch(
  '/api/journey-runs/:runId/decision',
  validateBody(journeyDecisionSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const runId = String(req.params.runId);
    const run = await loadJourneyRun(runId);
    if (!run) throw new HttpError(404, 'Exécution de parcours introuvable.');
    if (!run.run) throw new HttpError(409, 'Les preuves de cette exécution ne sont pas encore disponibles.');

    const { stepId, evidenceIndex, criterionId, status, comment } = req.body;
    if (!getCriterion(criterionId)) throw new HttpError(400, 'Critère RGAA inconnu.');
    const step = run.run.steps.find((candidate) => candidate.stepId === stepId);
    const evidence = step?.evidence[evidenceIndex];
    if (!evidence || !evidence.criterionIds.includes(criterionId)) {
      throw new HttpError(400, 'Cette preuve ne correspond pas au critère indiqué.');
    }

    const decision: JourneyEvidenceDecision = {
      stepId,
      evidenceIndex,
      criterionId,
      status,
      comment,
      reviewedAt: status === 'not_tested' ? null : new Date().toISOString(),
    };
    const updated = await saveJourneyEvidenceDecision(runId, decision);
    if (!updated) throw new HttpError(404, 'Exécution de parcours introuvable.');
    res.json({ run: exposeJourneyRun(updated) });
  }),
);

journeyRouter.get('/api/journey-runs/:runId/screenshots/:filename', asyncHandler(async (req, res) => {
  let screenshot: Buffer | null;
  try {
    screenshot = await readJourneyScreenshot(String(req.params.runId), String(req.params.filename));
  } catch (error) {
    if (error instanceof Error && error.message.includes('invalide')) {
      throw new HttpError(400, error.message);
    }
    if (error instanceof Error && error.message.includes('volumineuse')) {
      throw new HttpError(413, error.message);
    }
    throw error;
  }
  if (!screenshot) throw new HttpError(404, 'Capture introuvable.');
  res.type('png').setHeader('Cache-Control', 'private, max-age=300').send(screenshot);
}));
