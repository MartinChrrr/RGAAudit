import { chromium, type Page, type BrowserContext } from 'playwright';
import { mkdir, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';

import { getEngine } from '../engines';
import type { AnalyzeResult } from '../engines';
import { collectAll } from './data-collector';
import type { CollectedData } from './data-collector';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PageResult {
  url: string;
  auditedAt: string;
  axeResults: AnalyzeResult | null;
  collectedData: CollectedData | null;
  error: string | null;
}

export interface AuditSummary {
  totalPages: number;
  completedPages: number;
  failedPages: number;
  startedAt: string;
  finishedAt: string;
}

export type ProgressEvent =
  | { type: 'page_start'; url: string }
  | { type: 'page_complete'; url: string; result: PageResult }
  | { type: 'page_error'; url: string; error: string }
  | { type: 'audit_complete'; summary: AuditSummary };

export interface SessionState {
  sessionId: string;
  startedAt: string;
  totalPages: number;
  completedPages: string[];
  pendingPages: string[];
  results: Record<string, PageResult>;
}

export interface AuditPagesOptions {
  maxConcurrent?: number;
  sessionId: string;
  onPageComplete?: (url: string, result: PageResult) => void;
}

export type ScreenshotEvent =
  | { type: 'screenshot_ready'; imageId: string; screenshotPath: string }
  | { type: 'screenshot_skipped'; imageId: string; reason: string }
  | { type: 'screenshot_error'; imageId: string; error: string };

export interface ScreenshotInput {
  imageId: string;
  src: string;
  selector: string;
  pageUrl: string;
}

// ---------------------------------------------------------------------------
// saveSessionState
// ---------------------------------------------------------------------------

export async function saveSessionState(
  sessionId: string,
  state: SessionState,
): Promise<void> {
  const sessionDir = join(homedir(), '.rgaaudit', 'sessions');
  await mkdir(sessionDir, { recursive: true });

  const filePath = join(sessionDir, `audit-${sessionId}.json`);
  const tmpPath = `${filePath}.tmp`;

  await writeFile(tmpPath, JSON.stringify(state, null, 2), 'utf-8');
  await rename(tmpPath, filePath);
}

// ---------------------------------------------------------------------------
// auditPage
// ---------------------------------------------------------------------------

export async function auditPage(
  page: Page,
  url: string,
  _sessionId: string,
  options?: { timeout?: number },
): Promise<PageResult> {
  const timeout = options?.timeout ?? 30_000;

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout });

    const engine = getEngine();
    const [axeResults, collectedData] = await Promise.all([
      engine.analyze(page),
      collectAll(page),
    ]);

    return {
      url,
      auditedAt: new Date().toISOString(),
      axeResults,
      collectedData,
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      url,
      auditedAt: new Date().toISOString(),
      axeResults: null,
      collectedData: null,
      error: message,
    };
  }
}

// ---------------------------------------------------------------------------
// auditPages
// ---------------------------------------------------------------------------

