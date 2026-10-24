import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JourneyDefinition, JourneyEvidenceDecision, JourneyRunState } from '../../../core/journey/journey';

const fsMock = vi.hoisted(() => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  rename: vi.fn().mockResolvedValue(undefined),
  stat: vi.fn(),
  readFile: vi.fn(),
}));

vi.mock('node:fs/promises', () => fsMock);

import {
  getMissingSensitiveStepIds,
  MAX_JOURNEY_SCREENSHOT_BYTES,
  migrateJourneyRunState,
  readJourneyScreenshot,
  redactJourney,
  saveJourney,
  saveJourneyEvidenceDecision,
} from '../journey.store';

const journey: JourneyDefinition = {
  id: 'journey-001',
  name: 'Secret',
  startUrl: 'https://example.com',
  createdAt: new Date().toISOString(),
  steps: [{ id: 'step-1', action: 'fill', selector: '#password', value: 'secret-token', sensitive: true }],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('journey store', () => {
  it('ne persiste pas les valeurs sensibles en clair', async () => {
    await saveJourney(journey);

    const persisted = JSON.parse(fsMock.writeFile.mock.calls[0][1] as string) as JourneyDefinition;
    expect(JSON.stringify(persisted)).not.toContain('secret-token');
    expect(persisted.steps[0]).not.toHaveProperty('value');
    expect(persisted.steps[0].secretRef).toBeTypeOf('string');
  });

  it('retire la valeur et la référence secrète des réponses publiques', () => {
    const publicJourney = redactJourney({
      ...journey,
      steps: [{ ...journey.steps[0], secretRef: 'secret-ref' }],
    });

    expect(JSON.stringify(publicJourney)).not.toContain('secret-token');
    expect(JSON.stringify(publicJourney)).not.toContain('secret-ref');
    expect(publicJourney.requiresSecretInput).toBe(false);
  });

  it('signale une réinjection requise quand une valeur sensible manque', () => {
    const missing = { ...journey, steps: [{ ...journey.steps[0], value: undefined }] };

    expect(getMissingSensitiveStepIds(missing)).toEqual(['step-1']);
    expect(redactJourney(missing).requiresSecretInput).toBe(true);
  });

  it('refuse une capture qui dépasse la limite de taille', async () => {
    fsMock.stat.mockResolvedValue({ size: MAX_JOURNEY_SCREENSHOT_BYTES + 1 });

    await expect(readJourneyScreenshot('run-001', 'capture.png')).rejects.toThrow('volumineuse');
    expect(fsMock.readFile).not.toHaveBeenCalled();
  });

  it('remplace une décision de preuve et conserve sa version précédente', async () => {
    const previous: JourneyEvidenceDecision = {
      stepId: 'step-1',
      evidenceIndex: 0,
      criterionId: '1.1',
      status: 'not_tested',
      comment: '',
      reviewedAt: null,
    };
    const next: JourneyEvidenceDecision = {
      ...previous,
      status: 'compliant',
      comment: 'Vérifié',
      reviewedAt: new Date().toISOString(),
    };
    const run: JourneyRunState = {
      schemaVersion: 1,
      runId: 'run-001',
      journeyId: 'journey-001',
      journeyDefinitionHash: 'hash-run-001',
      status: 'completed',
      startedAt: new Date().toISOString(),
      run: {
        runId: 'run-001',
        journeyId: 'journey-001',
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        steps: [],
        decisions: [previous],
      },
    };
    fsMock.readFile.mockResolvedValueOnce(JSON.stringify(run));

    const updated = await saveJourneyEvidenceDecision('run-001', next);

    expect(updated?.run?.decisions).toEqual([next]);
    expect(updated?.run?.decisionHistory).toEqual([previous]);
    const persisted = JSON.parse(fsMock.writeFile.mock.calls[0][1] as string) as JourneyRunState;
    expect(persisted.run?.decisionHistory).toEqual([previous]);
  });

  it('migre une exécution legacy et rejette une structure corrompue', () => {
    const legacy = migrateJourneyRunState({
      runId: 'run-legacy',
      journeyId: 'journey-001',
      status: 'completed',
      startedAt: new Date().toISOString(),
      run: { steps: [] },
    }, 'run-legacy');

    expect(legacy).toMatchObject({
      schemaVersion: 1,
      journeyDefinitionHash: 'legacy',
      runId: 'run-legacy',
    });
    expect(migrateJourneyRunState({ runId: 'run-legacy', status: 'completed' }, 'run-legacy')).toBeNull();
  });
});
