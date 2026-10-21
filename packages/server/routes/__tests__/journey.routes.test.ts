import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JourneyDefinition, JourneyRunState } from '../../../core/journey/journey';
import { errorHandler } from '../../middleware/error.handler';

const {
  mockSaveJourney,
  mockLoadJourney,
  mockLoadJourneyRun,
  mockRedactJourney,
  mockStartJourneyReplay,
} = vi.hoisted(() => ({
  mockSaveJourney: vi.fn(),
  mockLoadJourney: vi.fn(),
  mockLoadJourneyRun: vi.fn(),
  mockRedactJourney: vi.fn((journey: JourneyDefinition) => ({
    ...journey,
    steps: journey.steps.map((step) => step.sensitive ? { ...step, value: undefined } : step),
  })),
  mockStartJourneyReplay: vi.fn(),
}));

vi.mock('../../services/journey.store', () => ({
  saveJourney: mockSaveJourney,
  loadJourney: mockLoadJourney,
  loadJourneyRun: mockLoadJourneyRun,
  redactJourney: mockRedactJourney,
}));

vi.mock('../../services/journey.service', () => ({
  startJourneyReplay: mockStartJourneyReplay,
}));

import { journeyRouter } from '../journey.routes';

const app = express();
app.use(express.json());
app.use(journeyRouter);
app.use(errorHandler);

beforeEach(() => {
  vi.clearAllMocks();
  mockSaveJourney.mockResolvedValue(undefined);
  mockLoadJourney.mockResolvedValue(null);
  mockLoadJourneyRun.mockResolvedValue(null);
  mockStartJourneyReplay.mockReturnValue('run-001');
});

describe('POST /api/journeys', () => {
  it('crée un parcours et génère les identifiants manquants', async () => {
    const response = await request(app).post('/api/journeys').send({
      name: 'Connexion',
      startUrl: 'https://example.com',
      steps: [
        { action: 'click', selector: '#login' },
        { action: 'fill', selector: '#email', value: 'user@example.com', sensitive: true },
      ],
    });

    expect(response.status).toBe(201);
    expect(response.body.journey).toMatchObject({
      name: 'Connexion',
      startUrl: 'https://example.com',
      steps: [
        { id: 'step-1', action: 'click', selector: '#login' },
        { id: 'step-2', action: 'fill', selector: '#email', sensitive: true },
      ],
    });
    expect(mockSaveJourney).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Connexion',
      steps: expect.arrayContaining([
        expect.objectContaining({ action: 'fill', value: 'user@example.com', sensitive: true }),
      ]),
    }));
    expect(JSON.stringify(response.body)).not.toContain('user@example.com');
  });

  it('refuse une étape qui ne contient pas les paramètres de son action', async () => {
    const response = await request(app).post('/api/journeys').send({
      name: 'Parcours invalide',
      startUrl: 'https://example.com',
      steps: [{ action: 'press', selector: '#email' }],
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('touche');
    expect(mockSaveJourney).not.toHaveBeenCalled();
  });
});

describe('journey replay and run retrieval', () => {
  it('démarre un rejeu et expose son identifiant', async () => {
    const journey: JourneyDefinition = {
      id: 'journey-001',
      name: 'Connexion',
      startUrl: 'https://example.com',
      steps: [{ id: 'step-1', action: 'wait', waitMs: 10 }],
      createdAt: new Date().toISOString(),
    };
    mockLoadJourney.mockResolvedValue(journey);

    const response = await request(app).post('/api/journeys/journey-001/replay');

    expect(response.status).toBe(202);
    expect(response.body).toEqual({ runId: 'run-001', journeyId: 'journey-001' });
    expect(mockStartJourneyReplay).toHaveBeenCalledWith(journey);
  });

  it('retourne 429 quand la limite de rejeux est atteinte', async () => {
    const journey: JourneyDefinition = {
      id: 'journey-001',
      name: 'Connexion',
      startUrl: 'https://example.com',
      steps: [{ id: 'step-1', action: 'wait', waitMs: 10 }],
      createdAt: new Date().toISOString(),
    };
    mockLoadJourney.mockResolvedValue(journey);
    mockStartJourneyReplay.mockResolvedValue(null);

    const response = await request(app).post('/api/journeys/journey-001/replay');

    expect(response.status).toBe(429);
    expect(response.body.error).toContain('Trop de rejeux');
  });

  it('retourne le statut et les observations d’une exécution', async () => {
    const run: JourneyRunState = {
      runId: 'run-001',
      journeyId: 'journey-001',
      status: 'completed',
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      run: {
        runId: 'run-001',
        journeyId: 'journey-001',
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        steps: [],
      },
    };
    mockLoadJourneyRun.mockResolvedValue(run);

    const response = await request(app).get('/api/journey-runs/run-001');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ run });
  });
});
