import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JourneyDefinition, JourneyRunState } from '../../../core/journey/journey';
import { errorHandler } from '../../middleware/error.handler';

const {
  mockSaveJourney,
  mockLoadJourney,
  mockLoadJourneyRun,
  mockReadJourneyScreenshot,
  mockSaveJourneyEvidenceDecision,
  mockRedactJourney,
  mockRedactJourneyForEditor,
  mockGetMissingSensitiveStepIds,
  mockStartJourneyReplay,
  mockLoadSession,
} = vi.hoisted(() => ({
  mockSaveJourney: vi.fn(),
  mockLoadJourney: vi.fn(),
  mockLoadJourneyRun: vi.fn(),
  mockReadJourneyScreenshot: vi.fn(),
  mockSaveJourneyEvidenceDecision: vi.fn(),
  mockGetMissingSensitiveStepIds: vi.fn<(journey: JourneyDefinition) => string[]>(() => []),
  mockRedactJourney: vi.fn((journey: JourneyDefinition) => ({
    ...journey,
    steps: journey.steps.map((step) => step.sensitive ? { ...step, value: undefined } : step),
  })),
  mockRedactJourneyForEditor: vi.fn((journey: JourneyDefinition) => ({ ...journey, requiresSecretInput: false })),
  mockStartJourneyReplay: vi.fn(),
  mockLoadSession: vi.fn(),
}));

vi.mock('../../services/journey.store', () => ({
  saveJourney: mockSaveJourney,
  loadJourney: mockLoadJourney,
  loadJourneyRun: mockLoadJourneyRun,
  readJourneyScreenshot: mockReadJourneyScreenshot,
  saveJourneyEvidenceDecision: mockSaveJourneyEvidenceDecision,
  getMissingSensitiveStepIds: mockGetMissingSensitiveStepIds,
  redactJourney: mockRedactJourney,
  redactJourneyForEditor: mockRedactJourneyForEditor,
}));

vi.mock('../../services/journey.service', () => ({
  startJourneyReplay: mockStartJourneyReplay,
}));

