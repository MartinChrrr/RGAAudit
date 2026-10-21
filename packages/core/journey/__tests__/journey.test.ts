import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import http from 'node:http';
import fs from 'node:fs';
import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { replayJourney, type JourneyDefinition } from '../journey';

const FIXTURE_PATH = path.resolve(__dirname, '../../../../e2e/fixtures/test-sites/journey.html');
let server: http.Server;
let baseUrl: string;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    if (req.url !== '/journey.html') {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(fs.readFileSync(FIXTURE_PATH, 'utf-8'));
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
});
