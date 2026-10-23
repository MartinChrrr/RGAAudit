import { chromium, type Page, type BrowserContext } from 'playwright';
import { mkdir, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';

import { getEngine } from '../engines';
import type { AnalyzeResult } from '../engines';
import { collectAll } from './data-collector';
import type { CollectedData } from './data-collector';
import { runAllHeuristics } from './heuristics/runner';
import type { HeuristicResult } from './heuristics/heuristic.interface';
import type { AuditObservation } from '../report/observation';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PageResult {
  url: string;
  auditedAt: string;
  axeResults: AnalyzeResult | null;
  collectedData: CollectedData | null;
  heuristicResults: HeuristicResult[];
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

/** Version of the persisted audit session envelope. */
export const SESSION_SCHEMA_VERSION = 1 as const;

export interface SessionState {
  /** Optional for backwards-compatible sessions written before versioning. */
  schemaVersion?: typeof SESSION_SCHEMA_VERSION;
  sessionId: string;
  startedAt: string;
  totalPages: number;
  completedPages: string[];
  pendingPages: string[];
  results: Record<string, PageResult>;
  /** Ordered observations retained for explicit comparison groups. */
  observations?: AuditObservation[];
}

export interface AuditPagesOptions {
  maxConcurrent?: number;
  sessionId: string;
  disableRules?: string[];
  comparisonGroup?: string;
  onPageComplete?: (url: string, result: PageResult) => void;
  persistState?: (state: SessionState) => Promise<void>;
  isRequestAllowed?: (url: string) => Promise<boolean>;
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
  const dataDir = process.env.RGAAUDIT_DATA_DIR ?? join(homedir(), '.rgaaudit');
  const sessionDir = join(dataDir, 'sessions');
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
  options?: { timeout?: number; disableRules?: string[] },
): Promise<PageResult> {
  const timeout = options?.timeout ?? 30_000;

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout });
    return analyzeLoadedPage(page, url, _sessionId, options);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      url,
      auditedAt: new Date().toISOString(),
      axeResults: null,
      collectedData: null,
      heuristicResults: [],
      error: message,
    };
  }
}

/** Analyse la page déjà chargée, sans la recharger. Utilisé par les parcours rejoués. */
export async function analyzeLoadedPage(
  page: Page,
  url: string,
  _sessionId: string,
  options?: { timeout?: number; disableRules?: string[] },
): Promise<PageResult> {
  try {
    const engine = getEngine({ timeout: options?.timeout, disableRules: options?.disableRules });
    const [axeResults, collectedData, heuristicResults] = await Promise.all([
      engine.analyze(page),
      collectAll(page),
      runAllHeuristics(page),
    ]);

    return {
      url,
      auditedAt: new Date().toISOString(),
      axeResults,
      collectedData,
      heuristicResults,
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      url,
      auditedAt: new Date().toISOString(),
      axeResults: null,
      collectedData: null,
      heuristicResults: [],
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
      const context = await browser.newContext();
      if (options.isRequestAllowed) {
        await context.route('**/*', async (route) => {
          const requestUrl = route.request().url();
          if (requestUrl.startsWith('data:') || requestUrl.startsWith('blob:')) {
            await route.continue();
            return;
          }
          const allowed = await options.isRequestAllowed!(requestUrl).catch(() => false);
          if (allowed) await route.continue();
          else await route.abort('blockedbyclient');
        });
      }
      contexts.push(context);
    }

    const state: SessionState = {
      schemaVersion: SESSION_SCHEMA_VERSION,
      sessionId: options.sessionId,
      startedAt: new Date().toISOString(),
      totalPages: urls.length,
      completedPages: [],
      pendingPages: [...urls],
      results: {},
      observations: [],
    };

    const persistState = options.persistState
      ?? ((nextState: SessionState) => saveSessionState(options.sessionId, nextState));

    let persistenceQueue = Promise.resolve();
    const persist = async (): Promise<void> => {
      persistenceQueue = persistenceQueue.then(() => persistState(state));
      await persistenceQueue;
    };

    await persist();

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
    const urlQueue = urls.map((url, order) => ({ url, order }));

    async function worker(ctx: BrowserContext) {
      while (urlQueue.length > 0) {
        const entry = urlQueue.shift()!;
        const { url } = entry;
        pushEvent({ type: 'page_start', url });

        const page = await ctx.newPage();
        try {
          const result = await auditPage(page, url, options.sessionId, {
            disableRules: options.disableRules,
          });

          state.pendingPages = state.pendingPages.filter((u) => u !== url);
          state.completedPages.push(url);
          state.results[url] = result;
          state.observations!.push({
            observationId: `${options.sessionId}-${entry.order}`,
            order: entry.order,
            url,
            observedAt: result.auditedAt,
            ...(options.comparisonGroup ? { comparisonGroup: options.comparisonGroup } : {}),
            collectedData: result.collectedData,
          });

          if (result.error) {
            pushEvent({ type: 'page_error', url, error: result.error });
          } else {
            pushEvent({ type: 'page_complete', url, result });
          }

          await persist();

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
  const dataDir = process.env.RGAAUDIT_DATA_DIR ?? join(homedir(), '.rgaaudit');
  const screenshotDir = join(dataDir, 'sessions', sessionId, 'screenshots');
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
