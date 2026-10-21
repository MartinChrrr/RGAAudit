import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JourneyDefinition } from '../../../core/journey/journey';

const fsMock = vi.hoisted(() => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  rename: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn(),
}));

vi.mock('node:fs/promises', () => fsMock);

import { redactJourney, saveJourney } from '../journey.store';

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
  });
});