vi.mock('../../services/session.store', () => ({
  loadSession: mockLoadSession,
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
  mockReadJourneyScreenshot.mockResolvedValue(null);
  mockSaveJourneyEvidenceDecision.mockResolvedValue(null);
  mockGetMissingSensitiveStepIds.mockReturnValue([]);
  mockStartJourneyReplay.mockReturnValue('run-001');
  mockLoadSession.mockResolvedValue(null);
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

  it('refuse les identifiants d’étapes dupliqués', async () => {
    const response = await request(app).post('/api/journeys').send({
      name: 'Parcours dupliqué',
      startUrl: 'https://example.com',
      steps: [
        { id: 'same-step', action: 'wait', waitMs: 1 },
        { id: 'same-step', action: 'wait', waitMs: 1 },
      ],
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('uniques');
    expect(mockSaveJourney).not.toHaveBeenCalled();
  });

  it('ignore une référence de secret fournie par le client', async () => {
    const response = await request(app).post('/api/journeys').send({
      name: 'Parcours sensible',
      startUrl: 'https://example.com',
      steps: [{ action: 'fill', selector: '#password', sensitive: true, secretRef: 'client-secret-ref' }],
    });

    expect(response.status).toBe(201);
    expect(mockSaveJourney).toHaveBeenCalledWith(expect.objectContaining({
      steps: [expect.not.objectContaining({ secretRef: 'client-secret-ref' })],
    }));
  });
});

describe('PUT /api/journeys/:journeyId', () => {
  it('met à jour le parcours en conservant son identifiant et sa date', async () => {
    const current: JourneyDefinition = {
      id: 'journey-001',
      name: 'Ancien nom',
      startUrl: 'https://example.com',
      steps: [{ id: 'step-1', action: 'wait', waitMs: 10 }],
      createdAt: '2026-10-20T00:00:00.000Z',
    };
    mockLoadJourney.mockResolvedValue(current);

    const response = await request(app).put('/api/journeys/journey-001').send({
      name: 'Parcours modifié',
      startUrl: 'https://example.com/start',
      steps: [{ id: 'step-1', action: 'click', selector: '#continue' }],
    });

    expect(response.status).toBe(200);
    expect(mockSaveJourney).toHaveBeenCalledWith(expect.objectContaining({
      id: 'journey-001',
      name: 'Parcours modifié',
      createdAt: current.createdAt,
      steps: [{ id: 'step-1', action: 'click', selector: '#continue' }],
    }));
  });

  it('retourne 404 si le parcours à modifier n’existe pas', async () => {
    const response = await request(app).put('/api/journeys/missing').send({
      name: 'Absent',
      startUrl: 'https://example.com',
      steps: [{ action: 'wait', waitMs: 1 }],
    });

    expect(response.status).toBe(404);
    expect(mockSaveJourney).not.toHaveBeenCalled();
  });

  it('conserve la référence d’un secret quand l’interface ne renvoie pas sa valeur', async () => {
    mockLoadJourney.mockResolvedValue({
      id: 'journey-001',
      name: 'Connexion',
      startUrl: 'https://example.com',
      steps: [{ id: 'step-1', action: 'fill', selector: '#password', sensitive: true, secretRef: 'secret-1', value: 'secret' }],
      createdAt: '2026-10-20T00:00:00.000Z',
    });

    const response = await request(app).put('/api/journeys/journey-001').send({
      name: 'Connexion',
      startUrl: 'https://example.com',
      steps: [{ id: 'step-1', action: 'fill', selector: '#password', sensitive: true }],
    });

    expect(response.status).toBe(200);
    expect(mockSaveJourney).toHaveBeenCalledWith(expect.objectContaining({
      steps: [{ id: 'step-1', action: 'fill', selector: '#password', sensitive: true, secretRef: 'secret-1' }],
    }));
  });
});

describe('GET /api/journeys/:journeyId', () => {
  it('utilise la sérialisation privée pour l’éditeur explicite', async () => {
    const journey: JourneyDefinition = {
      id: 'journey-001',
      name: 'Connexion',
      startUrl: 'https://example.com/start?token=private',
      steps: [{ id: 'step-1', action: 'navigate', url: 'https://example.com/next?state=private' }],
      createdAt: new Date().toISOString(),
    };
    mockLoadJourney.mockResolvedValue(journey);

    const response = await request(app).get('/api/journeys/journey-001?view=editor');

    expect(response.status).toBe(200);
    expect(mockRedactJourneyForEditor).toHaveBeenCalledWith(journey);
    expect(mockRedactJourney).not.toHaveBeenCalled();
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

  it('rattache le rejeu à une session existante', async () => {
    const journey: JourneyDefinition = {
      id: 'journey-001',
      name: 'Connexion',
      startUrl: 'https://example.com',
      steps: [{ id: 'step-1', action: 'wait', waitMs: 10 }],
      createdAt: new Date().toISOString(),
    };
    mockLoadJourney.mockResolvedValue(journey);
    mockLoadSession.mockResolvedValue({ sessionId: 'session-001' });

    const response = await request(app)
      .post('/api/journeys/journey-001/replay')
      .send({ sessionId: 'session-001' });

    expect(response.status).toBe(202);
    expect(response.body).toMatchObject({ runId: 'run-001', journeyId: 'journey-001', sessionId: 'session-001' });
    expect(mockStartJourneyReplay).toHaveBeenCalledWith(journey, { sessionId: 'session-001' });
  });

  it('refuse de rattacher le rejeu à une session absente', async () => {
    const journey: JourneyDefinition = {
      id: 'journey-001',
      name: 'Connexion',
      startUrl: 'https://example.com',
      steps: [{ id: 'step-1', action: 'wait', waitMs: 10 }],
      createdAt: new Date().toISOString(),
    };
    mockLoadJourney.mockResolvedValue(journey);

    const response = await request(app)
      .post('/api/journeys/journey-001/replay')
      .send({ sessionId: 'missing-session' });

    expect(response.status).toBe(404);
    expect(mockStartJourneyReplay).not.toHaveBeenCalled();
  });

  it('refuse un rejeu quand un secret doit être réinjecté', async () => {
    const journey: JourneyDefinition = {
      id: 'journey-001',
      name: 'Connexion',
      startUrl: 'https://example.com',
      steps: [{ id: 'step-1', action: 'fill', selector: '#password', sensitive: true }],
      createdAt: new Date().toISOString(),
    };
    mockLoadJourney.mockResolvedValue(journey);
    mockGetMissingSensitiveStepIds.mockReturnValue(['step-1']);

    const response = await request(app).post('/api/journeys/journey-001/replay');

    expect(response.status).toBe(409);
    expect(response.body.error).toContain('secrets à réinjecter');
    expect(mockStartJourneyReplay).not.toHaveBeenCalled();
  });

  it('retourne le statut et les observations d’une exécution', async () => {
    const run: JourneyRunState = {
      schemaVersion: 1,
      runId: 'run-001',
      journeyId: 'journey-001',
      journeyDefinitionHash: 'hash-run-001',
      status: 'completed',
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      run: {
        runId: 'run-001',
        journeyId: 'journey-001',
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        steps: [{
          stepId: 'step-1',
          action: 'click',
          url: 'https://example.com',
          observedAt: new Date().toISOString(),
          title: 'Accueil',
          evidence: [],
          result: null,
          screenshotPath: '/var/lib/rgaaudit/journeys/run-001/screenshots/000-context-step.png',
        }],
      },
    };
    mockLoadJourneyRun.mockResolvedValue(run);

    const response = await request(app).get('/api/journey-runs/run-001');

    expect(response.status).toBe(200);
    expect(response.body.run).toMatchObject({
      runId: run.runId,
      run: {
        steps: [{
          screenshotUrl: '/api/journey-runs/run-001/screenshots/000-context-step.png',
        }],
      },
    });
    expect(JSON.stringify(response.body)).not.toContain('screenshotPath');
  });

  it('expose la comparaison ordonnée des étapes sans données internes', async () => {
    const timestamp = new Date().toISOString();
    const run: JourneyRunState = {
      schemaVersion: 1,
      runId: 'run-comparison',
      journeyId: 'journey-001',
      journeyDefinitionHash: 'hash-run-comparison',
      status: 'completed',
      startedAt: timestamp,
      finishedAt: timestamp,
      run: {
        runId: 'run-comparison',
        journeyId: 'journey-001',
        startedAt: timestamp,
        finishedAt: timestamp,
        steps: [
          {
            stepId: 'step-before',
            action: 'navigate',
            url: 'https://example.com/before?token=secret-before',
            observedAt: timestamp,
            title: 'Avant',
            evidence: [],
            result: null,
          },
          {
            stepId: 'step-after',
            action: 'click',
            url: 'https://example.com/after?token=secret-after',
            observedAt: timestamp,
            title: 'Après',
            evidence: [],
            result: null,
          },
        ],
      },
    };
    mockLoadJourneyRun.mockResolvedValue(run);

    const response = await request(app).get('/api/journey-runs/run-comparison');

    expect(response.status).toBe(200);
    expect(response.body.run.run.comparisons).toMatchObject([{
      before: {
        url: 'https://example.com/before',
        pageId: expect.stringMatching(/^page-[0-9a-f]{32}$/),
        stepId: 'step-before',
      },
      after: {
        url: 'https://example.com/after',
        pageId: expect.stringMatching(/^page-[0-9a-f]{32}$/),
        stepId: 'step-after',
      },
      changed: true,
    }]);
    expect(JSON.stringify(response.body)).not.toContain('secret-before');
    expect(JSON.stringify(response.body)).not.toContain('run-comparison-0');
  });

  it('enregistre une décision humaine sur une preuve de parcours', async () => {
    const timestamp = new Date().toISOString();
    const run: JourneyRunState = {
      schemaVersion: 1,
      runId: 'run-review',
      journeyId: 'journey-001',
      journeyDefinitionHash: 'hash-run-review',
      status: 'completed',
      startedAt: timestamp,
      finishedAt: timestamp,
      run: {
        runId: 'run-review',
        journeyId: 'journey-001',
        startedAt: timestamp,
        finishedAt: timestamp,
        steps: [{
          stepId: 'step-1',
          action: 'click',
          url: 'https://example.com',
          observedAt: timestamp,
          title: 'Accueil',
          evidence: [{
            selector: '#main',
            html: '<main id="main">Accueil</main>',
            resultId: 'result-1',
            proofId: 'proof-1',
            criterionIds: ['1.1'],
            elementIndex: 0,
          }],
          result: null,
        }],
      },
    };
    const decision = {
      stepId: 'step-1',
      evidenceIndex: 0,
      criterionId: '1.1',
      status: 'compliant',
      comment: 'Vérifié par l’auditeur',
      reviewedAt: timestamp,
    } as const;
    mockLoadJourneyRun.mockResolvedValue(run);
    mockSaveJourneyEvidenceDecision.mockResolvedValue({
      ...run,
      run: { ...run.run!, decisions: [decision] },
    });

    const response = await request(app).patch('/api/journey-runs/run-review/decision').send({
      stepId: 'step-1',
      evidenceIndex: 0,
      criterionId: '1.1',
      status: 'compliant',
      comment: 'Vérifié par l’auditeur',
    });

    expect(response.status).toBe(200);
    expect(mockSaveJourneyEvidenceDecision).toHaveBeenCalledWith('run-review', expect.objectContaining({
      ...decision,
      reviewedAt: expect.any(String),
    }));
    expect(response.body.run.run.decisions).toEqual([expect.objectContaining({ criterionId: '1.1', status: 'compliant' })]);
  });

  it('refuse une décision qui ne correspond pas à la preuve observée', async () => {
    mockLoadJourneyRun.mockResolvedValue({
      runId: 'run-review',
      journeyId: 'journey-001',
      status: 'completed',
      startedAt: new Date().toISOString(),
      run: {
        runId: 'run-review',
        journeyId: 'journey-001',
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        steps: [{
          stepId: 'step-1',
          action: 'click',
          url: 'https://example.com',
          observedAt: new Date().toISOString(),
          title: 'Accueil',
          evidence: [],
          result: null,
        }],
      },
    });

    const response = await request(app).patch('/api/journey-runs/run-review/decision').send({
      stepId: 'step-1',
      evidenceIndex: 0,
      criterionId: '1.1',
      status: 'compliant',
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('preuve');
    expect(mockSaveJourneyEvidenceDecision).not.toHaveBeenCalled();
  });

  it('sert une capture de contexte sans exposer le chemin serveur', async () => {
    mockReadJourneyScreenshot.mockResolvedValue(Buffer.from('png-bytes'));

    const response = await request(app)
      .get('/api/journey-runs/run-001/screenshots/000-context-step.png');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('image/png');
    expect(response.body).toEqual(Buffer.from('png-bytes'));
    expect(mockReadJourneyScreenshot).toHaveBeenCalledWith('run-001', '000-context-step.png');
  });

  it('refuse un nom de capture non borné', async () => {
    const response = await request(app)
      .get('/api/journey-runs/run-001/screenshots/../../secrets.txt');

    expect(response.status).toBe(404);
    expect(mockReadJourneyScreenshot).not.toHaveBeenCalled();
  });
});