export async function* auditPages(
  urls: string[],
  options: AuditPagesOptions,
): AsyncGenerator<ProgressEvent> {
  const concurrency = Math.min(options.maxConcurrent ?? 2, 3);

  const browser = await chromium.launch();
  const contexts: BrowserContext[] = [];

  try {
    for (let i = 0; i < concurrency; i++) {
      contexts.push(await browser.newContext());
    }

    const state: SessionState = {
      sessionId: options.sessionId,
      startedAt: new Date().toISOString(),
      totalPages: urls.length,
      completedPages: [],
      pendingPages: [...urls],
      results: {},
    };

    // Event buffer + signaling for the async generator
    const eventBuffer: ProgressEvent[] = [];
    let notifyResolve: (() => void) | null = null;

    function pushEvent(event: ProgressEvent) {
      eventBuffer.push(event);
      if (notifyResolve) {
        notifyResolve();
        notifyResolve = null;
      }
    }

    function waitForEvent(): Promise<void> {
      if (eventBuffer.length > 0) return Promise.resolve();
      return new Promise<void>((resolve) => {
        notifyResolve = resolve;
      });
    }

    // URL queue
    const urlQueue = [...urls];

    async function worker(ctx: BrowserContext) {
      while (urlQueue.length > 0) {
        const url = urlQueue.shift()!;
        pushEvent({ type: 'page_start', url });

        const page = await ctx.newPage();
        try {
          const result = await auditPage(page, url, options.sessionId);

          state.pendingPages = state.pendingPages.filter((u) => u !== url);
          state.completedPages.push(url);
          state.results[url] = result;

          if (result.error) {
            pushEvent({ type: 'page_error', url, error: result.error });
          } else {
            pushEvent({ type: 'page_complete', url, result });
          }

          await saveSessionState(options.sessionId, state);

          options.onPageComplete?.(url, result);
        } finally {
          await page.close();
        }
      }
    }

    // Start all workers
    let allDone = false;
    const allWorkersPromise = Promise.all(contexts.map((ctx) => worker(ctx))).then(() => {
      allDone = true;
      pushEvent({
        type: 'audit_complete',
        summary: {
          totalPages: urls.length,
          completedPages: state.completedPages.length,
          failedPages: Object.values(state.results).filter((r) => r.error).length,
          startedAt: state.startedAt,
          finishedAt: new Date().toISOString(),
        },
      });
    });

    // Generator yield loop
    while (!allDone || eventBuffer.length > 0) {
      await waitForEvent();
      while (eventBuffer.length > 0) {
        yield eventBuffer.shift()!;
      }
    }

    await allWorkersPromise;
  } finally {
    for (const ctx of contexts) {
      await ctx.close().catch(() => {});
    }
    await browser.close().catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// generateScreenshots
// ---------------------------------------------------------------------------

export async function* generateScreenshots(
  sessionId: string,
  imageData: ScreenshotInput[],
  baseUrl: string,
): AsyncGenerator<ScreenshotEvent> {
  const screenshotDir = join(homedir(), '.rgaaudit', 'sessions', sessionId, 'screenshots');
  await mkdir(screenshotDir, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext();

  try {
    const baseHost = new URL(baseUrl).hostname;

    for (const img of imageData) {
      try {
        // Check domain
        const imgUrl = new URL(img.src, img.pageUrl);
        if (imgUrl.hostname !== baseHost) {
          yield { type: 'screenshot_skipped', imageId: img.imageId, reason: 'different_domain' };
          continue;
        }

        // Check size via HEAD request
        try {
          const absoluteSrc = img.src.startsWith('http') ? img.src : new URL(img.src, img.pageUrl).href;
          const headResponse = await fetch(absoluteSrc, {
            method: 'HEAD',
            signal: AbortSignal.timeout(5_000),
          });
          const contentLength = headResponse.headers.get('content-length');
          if (contentLength && parseInt(contentLength, 10) > 1_000_000) {
            yield { type: 'screenshot_skipped', imageId: img.imageId, reason: 'size_exceeds_1mo' };
            continue;
          }
        } catch {
          // HEAD request failed — proceed with screenshot attempt
        }

        // Take screenshot with 5s timeout
        const page = await context.newPage();
        try {
          await page.goto(img.pageUrl, { waitUntil: 'networkidle', timeout: 10_000 });
          const element = await page.$(img.selector);
          if (!element) {
            yield { type: 'screenshot_skipped', imageId: img.imageId, reason: 'element_not_found' };
            continue;
          }

          const hash = createHash('md5').update(img.imageId + img.src).digest('hex').slice(0, 12);
          const screenshotPath = join(screenshotDir, `${hash}.png`);

          await Promise.race([
            element.screenshot({ path: screenshotPath }),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('screenshot timeout')), 5_000),
            ),
          ]);

          yield { type: 'screenshot_ready', imageId: img.imageId, screenshotPath };
        } finally {
          await page.close();
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        yield { type: 'screenshot_error', imageId: img.imageId, error: message };
      }
    }
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}
