import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { SSEManager } from '../sse/progress';

// ---------------------------------------------------------------------------
// Mocks (vi.hoisted ensures availability before vi.mock factories run)
// ---------------------------------------------------------------------------

const {
  mockParseSitemap,
  mockAuditPages,
  mockMapPageResults,
  mockAggregateResults,
  mockBuildReport,
  mockReadFile,
} = vi.hoisted(() => ({
  mockParseSitemap: vi.fn(),
  mockAuditPages: vi.fn(),
  mockMapPageResults: vi.fn(),
  mockAggregateResults: vi.fn(),
  mockBuildReport: vi.fn(),
  mockReadFile: vi.fn(),
}));

vi.mock('@rgaaudit/core/crawler/sitemap.parser', () => ({
  parseSitemap: mockParseSitemap,
}));

vi.mock('@rgaaudit/core/analyzer/analyzer', () => ({
  auditPages: mockAuditPages,
}));

vi.mock('@rgaaudit/core/mapping/mapper', () => ({
  mapPageResults: mockMapPageResults,
  aggregateResults: mockAggregateResults,
  buildReport: mockBuildReport,
}));

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, readFile: mockReadFile };
});

import { app } from '../index';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// SSEManager — unit tests (RÈGLE 9)
// ---------------------------------------------------------------------------

