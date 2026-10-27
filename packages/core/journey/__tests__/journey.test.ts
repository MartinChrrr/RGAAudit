import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import http from 'node:http';
import fs from 'node:fs';
import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { replayJourney, type JourneyDefinition } from '../journey';

const FIXTURE_PATH = path.resolve(__dirname, '../../../../e2e/fixtures/test-sites/journey.html');
const US31_FIXTURE_PATH = path.resolve(__dirname, '../../../../e2e/fixtures/test-sites/journey/us-31-controlled-interactions.html');
const US46_FIXTURE_PATH = path.resolve(__dirname, '../../../../e2e/fixtures/test-sites/journey/us-46-context-disclosures.html');
const US47_FIXTURE_PATH = path.resolve(__dirname, '../../../../e2e/fixtures/test-sites/journey/us-47-consultation-evidence.html');
const US48_FIXTURE_PATH = path.resolve(__dirname, '../../../../e2e/fixtures/test-sites/journey/us-48-script-controls.html');
const US28_FIXTURE_PATH = path.resolve(__dirname, '../../../../e2e/fixtures/test-sites/journey/us-28-tab-animation-cryptic.html');
let server: http.Server;
let baseUrl: string;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    const fixture = req.url === '/journey.html'
      ? FIXTURE_PATH
      : req.url === '/us-31-controlled-interactions.html'
        ? US31_FIXTURE_PATH
        : req.url === '/journey/us-46-context-disclosures.html'
          ? US46_FIXTURE_PATH
          : req.url === '/journey/us-47-consultation-evidence.html'
            ? US47_FIXTURE_PATH
            : req.url === '/journey/us-48-script-controls.html'
              ? US48_FIXTURE_PATH
              : req.url === '/journey/us-28-tab-animation-cryptic.html'
                ? US28_FIXTURE_PATH
        : null;
    if (!fixture) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(fs.readFileSync(fixture, 'utf-8'));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Fixture server unavailable.');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

