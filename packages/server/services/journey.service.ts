import { createHash, randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { JOURNEY_RUN_SCHEMA_VERSION, replayJourney, type JourneyDefinition, type JourneyRunState } from '../../core/journey/journey';
import { config } from '../config';
import { isPublicNetworkUrl } from '../security/url.policy';
import { saveJourneyRun } from './journey.store';

let activeReplays = 0;

/** Hash the definition while excluding only sensitive values and secret references. */
export function journeyDefinitionHash(journey: JourneyDefinition): string {
  const definition = {
    id: journey.id,
    name: journey.name,
    startUrl: journey.startUrl,
    steps: journey.steps.map((step) => {
      if (!step.sensitive) return step;
      const { value: _value, secretRef: _secretRef, ...safeStep } = step;
      return safeStep;
    }),
    createdAt: journey.createdAt,
  };
  return createHash('sha256').update(JSON.stringify(definition)).digest('hex');
}

export async function startJourneyReplay(journey: JourneyDefinition, options: { sessionId?: string } = {}): Promise<string | null> {
  if (activeReplays >= Math.max(1, config.journey.maxRunning)) return null;

  const runId = randomUUID();
  const startedAt = new Date().toISOString();
  const journeyDefinitionHashValue = journeyDefinitionHash(journey);
  const running: JourneyRunState = {
    schemaVersion: JOURNEY_RUN_SCHEMA_VERSION,
    runId,
    journeyId: journey.id,
    journeyDefinitionHash: journeyDefinitionHashValue,
    ...(options.sessionId ? { sessionId: options.sessionId } : {}),
    status: 'running',
    startedAt,
  };
  activeReplays += 1;
  try {
    await saveJourneyRun(running);
  } catch (error) {
    activeReplays -= 1;
    throw error;
  }

  void replayJourney(journey, {
    runId,
    sessionId: options.sessionId ?? runId,
    isRequestAllowed: isPublicNetworkUrl,
    screenshotDir: join(config.dataDir || join(homedir(), '.rgaaudit'), 'journeys', runId, 'screenshots'),
  }).then(async (run) => {
    const hasStepErrors = run.steps.some((step) => step.error);
    await saveJourneyRun({
      schemaVersion: JOURNEY_RUN_SCHEMA_VERSION,
      runId,
      journeyId: journey.id,
      journeyDefinitionHash: journeyDefinitionHashValue,
      ...(options.sessionId ? { sessionId: options.sessionId } : {}),
      status: hasStepErrors ? 'completed_with_errors' : 'completed',
      startedAt,
      finishedAt: run.finishedAt,
      run,
    });
  }).catch(async (error) => {
    await saveJourneyRun({
      schemaVersion: JOURNEY_RUN_SCHEMA_VERSION,
      runId,
      journeyId: journey.id,
      journeyDefinitionHash: journeyDefinitionHashValue,
      ...(options.sessionId ? { sessionId: options.sessionId } : {}),
      status: 'failed',
      startedAt,
      finishedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
    }).catch(() => undefined);
  }).finally(() => {
    activeReplays -= 1;
  });

  return runId;
}

export function getActiveJourneyReplays(): number {
  return activeReplays;
}
