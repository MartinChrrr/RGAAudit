import { Router, type Request, type Response } from 'express';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import {
  mapPageResults,
  aggregateResults,
  buildReport,
  type MappedPage,
} from '@rgaaudit/core/mapping/mapper';
import { renderReportHtml } from '@rgaaudit/core/report/html.renderer';
import { generatePDF, getPdfPathIfExists } from '@rgaaudit/core/report/pdf.generator';
import type { SessionState } from '@rgaaudit/core/analyzer/analyzer';

export interface ContrastViolationItem {
  pageUrl: string;
  rgaaId: string;
  selector: string;
  contrastRatio: string;
  expectedContrastRatio: string;
  fgColor: string;
  bgColor: string;
}

function extractContrastViolations(mappedPages: MappedPage[]): ContrastViolationItem[] {
  const contrastRules = ['color-contrast', 'color-contrast-enhanced'];
  const rgaaIdByRule: Record<string, string> = {
    'color-contrast': '3.2',
    'color-contrast-enhanced': '3.3',
  };
  const items: ContrastViolationItem[] = [];

  for (const page of mappedPages) {
    for (const criterion of page.criteria) {
      if (!['3.2', '3.3'].includes(criterion.rgaaId)) continue;
      for (const violation of criterion.violations) {
        if (!contrastRules.includes(violation.rule)) continue;
        for (const el of violation.elements) {
          const data = el.data ?? {};
          items.push({
            pageUrl: page.url,
            rgaaId: rgaaIdByRule[violation.rule] ?? criterion.rgaaId,
            selector: el.target.join(', '),
            contrastRatio: data.contrastRatio != null ? `${data.contrastRatio}:1` : '',
            expectedContrastRatio: data.expectedContrastRatio != null ? `${data.expectedContrastRatio}:1` : '',
            fgColor: typeof data.fgColor === 'string' ? data.fgColor : '',
            bgColor: typeof data.bgColor === 'string' ? data.bgColor : '',
          });
        }
      }
    }
  }

  return items;
}

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

  const contrastViolations = extractContrastViolations(mappedPages);

  res.json({ ...report, allCollected, contrastViolations });
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

  const contrastViolations = extractContrastViolations(mappedPages);
  const html = renderReportHtml({ report, allCollected, contrastViolations });
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

// GET /api/report/:sessionId/pdf
reportRouter.get('/api/report/:sessionId/pdf', async (req: Request, res: Response) => {
  const sessionId = req.params.sessionId as string;
  const session = await loadSession(sessionId);

  if (!session) {
    res.status(404).json({ error: 'Session introuvable.' });
    return;
  }

  // Check if PDF already exists
  const existingPath = await getPdfPathIfExists(sessionId, session.startedAt);
  if (existingPath) {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="rapport-rgaa-${sessionId}.pdf"`);
    const pdfContent = await readFile(existingPath);
    res.send(pdfContent);
    return;
  }

  // Generate PDF
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

  try {
    const { filePath } = await generatePDF({
      reportData: { report, allCollected },
      sessionId,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="rapport-rgaa-${sessionId}.pdf"`);
    const pdfContent = await readFile(filePath);
    res.send(pdfContent);
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la génération du PDF.' });
  }
});
