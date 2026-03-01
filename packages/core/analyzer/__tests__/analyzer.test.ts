import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import { chromium, type Browser, type BrowserContext } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const FIXTURES_DIR = path.resolve(__dirname, '../../../../e2e/fixtures/test-sites');

// ---------------------------------------------------------------------------
// Mock node:fs/promises for saveSessionState tests
// ---------------------------------------------------------------------------

const fsMock = vi.hoisted(() => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  rename: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('node:fs/promises', () => fsMock);

// Import after mock setup
import {
  auditPage,
  auditPages,
  saveSessionState,
  generateScreenshots,
  type SessionState,
  type ProgressEvent,
  type ScreenshotEvent,
} from '../analyzer';

// ---------------------------------------------------------------------------
// HTTP fixture server
// ---------------------------------------------------------------------------

let server: http.Server;
let browser: Browser;
let context: BrowserContext;
let baseUrl: string;

function serveFixtures(): Promise<string> {
  return new Promise((resolve) => {
    server = http.createServer((req, res) => {
      // Slow endpoint that never responds — for timeout testing
      if (req.url === '/slow') {
        return;
      }

      const filePath = path.join(FIXTURES_DIR, req.url ?? '/');
      if (!fs.existsSync(filePath)) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      const content = fs.readFileSync(filePath, 'utf-8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(content);
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') {
        resolve(`http://127.0.0.1:${addr.port}`);
      }
    });
  });
}

beforeAll(async () => {
  baseUrl = await serveFixtures();
  browser = await chromium.launch();
  context = await browser.newContext();
});

afterAll(async () => {
  await context?.close();
  await browser?.close();
  server?.close();
});

// ---------------------------------------------------------------------------
// saveSessionState
// ---------------------------------------------------------------------------

describe('saveSessionState', () => {
  beforeEach(() => {
    fsMock.mkdir.mockClear();
    fsMock.writeFile.mockClear();
    fsMock.rename.mockClear();
  });

  it('écrit le fichier JSON après chaque page', async () => {
    const state: SessionState = {
      sessionId: 'test-001',
      startedAt: '2026-03-01T00:00:00Z',
      totalPages: 3,
      completedPages: ['http://example.com/page1'],
      pendingPages: ['http://example.com/page2', 'http://example.com/page3'],
      results: {
        'http://example.com/page1': {
          url: 'http://example.com/page1',
          auditedAt: '2026-03-01T00:01:00Z',
          axeResults: null,
          collectedData: null,
          error: null,
        },
      },
    };

    await saveSessionState('test-001', state);

    // mkdir called with recursive
    expect(fsMock.mkdir).toHaveBeenCalledWith(
      expect.stringContaining('.rgaaudit/sessions'),
      { recursive: true },
    );

    // writeFile called with .tmp extension
    expect(fsMock.writeFile).toHaveBeenCalledWith(
      expect.stringMatching(/audit-test-001\.json\.tmp$/),
      expect.any(String),
      'utf-8',
    );

    // Written content is valid JSON with expected shape
    const writtenJson = JSON.parse(fsMock.writeFile.mock.calls[0][1] as string);
    expect(writtenJson.sessionId).toBe('test-001');
    expect(writtenJson.completedPages).toHaveLength(1);

    // rename called to finalize
    expect(fsMock.rename).toHaveBeenCalled();
  });

  it('utilise l\'écriture atomique (.tmp + rename)', async () => {
    const state: SessionState = {
      sessionId: 'atomic-test',
      startedAt: '2026-03-01T00:00:00Z',
      totalPages: 1,
      completedPages: [],
      pendingPages: [],
      results: {},
    };

    await saveSessionState('atomic-test', state);

    // writeFile receives a .tmp path
    const writePath = fsMock.writeFile.mock.calls[0][0] as string;
    expect(writePath).toMatch(/audit-atomic-test\.json\.tmp$/);

    // rename moves .tmp → .json
    const renameArgs = fsMock.rename.mock.calls[0] as string[];
    expect(renameArgs[0]).toMatch(/audit-atomic-test\.json\.tmp$/);
    expect(renameArgs[1]).toMatch(/audit-atomic-test\.json$/);
    expect(renameArgs[1]).not.toMatch(/\.tmp$/);

    // rename called AFTER writeFile
    const writeOrder = fsMock.writeFile.mock.invocationCallOrder[0];
    const renameOrder = fsMock.rename.mock.invocationCallOrder[0];
    expect(renameOrder).toBeGreaterThan(writeOrder);
  });
});

// ---------------------------------------------------------------------------
// auditPage
// ---------------------------------------------------------------------------

describe('auditPage', () => {
  it('retourne { error } sans throw si URL inaccessible', async () => {
    const page = await context.newPage();
    try {
      // Port 1 is typically closed — causes immediate connection refused
      const result = await auditPage(page, 'http://localhost:1/nonexistent', 'test-session');

      expect(result).toBeDefined();
      expect(result.error).not.toBeNull();
      expect(typeof result.error).toBe('string');
      expect(result.axeResults).toBeNull();
      expect(result.collectedData).toBeNull();
      expect(result.auditedAt).toBeDefined();
    } finally {
      await page.close();
    }
  });

  it('retourne { error } sans throw si timeout', async () => {
    const page = await context.newPage();
    try {
      // /slow endpoint never responds, with very short timeout
      const result = await auditPage(page, `${baseUrl}/slow`, 'test-session', { timeout: 100 });

      expect(result).toBeDefined();
      expect(result.error).not.toBeNull();
      expect(typeof result.error).toBe('string');
      expect(result.axeResults).toBeNull();
      expect(result.collectedData).toBeNull();
    } finally {
      await page.close();
    }
  });

  it('retourne un résultat complet sur une page valide', async () => {
    const page = await context.newPage();
    try {
      const result = await auditPage(page, `${baseUrl}/valid-page.html`, 'test-session');

      expect(result.error).toBeNull();
      expect(result.url).toBe(`${baseUrl}/valid-page.html`);
      expect(result.auditedAt).toBeDefined();
      expect(result.axeResults).not.toBeNull();
      expect(result.collectedData).not.toBeNull();
      expect(result.collectedData!.images).toBeDefined();
      expect(result.collectedData!.links).toBeDefined();
      expect(result.collectedData!.headings).toBeDefined();
    } finally {
      await page.close();
    }
  });
});

// ---------------------------------------------------------------------------
// generateScreenshots
// ---------------------------------------------------------------------------

describe('generateScreenshots', () => {
  it('skip les images > 1 Mo', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      headers: new Headers({ 'content-length': '2000000' }),
    });

    try {
      const events: ScreenshotEvent[] = [];
      const gen = generateScreenshots(
        'test-session',
        [
          {
            imageId: 'large-img',
            src: `${baseUrl}/photo.jpg`,
            selector: 'img',
            pageUrl: `${baseUrl}/valid-page.html`,
          },
        ],
        baseUrl,
      );

      for await (const event of gen) {
        events.push(event);
      }

      const skipped = events.find(
        (e) => e.type === 'screenshot_skipped' && e.imageId === 'large-img',
      );
      expect(skipped).toBeDefined();
      if (skipped && skipped.type === 'screenshot_skipped') {
        expect(skipped.reason).toContain('size');
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('skip les images d\'un autre domaine', async () => {
    const events: ScreenshotEvent[] = [];
    const gen = generateScreenshots(
      'test-session',
      [
        {
          imageId: 'external-img',
          src: 'https://external-domain.com/photo.jpg',
          selector: 'img',
          pageUrl: `${baseUrl}/valid-page.html`,
        },
      ],
      baseUrl,
    );

    for await (const event of gen) {
      events.push(event);
    }

    const skipped = events.find(
      (e) => e.type === 'screenshot_skipped' && e.imageId === 'external-img',
    );
    expect(skipped).toBeDefined();
    if (skipped && skipped.type === 'screenshot_skipped') {
      expect(skipped.reason).toContain('domain');
    }
  });
});

// ---------------------------------------------------------------------------
// auditPages — pool test
// ---------------------------------------------------------------------------

describe('auditPages', () => {
  it('le pool Playwright ne dépasse jamais maxConcurrent', async () => {
    const urls = [
      `${baseUrl}/valid-page.html`,
      `${baseUrl}/images/alt-missing.html`,
      `${baseUrl}/images/alt-generic.html`,
      `${baseUrl}/links/empty-links.html`,
      `${baseUrl}/headings/level-skip.html`,
    ];

    let currentConcurrent = 0;
    let maxObservedConcurrent = 0;
    const maxConcurrent = 2;

    const events: ProgressEvent[] = [];
    const gen = auditPages(urls, {
      maxConcurrent,
      sessionId: 'pool-test',
    });

    for await (const event of gen) {
      events.push(event);
      if (event.type === 'page_start') {
        currentConcurrent++;
        maxObservedConcurrent = Math.max(maxObservedConcurrent, currentConcurrent);
      }
      if (event.type === 'page_complete' || event.type === 'page_error') {
        currentConcurrent--;
      }
    }

    expect(maxObservedConcurrent).toBeLessThanOrEqual(maxConcurrent);

    // All pages were processed
    const completedOrErrored = events.filter(
      (e) => e.type === 'page_complete' || e.type === 'page_error',
    );
    expect(completedOrErrored).toHaveLength(urls.length);

    // audit_complete was emitted last
    const auditComplete = events.find((e) => e.type === 'audit_complete');
    expect(auditComplete).toBeDefined();
    expect(events[events.length - 1].type).toBe('audit_complete');
  }, 60_000);
});
