import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { replayJourney, type JourneyDefinition, type JourneyRunState } from '../../core/journey/journey';
import { config } from '../config';
import { isPublicNetworkUrl } from '../security/url.policy';
import { saveJourneyRun } from './journey.store';

let activeReplays = 0;

export async function startJourneyReplay(journey: JourneyDefinition): Promise<string | null> {
  if (activeReplays >= Math.max(1, config.journey.maxRunning)) return null;

  const runId = randomUUID();
  const startedAt = new Date().toISOString();
  const running: JourneyRunState = { runId, journeyId: journey.id, status: 'running', startedAt };
  activeReplays += 1;
  try {
    await saveJourneyRun(running);
  } catch (error) {
    activeReplays -= 1;
    throw error;
  }

  void replayJourney(journey, {
    runId,
    sessionId: runId,
    isRequestAllowed: isPublicNetworkUrl,
    screenshotDir: join(config.dataDir || join(homedir(), '.rgaaudit'), 'journeys', runId, 'screenshots'),
  }).then(async (run) => {
    const hasStepErrors = run.steps.some((step) => step.error);
    await saveJourneyRun({
      runId,
      journeyId: journey.id,
      status: hasStepErrors ? 'completed_with_errors' : 'completed',
      startedAt,
      finishedAt: run.finishedAt,
      run,
    });
  }).catch(async (error) => {
    await saveJourneyRun({
      runId,
      journeyId: journey.id,
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
