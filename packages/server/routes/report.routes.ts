import { Router, type Request, type Response, type NextFunction } from 'express';
import { readFile } from 'node:fs/promises';
import { renderReportHtml } from '@rgaaudit/core/report/html.renderer';
import { generatePDF, getPdfPathIfExists } from '@rgaaudit/core/report/pdf.generator';
import { loadSession } from '../services/session.store';
import { buildReportFromSession } from '../services/report.service';

export const reportRouter = Router();

// GET /api/report/:sessionId
reportRouter.get('/api/report/:sessionId', async (req: Request, res: Response) => {
  const sessionId = req.params.sessionId as string;
  const session = await loadSession(sessionId);

  if (!session) {
    res.status(404).json({ error: 'Session introuvable.' });
    return;
  }

  const { report, allCollected, contrastViolations } = buildReportFromSession(session);
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

  const { report, allCollected, contrastViolations } = buildReportFromSession(session);
  const html = renderReportHtml({ report, allCollected, contrastViolations });
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

// GET /api/report/:sessionId/pdf
reportRouter.get('/api/report/:sessionId/pdf', async (req: Request, res: Response, next: NextFunction) => {
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

  const { report, allCollected } = buildReportFromSession(session);

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
    next(err);
  }
});
