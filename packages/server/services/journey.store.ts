import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import type { JourneyDefinition, JourneyRunState } from '../../core/journey/journey';
import { config } from '../config';
import { parseJourney } from './journey.validation';

const DATA_DIR = config.dataDir || join(homedir(), '.rgaaudit');
const JOURNEYS_DIR = join(DATA_DIR, 'journeys');
const SECRET_TTL_MS = 15 * 60 * 1_000;
const sensitiveValues = new Map<string, { value: string; expiresAt: number }>();

function assertSafeId(id: string): void {
  if (!/^[a-zA-Z0-9-]{1,128}$/.test(id)) throw new Error('Identifiant de parcours invalide.');
}

async function atomicWrite(path: string, value: unknown): Promise<void> {
  await mkdir(JOURNEYS_DIR, { recursive: true });
  const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, JSON.stringify(value, null, 2), 'utf-8');
  await rename(temporaryPath, path);
}

export function getJourneyPath(journeyId: string): string {
  assertSafeId(journeyId);
  return join(JOURNEYS_DIR, `journey-${journeyId}.json`);
}

export function getJourneyRunPath(runId: string): string {
  assertSafeId(runId);
  return join(JOURNEYS_DIR, `run-${runId}.json`);
}

export async function saveJourney(journey: JourneyDefinition): Promise<void> {
  const persisted: JourneyDefinition = {
    ...journey,
    steps: journey.steps.map((step) => {
      if (!step.sensitive || step.value === undefined) return step;
      const secretRef = step.secretRef ?? randomUUID();
      sensitiveValues.set(secretRef, { value: step.value, expiresAt: Date.now() + SECRET_TTL_MS });
      const { value: _value, ...withoutValue } = step;
      return { ...withoutValue, secretRef };
    }),
  };
  await atomicWrite(getJourneyPath(journey.id), persisted);
}

export async function loadJourney(journeyId: string): Promise<JourneyDefinition | null> {
  try {
    const parsed = parseJourney(JSON.parse(await readFile(getJourneyPath(journeyId), 'utf-8')));
    if (!parsed) return null;
    return {
      ...parsed,
      steps: parsed.steps.map((step) => {
        if (!step.sensitive || !step.secretRef) return step;
        const stored = sensitiveValues.get(step.secretRef);
        if (!stored || stored.expiresAt <= Date.now()) {
          sensitiveValues.delete(step.secretRef);
          return step;
        }
        return { ...step, value: stored.value };
      }),
    };
  } catch {
    return null;
  }
}

/** Removes sensitive fill values before a journey is returned by the API. */
export function redactJourney(journey: JourneyDefinition): Omit<JourneyDefinition, 'steps'> & {
  steps: Array<Omit<JourneyDefinition['steps'][number], 'value'> & { value?: string }>;
  requiresSecretInput: boolean;
} {
  return {
    ...journey,
    requiresSecretInput: journey.steps.some((step) => step.sensitive && step.value === undefined),
    steps: journey.steps.map((step) => {
      if (!step.sensitive) return step;
      const { value: _value, secretRef: _secretRef, ...safeStep } = step;
      return safeStep;
    }),
  };
}

/** Returns sensitive steps that cannot be replayed without a new secret injection. */
export function getMissingSensitiveStepIds(journey: JourneyDefinition): string[] {
  return journey.steps
    .filter((step) => step.sensitive && step.value === undefined)
    .map((step) => step.id);
}

export async function saveJourneyRun(run: JourneyRunState): Promise<void> {
  await atomicWrite(getJourneyRunPath(run.runId), run);
}

export async function loadJourneyRun(runId: string): Promise<JourneyRunState | null> {
  try {
    return JSON.parse(await readFile(getJourneyRunPath(runId), 'utf-8')) as JourneyRunState;
  } catch {
    return null;
  }
}