describe('replayJourney', () => {
  it('rejoue les actions et conserve une observation avec preuve et audit par étape', async () => {
    const screenshotDir = await mkdtemp(path.join(os.tmpdir(), 'rgaudit-sensitive-'));
    const journey: JourneyDefinition = {
      id: 'journey-test',
      name: 'Parcours de test',
      startUrl: `${baseUrl}/journey.html`,
      createdAt: new Date().toISOString(),
      steps: [
        { id: 'step-1', action: 'click', selector: '#next' },
        { id: 'step-2', action: 'press', selector: '#next', key: 'Tab' },
        { id: 'step-3', action: 'fill', selector: '#name', value: 'Martin', sensitive: true },
        { id: 'step-4', action: 'press', selector: '#name', key: 'Enter' },
        { id: 'step-5', action: 'click', selector: '#blocked' },
        { id: 'step-6', action: 'press', selector: '#blocked', key: 'Tab' },
        { id: 'step-7', action: 'wait', waitMs: 1 },
      ],
    };

    const run = await replayJourney(journey, {
      timeout: 10_000,
      screenshotDir,
      isRequestAllowed: async (url) => url.startsWith(baseUrl),
    });

    expect(run.steps).toHaveLength(7);
    expect(run.steps.every((step) => step.result)).toBe(true);
    expect(run.steps[0]).toMatchObject({
      stepId: 'step-1',
      action: 'click',
      url: `${baseUrl}/journey.html`,
    });
    expect(run.steps[0].evidence).toEqual(expect.arrayContaining([
      expect.objectContaining({
        selector: '#next',
        html: expect.stringContaining('Afficher la suite'),
        resultId: expect.stringContaining('journey-result-'),
        proofId: expect.stringContaining('-proof-0'),
        criterionIds: expect.any(Array),
        elementIndex: 0,
      }),
    ]));
    expect(run.steps[2].evidence[0]?.html).toContain('id="name"');
    expect(run.steps[2].evidence[0]?.html).toContain('data-rgaudit-redacted="true"');
    expect(run.steps[2].evidence[0]?.html).not.toContain('Martin');
    expect(run.steps[2].screenshotPath).toBeUndefined();
    expect(run.steps[2].screenshotSkippedReason).toBe('sensitive_step');
    expect(run.steps.slice(3).every((step) => step.screenshotPath === undefined)).toBe(true);
    expect(run.steps[0].result?.collectedData).not.toBeNull();
    expect(run.steps[1].keyboard).toMatchObject({
      key: 'Tab',
      componentSelector: '#next',
      exited: true,
      blocked: false,
      requiresHumanReview: true,
      after: expect.objectContaining({ selector: '#name', withinComponent: false }),
    });
    expect(run.steps[1].keyboard?.after?.focusVisible).toEqual(expect.any(Boolean));
    expect(run.steps[1].keyboard?.viewport).toEqual(expect.objectContaining({ width: expect.any(Number), height: expect.any(Number) }));
    expect(run.steps[3].keyboard).toMatchObject({ key: 'Enter', componentSelector: '#name' });
    expect(run.steps[5].keyboard).toMatchObject({
      key: 'Tab',
      componentSelector: '#blocked',
      blocked: true,
      requiresHumanReview: true,
      criterionIds: expect.arrayContaining(['7.3', '12.9']),
      after: expect.objectContaining({ selector: '#blocked', withinComponent: true }),
    });
    expect(run.finishedAt).toBeDefined();
  }, 30_000);

  it('consigne les changements de contexte et capture une preuve visuelle', async () => {
    const screenshotDir = await mkdtemp(path.join(os.tmpdir(), 'rgaudit-journey-'));
    const journey: JourneyDefinition = {
      id: 'journey-context',
      name: 'Contexte',
      startUrl: `${baseUrl}/journey.html`,
      createdAt: new Date().toISOString(),
      steps: [{ id: 'context-step', action: 'click', selector: '#context' }],
    };

    const run = await replayJourney(journey, {
      timeout: 10_000,
      screenshotDir,
      isRequestAllowed: async (url) => url.startsWith(baseUrl),
    });

    const observation = run.steps[0].context;
    expect(observation).toMatchObject({
      changed: true,
      trigger: { stepId: 'context-step', action: 'click', selector: '#context' },
      changeTypes: expect.arrayContaining(['navigation', 'title', 'live-region']),
      criterionIds: expect.arrayContaining(['7.4', '7.5', '13.8']),
      requiresHumanReview: true,
    });
    expect(observation?.disruptions).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'motion', selector: '#motion' }),
    ]));
    expect(run.steps[0].screenshotPath).toBe(path.join(screenshotDir, '000-context-step.png'));
    const screenshot = await readFile(run.steps[0].screenshotPath!);
    expect(screenshot.length).toBeGreaterThan(0);
  }, 30_000);

  it('observe les divulgations contrôlées et les retours de statut', async () => {
    const journey: JourneyDefinition = {
      id: 'journey-us46',
      name: 'Changements et divulgations',
      startUrl: `${baseUrl}/journey/us-46-context-disclosures.html`,
      createdAt: new Date().toISOString(),
      steps: [
        { id: 'open-filters', action: 'click', selector: '#disclosure' },
        { id: 'refresh-status', action: 'click', selector: '#feedback' },
      ],
    };

    const run = await replayJourney(journey, {
      timeout: 10_000,
      isRequestAllowed: async (url) => url.startsWith(baseUrl),
    });

    expect(run.steps[0]?.context).toMatchObject({
      changed: true,
      changeTypes: expect.arrayContaining(['disclosure']),
      criterionIds: expect.arrayContaining(['10.13']),
      disclosures: [expect.objectContaining({
        kind: 'aria-expanded',
        selector: '#disclosure',
      })],
    });
    expect(run.steps[0]?.context?.disclosures?.[0]?.detail).toContain('#filters=visible');
    expect(run.steps[1]?.context).toMatchObject({
      changed: true,
      changeTypes: expect.arrayContaining(['live-region']),
      criterionIds: expect.arrayContaining(['7.5']),
    });
  }, 30_000);

  it('journalise les flashs, gestes pointer et APIs de mouvement comme scénarios manuels', async () => {
    const journey: JourneyDefinition = {
      id: 'journey-us31',
      name: 'Interactions contrôlées',
      startUrl: `${baseUrl}/us-31-controlled-interactions.html`,
      createdAt: new Date().toISOString(),
      steps: [{ id: 'gesture-step', action: 'click', selector: '#gesture' }],
    };

    const run = await replayJourney(journey, {
      timeout: 10_000,
      isRequestAllowed: async (url) => url.startsWith(baseUrl),
    });

    const observation = run.steps[0].context;
    expect(observation?.disruptions).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'flash', selector: '#flash' }),
    ]));
    expect(observation?.interactions).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'single-pointer', criterionIds: ['13.11'] }),
      expect.objectContaining({ kind: 'complex-gesture', criterionIds: ['13.10'] }),
      expect.objectContaining({ kind: 'device-motion', criterionIds: ['13.12'] }),
    ]));
    expect(observation?.criterionIds).toEqual(expect.arrayContaining(['13.7', '13.10', '13.11', '13.12']));
    expect(observation?.requiresHumanReview).toBe(true);
  }, 30_000);

  it('observe les contenus additionnels, délais, fenêtres et contenus cryptiques', async () => {
    const journey: JourneyDefinition = {
      id: 'journey-us47',
      name: 'Consultation et délais',
      startUrl: `${baseUrl}/journey/us-47-consultation-evidence.html`,
      createdAt: new Date().toISOString(),
      steps: [
        { id: 'reveal-help', action: 'click', selector: '#reveal' },
        { id: 'start-timer', action: 'click', selector: '#start-timer' },
        { id: 'open-window', action: 'click', selector: '#open-window' },
      ],
    };

    const run = await replayJourney(journey, {
      timeout: 10_000,
      isRequestAllowed: async (url) => url.startsWith(baseUrl),
    });

    expect(run.steps[0]?.context).toMatchObject({
      changeTypes: expect.arrayContaining(['additional-content', 'cryptic-content']),
      criterionIds: expect.arrayContaining(['12.11', '13.5', '13.6']),
      additionalContent: [expect.objectContaining({ selector: '#extra' })],
      crypticContent: [expect.objectContaining({ selector: '#cryptic', alternative: 'Icône d’information' })],
    });
    expect(run.steps[1]?.context).toMatchObject({
      changeTypes: expect.arrayContaining(['time-limit']),
      criterionIds: expect.arrayContaining(['13.1']),
      timeLimits: expect.arrayContaining([expect.objectContaining({ kind: 'timer', detail: expect.stringContaining('1000 ms') })]),
    });
    expect(run.steps[2]?.context?.timeLimits).toEqual([
      expect.objectContaining({ kind: 'countdown', detail: expect.stringContaining('Délai écoulé') }),
    ]);
    expect(run.steps[2]?.context?.timeLimits).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'meta-refresh' }),
    ]));
    expect(run.steps[2]?.context?.crypticContent).toEqual([]);
    expect(run.steps[2]?.context).toMatchObject({
      changeTypes: expect.arrayContaining(['new-window']),
      criterionIds: expect.arrayContaining(['13.2']),
      newWindows: [expect.objectContaining({ kind: 'window-open' })],
    });
  }, 30_000);

  it('observe les contrôles d’animation et conserve les contenus cryptiques comme candidats', async () => {
    const screenshotDir = await mkdtemp(path.join(os.tmpdir(), 'rgaudit-us28-'));
    const journey: JourneyDefinition = {
      id: 'journey-us28',
      name: 'Clavier et contenus animés',
      startUrl: `${baseUrl}/journey/us-28-tab-animation-cryptic.html`,
      createdAt: new Date().toISOString(),
      steps: [{ id: 'press-next', action: 'press', selector: '#next', key: 'Enter' }],
    };

    const run = await replayJourney(journey, {
      timeout: 10_000,
      screenshotDir,
      isRequestAllowed: async (url) => url.startsWith(baseUrl),
    });

    expect(run.steps[0]?.context).toMatchObject({
      requiresHumanReview: true,
      animationControls: [expect.objectContaining({
        selector: '#pause',
        kind: 'pause',
        criterionIds: ['13.8'],
        requiresHumanReview: true,
      })],
      crypticContent: [expect.objectContaining({ selector: '#cryptic', alternative: 'Icône d’information' })],
      criterionIds: expect.arrayContaining(['13.5', '13.6', '13.8']),
    });
  }, 30_000);

  it('désactive les captures après une action sensible échouée', async () => {
    const screenshotDir = await mkdtemp(path.join(os.tmpdir(), 'rgaudit-sensitive-failure-'));
    const journey: JourneyDefinition = {
      id: 'journey-sensitive-failure',
      name: 'Échec sensible',
      startUrl: `${baseUrl}/journey.html`,
      createdAt: new Date().toISOString(),
      steps: [
        { id: 'sensitive-failure', action: 'click', selector: '#missing', sensitive: true },
        { id: 'context-after-failure', action: 'click', selector: '#context' },
      ],
    };

    const run = await replayJourney(journey, {
      timeout: 10_000,
      screenshotDir,
      isRequestAllowed: async (url) => url.startsWith(baseUrl),
    });

    expect(run.steps[0].error).toBeDefined();
    expect(run.steps[1].context?.changed).toBe(true);
    expect(run.steps[1].screenshotPath).toBeUndefined();
    expect(run.steps[1].screenshotSkippedReason).toBe('sensitive_step');
  }, 30_000);

  it('partage les preuves d’alternative et de contrôle des scripts avec le parcours', async () => {
    const journey: JourneyDefinition = {
      id: 'journey-us48',
      name: 'Scripts contrôlables',
      startUrl: `${baseUrl}/journey/us-48-script-controls.html`,
      createdAt: new Date().toISOString(),
      steps: [
        { id: 'pointer-activation', action: 'click', selector: '#script-action' },
        { id: 'keyboard-activation', action: 'press', selector: '#script-action', key: 'Enter' },
        { id: 'native-activation', action: 'click', selector: '#native-action' },
      ],
    };

    const run = await replayJourney(journey, {
      timeout: 10_000,
      isRequestAllowed: async (url) => url.startsWith(baseUrl),
    });

    expect(run.steps[0]?.context).toMatchObject({
      changeTypes: expect.arrayContaining(['script-alternative', 'script-control']),
      criterionIds: expect.arrayContaining(['7.2', '7.3']),
      scriptAlternatives: [expect.objectContaining({ alternative: expect.stringContaining('Activez JavaScript') })],
      scriptControls: [expect.objectContaining({
        selector: '#script-action',
        pointerEvents: expect.arrayContaining(['pointerdown', 'pointerup']),
      })],
    });
    expect(run.steps[1]?.context).toMatchObject({
      changeTypes: expect.arrayContaining(['script-control']),
      criterionIds: expect.arrayContaining(['7.3']),
      scriptControls: [expect.objectContaining({
        selector: '#script-action',
        keyboardEvents: expect.arrayContaining(['keydown', 'keyup']),
      })],
    });
    expect(run.steps[1]?.context?.scriptAlternatives).toEqual([]);
    expect(run.steps[2]?.context?.scriptControls).toEqual([]);
    expect(run.steps[2]?.context?.criterionIds).not.toContain('7.3');
  }, 30_000);
});
