import { Router, type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import { basename, join, normalize } from 'node:path';
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
  saveJourney,
  saveJourneyEvidenceDecision,
} from '../services/journey.store';
import { startJourneyReplay } from '../services/journey.service';
import { redactStructuredText, redactTextUrls, redactUrl } from '../security/url.redaction';
import { redactCollectedData, toPublicComparisons } from '../services/report.service';
import { compareCollectedData } from '../../core/report/comparison';

export const journeyRouter = Router();

const journeyDecisionSchema = z.object({
  stepId: z.string().trim().min(1).max(128),
  evidenceIndex: z.number().int().min(0).max(500),
  criterionId: z.string().regex(/^\d{1,2}\.\d{1,2}$/),
  status: z.enum(['not_tested', 'compliant', 'non_compliant', 'not_applicable']),
  comment: z.string().trim().max(5_000).default(''),
});

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
      decisions: run.run.decisions?.map((decision) => ({
        ...decision,
        comment: redactTextUrls(decision.comment),
      })),
      decisionHistory: run.run.decisionHistory?.map((decision) => ({
        ...decision,
        comment: redactTextUrls(decision.comment),
      })),
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
