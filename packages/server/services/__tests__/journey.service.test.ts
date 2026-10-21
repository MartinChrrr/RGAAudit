import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JourneyDefinition, JourneyRun } from '../../../core/journey/journey';

const { mockReplayJourney, mockSaveJourneyRun } = vi.hoisted(() => ({
  mockReplayJourney: vi.fn(),
  mockSaveJourneyRun: vi.fn(),
}));

vi.mock('../../../core/journey/journey', async () => {
  const actual = await vi.importActual<typeof import('../../../core/journey/journey')>('../../../core/journey/journey');
  return { ...actual, replayJourney: mockReplayJourney };
});

vi.mock('../journey.store', () => ({
  saveJourneyRun: mockSaveJourneyRun,
}));

import { getActiveJourneyReplays, startJourneyReplay } from '../journey.service';

const journey: JourneyDefinition = {
  id: 'journey-001',
  name: 'Test',
  startUrl: 'https://example.com',
  createdAt: new Date().toISOString(),
  steps: [{ id: 'step-1', action: 'wait', waitMs: 1 }],
};

function completedRun(hasError = false): JourneyRun {
  return {
    runId: 'run-001',
    journeyId: journey.id,
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    steps: [{
      stepId: 'step-1',
      action: 'wait',
      url: journey.startUrl,
      observedAt: new Date().toISOString(),
      title: 'Test',
      evidence: [],
      result: null,
      ...(hasError ? { error: 'Échec de l’étape.' } : {}),
    }],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSaveJourneyRun.mockResolvedValue(undefined);
  mockReplayJourney.mockResolvedValue(completedRun());
});

describe('startJourneyReplay', () => {
  it('enregistre running avant de lancer le rejeu puis completed', async () => {
    const runId = await startJourneyReplay(journey);

    expect(runId).toBeTypeOf('string');
    expect(mockSaveJourneyRun.mock.calls[0][0]).toMatchObject({ status: 'running', journeyId: journey.id });
    await vi.waitFor(() => expect(mockSaveJourneyRun).toHaveBeenCalledTimes(2));
    expect(mockSaveJourneyRun.mock.calls[1][0]).toMatchObject({ status: 'completed', journeyId: journey.id });
    await vi.waitFor(() => expect(getActiveJourneyReplays()).toBe(0));
  });

  it('signale completed_with_errors quand une étape a échoué', async () => {
    mockReplayJourney.mockResolvedValue(completedRun(true));

    await startJourneyReplay(journey);
    await vi.waitFor(() => expect(mockSaveJourneyRun).toHaveBeenCalledTimes(2));

    expect(mockSaveJourneyRun.mock.calls[1][0]).toMatchObject({ status: 'completed_with_errors' });
  });

  it('refuse un rejeu concurrent au-delà de la limite', async () => {
    let resolveReplay: ((run: JourneyRun) => void) | undefined;
    mockReplayJourney.mockReturnValue(new Promise<JourneyRun>((resolve) => { resolveReplay = resolve; }));

    const first = await startJourneyReplay(journey);
    const second = await startJourneyReplay({ ...journey, id: 'journey-002' });

    expect(first).toBeTypeOf('string');
    expect(second).toBeNull();
    resolveReplay!(completedRun());
    await vi.waitFor(() => expect(getActiveJourneyReplays()).toBe(0));
  });
});
