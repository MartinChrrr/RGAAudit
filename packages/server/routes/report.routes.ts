import { Router, type Request, type Response } from 'express';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import {
  mapPageResults,
  aggregateResults,
  buildReport,
} from '@rgaaudit/core/mapping/mapper';
import { renderReportHtml } from '@rgaaudit/core/report/html.renderer';
import type { SessionState } from '@rgaaudit/core/analyzer/analyzer';

export const reportRouter = Router();

async function loadSession(sessionId: string): Promise<SessionState | null> {
  const sessionPath = join(homedir(), '.rgaaudit', 'sessions', `audit-${sessionId}.json`);
  try {
    const content = await readFile(sessionPath, 'utf-8');
    return JSON.parse(content) as SessionState;
  } catch {
    return null;
  }
}

// GET /api/report/:sessionId
reportRouter.get('/api/report/:sessionId', async (req: Request, res: Response) => {
  const sessionId = req.params.sessionId as string;
  const session = await loadSession(sessionId);

  if (!session) {
    res.status(404).json({ error: 'Session introuvable.' });
    return;
  }

  const mappedPages = Object.values(session.results)
    .filter((r) => !r.error)
    .map((r) => mapPageResults(r.axeResults, r.collectedData, r.url));

  const allCollected = Object.values(session.results)
    .filter((r) => !r.error)
    .map((r) => ({ url: r.url, collectedData: r.collectedData }));

  const summary = aggregateResults(mappedPages, allCollected);

  const firstUrl = session.completedPages[0] ?? '';
  const report = buildReport(summary, {
    url: firstUrl,
    date: session.startedAt,
    pagesAudited: session.completedPages.length,
    version: '0.1.0',
  }, allCollected);

  res.json({ ...report, allCollected });
});

// GET /api/report/:sessionId/html
reportRouter.get('/api/report/:sessionId/html', async (req: Request, res: Response) => {
  const sessionId = req.params.sessionId as string;
  const session = await loadSession(sessionId);

  if (!session) {
    res.status(404).json({ error: 'Session introuvable.' });
    return;
  }

  const mappedPages = Object.values(session.results)
    .filter((r) => !r.error)
    .map((r) => mapPageResults(r.axeResults, r.collectedData, r.url));

  const allCollected = Object.values(session.results)
    .filter((r) => !r.error)
    .map((r) => ({ url: r.url, collectedData: r.collectedData }));

  const summary = aggregateResults(mappedPages, allCollected);

  const firstUrl = session.completedPages[0] ?? '';
  const report = buildReport(summary, {
    url: firstUrl,
    date: session.startedAt,
    pagesAudited: session.completedPages.length,
    version: '0.1.0',
  }, allCollected);

  const html = renderReportHtml({ report, allCollected });
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});
