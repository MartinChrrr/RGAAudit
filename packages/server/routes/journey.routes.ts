import { Router, type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import type { JourneyDefinition, JourneyStep } from '../../core/journey/journey';
import { asyncHandler, HttpError } from '../middleware/error.handler';
import { validateBody } from '../middleware/validate';
import { journeyInputSchema, validateJourneySteps } from '../services/journey.validation';
import { loadJourney, loadJourneyRun, redactJourney, saveJourney } from '../services/journey.store';
import { startJourneyReplay } from '../services/journey.service';

export const journeyRouter = Router();

journeyRouter.post('/api/journeys', validateBody(journeyInputSchema), asyncHandler(async (req: Request, res: Response) => {
  const validationError = validateJourneySteps(req.body.steps);
  if (validationError) throw new HttpError(400, validationError);
  const journey: JourneyDefinition = {
    id: randomUUID(),
    name: req.body.name,
    startUrl: req.body.startUrl,
    steps: req.body.steps.map((step: Omit<JourneyStep, 'id'> & { id?: string }, index: number): JourneyStep => ({
      ...step,
      id: step.id ?? `step-${index + 1}`,
    })),
    createdAt: new Date().toISOString(),
  };
  await saveJourney(journey);
  res.status(201).json({ journey: redactJourney(journey) });
}));

journeyRouter.get('/api/journeys/:journeyId', asyncHandler(async (req, res) => {
  const journey = await loadJourney(String(req.params.journeyId));
  if (!journey) throw new HttpError(404, 'Parcours introuvable.');
  res.json({ journey: redactJourney(journey) });
}));

journeyRouter.post('/api/journeys/:journeyId/replay', asyncHandler(async (req, res) => {
  const journey = await loadJourney(String(req.params.journeyId));
  if (!journey) throw new HttpError(404, 'Parcours introuvable.');
  const runId = await startJourneyReplay(journey);
  if (!runId) throw new HttpError(429, 'Trop de rejeux sont déjà en cours. Réessayez plus tard.');
  res.status(202).json({ runId, journeyId: journey.id });
}));

journeyRouter.get('/api/journey-runs/:runId', asyncHandler(async (req, res) => {
  const run = await loadJourneyRun(String(req.params.runId));
  if (!run) throw new HttpError(404, 'Exécution de parcours introuvable.');
  res.json({ run });
}));
