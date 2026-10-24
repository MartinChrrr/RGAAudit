import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { JOURNEY_RUN_SCHEMA_VERSION, type JourneyDefinition, type JourneyEvidenceDecision, type JourneyRunState } from '../../core/journey/journey';
import { config } from '../config';
import { parseJourney } from './journey.validation';
import { redactUrl } from '../security/url.redaction';

const DATA_DIR = config.dataDir || join(homedir(), '.rgaaudit');
const JOURNEYS_DIR = join(DATA_DIR, 'journeys');
const SECRET_TTL_MS = 15 * 60 * 1_000;
export const MAX_JOURNEY_SCREENSHOT_BYTES = 2_000_000;
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

export function getJourneyScreenshotPath(runId: string, filename: string): string {
  assertSafeId(runId);
  if (!/^[a-zA-Z0-9_-]{1,128}\.png$/.test(filename)) {
    throw new Error('Nom de capture invalide.');
  }
  return join(JOURNEYS_DIR, runId, 'screenshots', filename);
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
    startUrl: redactUrl(journey.startUrl),
    requiresSecretInput: journey.steps.some((step) => step.sensitive && step.value === undefined),
    steps: journey.steps.map((step) => {
      if (!step.sensitive) return step.url ? { ...step, url: redactUrl(step.url) } : step;
      const { value: _value, secretRef: _secretRef, ...safeStep } = step;
      return safeStep.url ? { ...safeStep, url: redactUrl(safeStep.url) } : safeStep;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isJourneyEvidenceDecision(value: unknown): value is JourneyEvidenceDecision {
  if (!isRecord(value)) return false;
  return typeof value.stepId === 'string'
    && Number.isInteger(value.evidenceIndex)
    && typeof value.criterionId === 'string'
    && ['not_tested', 'compliant', 'non_compliant', 'not_applicable'].includes(String(value.status))
    && typeof value.comment === 'string'
    && (value.reviewedAt === null || typeof value.reviewedAt === 'string');
}

/** Migrate and minimally validate persisted runs before exposing them to routes. */
export function migrateJourneyRunState(value: unknown, expectedRunId: string): JourneyRunState | null {
  if (!isRecord(value)) return null;
  if (value.runId !== expectedRunId || typeof value.journeyId !== 'string' || typeof value.startedAt !== 'string') return null;
  if (!['running', 'completed', 'completed_with_errors', 'failed'].includes(String(value.status))) return null;
  const rawVersion = typeof value.schemaVersion === 'number' ? value.schemaVersion : 0;
  if (rawVersion > JOURNEY_RUN_SCHEMA_VERSION) return null;

  const rawRun = value.run;
  if (rawRun !== undefined) {
    if (!isRecord(rawRun) || !Array.isArray(rawRun.steps)) return null;
    if (rawRun.steps.some((step) => !isRecord(step) || typeof step.stepId !== 'string' || !Array.isArray(step.evidence))) {
      return null;
    }
  }

  const run = rawRun && isRecord(rawRun)
    ? {
      ...rawRun,
      ...(Array.isArray(rawRun.decisions)
        ? { decisions: rawRun.decisions.filter(isJourneyEvidenceDecision) }
        : {}),
      ...(Array.isArray(rawRun.decisionHistory)
        ? { decisionHistory: rawRun.decisionHistory.filter(isJourneyEvidenceDecision) }
        : {}),
    }
    : undefined;

  return {
    ...value,
    schemaVersion: JOURNEY_RUN_SCHEMA_VERSION,
    journeyDefinitionHash: typeof value.journeyDefinitionHash === 'string' && value.journeyDefinitionHash.length > 0
      ? value.journeyDefinitionHash
      : 'legacy',
    ...(typeof value.sessionId === 'string' ? { sessionId: value.sessionId } : {}),
    ...(run ? { run } : {}),
  } as JourneyRunState;
}

/** Persist one human decision while retaining the replaced value in the run audit trail. */
export async function saveJourneyEvidenceDecision(
  runId: string,
  decision: JourneyEvidenceDecision,
): Promise<JourneyRunState | null> {
  const run = await loadJourneyRun(runId);
  if (!run?.run) return null;

  const decisions = run.run.decisions ?? (run.run.decisions = []);
  const decisionIndex = decisions.findIndex((current) => (
    current.stepId === decision.stepId
    && current.evidenceIndex === decision.evidenceIndex
    && current.criterionId === decision.criterionId
  ));
  if (decisionIndex === -1) {
    decisions.push(decision);
  } else {
    const history = run.run.decisionHistory ?? (run.run.decisionHistory = []);
    history.push(decisions[decisionIndex]);
    decisions[decisionIndex] = decision;
  }
  await saveJourneyRun(run);
  return run;
}

export async function loadJourneyRun(runId: string): Promise<JourneyRunState | null> {
  try {
    return migrateJourneyRunState(JSON.parse(await readFile(getJourneyRunPath(runId), 'utf-8')), runId);
  } catch {
    return null;
  }
}

export async function readJourneyScreenshot(runId: string, filename: string): Promise<Buffer | null> {
  try {
    const screenshotPath = getJourneyScreenshotPath(runId, filename);
    const fileStats = await stat(screenshotPath);
    if (fileStats.size > MAX_JOURNEY_SCREENSHOT_BYTES) {
      throw new Error('Capture trop volumineuse.');
    }
    return await readFile(screenshotPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}
