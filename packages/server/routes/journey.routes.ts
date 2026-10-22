import { Router, type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import { basename, join, normalize } from 'node:path';
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
import { redactStructuredText, redactTextUrls, redactUrl } from '../security/url.redaction';
import { redactCollectedData, toPublicComparisons } from '../services/report.service';
import { compareCollectedData } from '../../core/report/comparison';

export const journeyRouter = Router();

function exposeJourneyRun(run: JourneyRunState): JourneyRunState {
  if (!run.run) return run.error ? { ...run, error: redactTextUrls(run.error) } : run;
  return {
    ...run,
    ...(run.error ? { error: redactTextUrls(run.error) } : {}),
    run: {
      ...run.run,
      comparisons: toPublicComparisons(compareCollectedData(run.run.steps.map((step, order) => ({
        observationId: `${run.runId}-${order}`,
        order,
        url: step.url,
        observedAt: step.observedAt,
        comparisonGroup: run.runId,
        stepId: step.stepId,
        collectedData: step.result?.collectedData ?? null,
      }))), run.runId),
      steps: run.run.steps.map((step) => {
        const { screenshotPath: _screenshotPath, ...stepWithoutScreenshotPath } = step;
        const publicObservation = {
          ...stepWithoutScreenshotPath,
          url: redactUrl(step.url),
          title: redactTextUrls(step.title),
          evidence: step.evidence.map((evidence) => ({
            ...evidence,
            html: redactTextUrls(evidence.html),
            context: evidence.context ? redactTextUrls(evidence.context) : evidence.context,
          })),
          ...(step.context ? {
            context: {
              ...step.context,
              urlBefore: redactUrl(step.context.urlBefore),
              urlAfter: redactUrl(step.context.urlAfter),
              titleBefore: redactTextUrls(step.context.titleBefore),
              titleAfter: redactTextUrls(step.context.titleAfter),
            },
          } : {}),
          ...(step.result ? {
            result: {
              ...step.result,
              url: redactUrl(step.result.url),
              error: step.result.error ? redactTextUrls(step.result.error) : step.result.error,
              axeResults: redactStructuredText(step.result.axeResults) as typeof step.result.axeResults,
              heuristicResults: redactStructuredText(step.result.heuristicResults) as typeof step.result.heuristicResults,
              collectedData: redactCollectedData(step.result.collectedData),
            },
          } : {}),
          ...(step.error ? { error: redactTextUrls(step.error) } : {}),
        };
        if (!step.screenshotPath) return publicObservation;
        const filename = basename(step.screenshotPath);
        const expectedSuffix = join('journeys', run.runId, 'screenshots', filename);
        if (!normalize(step.screenshotPath).endsWith(expectedSuffix)) {
          return { ...publicObservation, screenshotSkippedReason: 'capture_error' };
        }
        return {
          ...publicObservation,
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
    if (error instanceof Error && error.message.includes('volumineuse')) {
      throw new HttpError(413, error.message);
    }
    throw error;
  }
  if (!screenshot) throw new HttpError(404, 'Capture introuvable.');
  res.type('png').setHeader('Cache-Control', 'private, max-age=300').send(screenshot);
}));