describe('SSEManager', () => {
  it('ajoute et supprime des clients', () => {
    const manager = new SSEManager();
    const mockRes = {
      writeHead: vi.fn(),
      flushHeaders: vi.fn(),
      write: vi.fn(),
      on: vi.fn(),
    };

    manager.addClient('test-id', mockRes as any);
    expect(manager.hasClient('test-id')).toBe(true);
    expect(manager.size).toBe(1);

    manager.removeClient('test-id');
    expect(manager.hasClient('test-id')).toBe(false);
    expect(manager.size).toBe(0);
  });

  it('configure les headers SSE sur addClient', () => {
    const manager = new SSEManager();
    const mockRes = {
      writeHead: vi.fn(),
      flushHeaders: vi.fn(),
      write: vi.fn(),
      on: vi.fn(),
    };

    manager.addClient('c1', mockRes as any);

    expect(mockRes.writeHead).toHaveBeenCalledWith(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    expect(mockRes.flushHeaders).toHaveBeenCalled();
  });

  it('envoie un event SSE au format correct', () => {
    const manager = new SSEManager();
    const mockRes = {
      writeHead: vi.fn(),
      flushHeaders: vi.fn(),
      write: vi.fn(),
      on: vi.fn(),
    };

    manager.addClient('c1', mockRes as any);
    manager.send('c1', 'page_complete', { url: 'https://example.com' });

    expect(mockRes.write).toHaveBeenCalledWith(
      'event: page_complete\ndata: {"url":"https://example.com"}\n\n',
    );
  });
});

// ---------------------------------------------------------------------------
// POST /api/crawl
// ---------------------------------------------------------------------------

describe('POST /api/crawl', () => {
  it('retourne { urls, count, source }', async () => {
    mockParseSitemap.mockResolvedValue({
      urls: ['https://example.com/', 'https://example.com/about'],
      count: 2,
      source: 'sitemap',
    });

    const res = await request(app)
      .post('/api/crawl')
      .send({ url: 'https://example.com' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      urls: ['https://example.com/', 'https://example.com/about'],
      count: 2,
      source: 'sitemap',
    });
  });

  it('retourne 400 si URL invalide', async () => {
    const res = await request(app)
      .post('/api/crawl')
      .send({ url: 'not-a-url' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// POST /api/audit/start
// ---------------------------------------------------------------------------

describe('POST /api/audit/start', () => {
  it('retourne { sessionId } immédiatement (non-bloquant)', async () => {
    mockAuditPages.mockReturnValue(
      (async function* () {
        // Empty generator — simulates in-progress audit
      })(),
    );

    const res = await request(app)
      .post('/api/audit/start')
      .send({ urls: ['https://example.com'] });

    expect(res.status).toBe(202);
    expect(res.body.sessionId).toBeDefined();
    expect(typeof res.body.sessionId).toBe('string');
    expect(res.body.sessionId.length).toBeGreaterThan(0);
  });

  it('retourne 400 si urls est vide', async () => {
    const res = await request(app)
      .post('/api/audit/start')
      .send({ urls: [] });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('retourne 400 si urls dépasse 50', async () => {
    const urls = Array.from({ length: 51 }, (_, i) => `https://example.com/page${i}`);

    const res = await request(app)
      .post('/api/audit/start')
      .send({ urls });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// GET /api/audit/progress/:sessionId — SSE headers
// ---------------------------------------------------------------------------

describe('GET /api/audit/progress/:sessionId', () => {
  it('retourne les headers SSE corrects', async () => {
    const server = app.listen(0);
    const { port } = server.address() as AddressInfo;

    try {
      const headers = await new Promise<http.IncomingHttpHeaders>(
        (resolve, reject) => {
          const req = http.get(
            `http://localhost:${port}/api/audit/progress/sse-header-test`,
            (res) => {
              resolve(res.headers);
              res.destroy();
            },
          );
          req.on('error', reject);
        },
      );

      expect(headers['content-type']).toContain('text/event-stream');
      expect(headers['cache-control']).toContain('no-cache');
    } finally {
      server.close();
    }
  });
});

// ---------------------------------------------------------------------------
// GET /api/report/:sessionId/html
// ---------------------------------------------------------------------------

describe('GET /api/report/:sessionId/html', () => {
  it('retourne du HTML valide', async () => {
    const mockSession = {
      sessionId: 'html-test-session',
      startedAt: '2026-03-01T00:00:00Z',
      totalPages: 1,
      completedPages: ['https://example.com'],
      pendingPages: [],
      results: {
        'https://example.com': {
          url: 'https://example.com',
          auditedAt: '2026-03-01T00:00:01Z',
          axeResults: { violations: [], passes: [], incomplete: [] },
          collectedData: {
            images: [],
            links: [],
            headings: { documentTitle: 'Test', headings: [], flags: [] },
          },
          error: null,
        },
      },
    };

    mockReadFile.mockResolvedValue(JSON.stringify(mockSession));

    mockMapPageResults.mockReturnValue({
      url: 'https://example.com',
      criteria: [
        { rgaaId: '1.1', title: 'Images', status: 'pass', violations: [], elements: [] },
      ],
    });

    mockAggregateResults.mockReturnValue({
      totalCriteria: 1,
      violations: 0,
      passes: 1,
      manual: 0,
      criteria: [
        {
          rgaaId: '1.1',
          title: 'Images',
          status: 'pass',
          pagesViolating: [],
          pagesPass: ['https://example.com'],
        },
      ],
      topIssues: [],
    });

    mockBuildReport.mockReturnValue({
      metadata: {
        url: 'https://example.com',
        date: '2026-03-01',
        pagesAudited: 1,
        coveredThemes: ['Images'],
        totalRgaaCriteria: 106,
        coveredCriteria: 1,
      },
      limitBanner: 'Cet audit couvre 1 critères sur 106.',
      summary: {
        totalCriteria: 1,
        violations: 0,
        passes: 1,
        manual: 0,
        criteria: [{ rgaaId: '1.1', title: 'Images', status: 'pass' }],
      },
      uncoveredThemes: [
        { name: 'Tableaux', manualChecklist: ['Vérifier les tableaux de données'] },
      ],
    });

    const res = await request(app).get('/api/report/html-test-session/html');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.text).toContain('<!DOCTYPE html>');
    expect(res.text).toContain('<html lang="fr">');
    expect(res.text).toContain('Rapport');
    expect(res.text).toContain('Tableaux');
  });

  it('retourne 404 si session introuvable', async () => {
    mockReadFile.mockRejectedValue(new Error('ENOENT'));

    const res = await request(app).get('/api/report/inexistant/html');

    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });
});
