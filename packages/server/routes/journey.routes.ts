import { Router, type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import { basename } from 'node:path';
import type { JourneyDefinition, JourneyRunState, JourneyStep } from '../../core/journey/journey';
import { asyncHandler, HttpError } from '../middleware/error.handler';
import { validateBody } from '../middleware/validate';
import { journeyInputSchema, validateJourneySteps } from '../services/journey.validation';
import {
  getMissingSensitiveStepIds,
  loadJourney,
  loadJourneyRun,
  readJourneyScreenshot,
  redactJourney,
  saveJourney,
} from '../services/journey.store';
import { startJourneyReplay } from '../services/journey.service';

export const journeyRouter = Router();

function exposeJourneyRun(run: JourneyRunState): JourneyRunState {
  if (!run.run) return run;
  return {
    ...run,
    run: {
      ...run.run,
      steps: run.run.steps.map((step) => {
        if (!step.screenshotPath) return step;
        const filename = basename(step.screenshotPath);
        const { screenshotPath: _screenshotPath, ...publicStep } = step;
        return {
          ...publicStep,
          screenshotUrl: `/api/journey-runs/${run.runId}/screenshots/${encodeURIComponent(filename)}`,
        };
      }),
    },
  };
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

journeyRouter.get('/api/journeys/:journeyId', asyncHandler(async (req, res) => {
  const journey = await loadJourney(String(req.params.journeyId));
  if (!journey) throw new HttpError(404, 'Parcours introuvable.');
  res.json({ journey: redactJourney(journey) });
}));

journeyRouter.post('/api/journeys/:journeyId/replay', asyncHandler(async (req, res) => {
  const journey = await loadJourney(String(req.params.journeyId));
  if (!journey) throw new HttpError(404, 'Parcours introuvable.');
  const missingSecrets = getMissingSensitiveStepIds(journey);
  if (missingSecrets.length > 0) {
    throw new HttpError(409, 'Ce parcours contient des secrets à réinjecter avant le rejeu.');
  }
  const runId = await startJourneyReplay(journey);
  if (!runId) throw new HttpError(429, 'Trop de rejeux sont déjà en cours. Réessayez plus tard.');
  res.status(202).json({ runId, journeyId: journey.id });
}));

journeyRouter.get('/api/journey-runs/:runId', asyncHandler(async (req, res) => {
  const run = await loadJourneyRun(String(req.params.runId));
  if (!run) throw new HttpError(404, 'Exécution de parcours introuvable.');
  res.json({ run: exposeJourneyRun(run) });
}));

journeyRouter.get('/api/journey-runs/:runId/screenshots/:filename', asyncHandler(async (req, res) => {
  let screenshot: Buffer | null;
  try {
    screenshot = await readJourneyScreenshot(String(req.params.runId), String(req.params.filename));
  } catch (error) {
    if (error instanceof Error && error.message.includes('invalide')) {
      throw new HttpError(400, error.message);
    }
    throw error;
  }
  if (!screenshot) throw new HttpError(404, 'Capture introuvable.');
  res.type('png').setHeader('Cache-Control', 'private, max-age=300').send(screenshot);
}));
