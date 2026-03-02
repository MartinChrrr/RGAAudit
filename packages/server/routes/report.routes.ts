import { Router, type Request, type Response } from 'express';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import {
  mapPageResults,
  aggregateResults,
  buildReport,
} from '@rgaaudit/core/mapping/mapper';
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

  // Generate minimal valid HTML report
  const html = renderReportHtml(report);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

function renderReportHtml(report: ReturnType<typeof buildReport>): string {
  const { metadata, limitBanner, summary, uncoveredThemes } = report;

  const criteriaRows = summary.criteria
    .map((c) => {
      const statusLabel = c.status === 'violation' ? 'Non conforme'
        : c.status === 'pass' ? 'Conforme'
        : c.status === 'manual' ? 'Manuel'
        : 'Incomplet';
      return `<tr><td>${c.rgaaId}</td><td>${c.title}</td><td>${statusLabel}</td></tr>`;
    })
    .join('\n');

  const uncoveredRows = uncoveredThemes
    .map((t) => `<li><strong>${t.name}</strong><ul>${t.manualChecklist.map((c) => `<li>${c}</li>`).join('')}</ul></li>`)
    .join('\n');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>${metadata.url} — Rapport RGAA</title>
</head>
<body>
  <h1>Rapport d'audit RGAA 4.1</h1>
  <p><strong>URL :</strong> ${metadata.url}</p>
  <p><strong>Date :</strong> ${metadata.date}</p>
  <p><strong>Pages :</strong> ${metadata.pagesAudited}</p>
  <p>${limitBanner}</p>
  <h2>Synthèse</h2>
  <ul>
    <li>Critères évalués : ${summary.totalCriteria}</li>
    <li>Non conformes : ${summary.violations}</li>
    <li>Conformes : ${summary.passes}</li>
    <li>Manuels : ${summary.manual}</li>
  </ul>
  <h2>Détail par critère</h2>
  <table border="1">
    <thead><tr><th>ID</th><th>Critère</th><th>Statut</th></tr></thead>
    <tbody>${criteriaRows}</tbody>
  </table>
  <h2>Thématiques non couvertes</h2>
  <ul>${uncoveredRows}</ul>
</body>
</html>`;
}
