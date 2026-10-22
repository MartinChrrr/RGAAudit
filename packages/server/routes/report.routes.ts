import { Router } from 'express';
import { readFile } from 'node:fs/promises';
import { renderReportHtml } from '@rgaaudit/core/report/html.renderer';
import { generatePDF, getPdfPathIfExists } from '@rgaaudit/core/report/pdf.generator';
import { loadReviews, loadSession } from '../services/session.store';
import { buildReportFromSession, toPublicReportData } from '../services/report.service';
import { asyncHandler, HttpError } from '../middleware/error.handler';

export const reportRouter = Router();

// GET /api/report/:sessionId
reportRouter.get('/api/report/:sessionId', asyncHandler(async (req, res) => {
  const sessionId = req.params.sessionId as string;
  const session = await loadSession(sessionId);

  if (!session) {
    throw new HttpError(404, 'Session introuvable.');
  }

  const reviews = await loadReviews(sessionId);
  const publicReport = toPublicReportData(buildReportFromSession(session, reviews), sessionId);
  const { report, allCollected, contrastViolations, heuristicFindings, review } = publicReport;
  res.json({ ...report, allCollected, contrastViolations, heuristicFindings, review });
}));

// GET /api/report/:sessionId/html
reportRouter.get('/api/report/:sessionId/html', asyncHandler(async (req, res) => {
  const sessionId = req.params.sessionId as string;
  const session = await loadSession(sessionId);

  if (!session) {
    throw new HttpError(404, 'Session introuvable.');
  }

  const { report, allCollected, contrastViolations } = toPublicReportData(
    buildReportFromSession(session),
    sessionId,
  );
  const html = renderReportHtml({ report, allCollected, contrastViolations });
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; img-src data: https: http:; base-uri 'none'; form-action 'none'");
  res.send(html);
}));

// GET /api/report/:sessionId/pdf
reportRouter.get('/api/report/:sessionId/pdf', asyncHandler(async (req, res) => {
  const sessionId = req.params.sessionId as string;
  const session = await loadSession(sessionId);

  if (!session) {
    throw new HttpError(404, 'Session introuvable.');
  }

  // Check if PDF already exists
  const pdfCacheVersion = 'redacted-v2';
  const existingPath = await getPdfPathIfExists(sessionId, session.startedAt, pdfCacheVersion);
  if (existingPath) {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="rapport-rgaa-${sessionId}.pdf"`);
    const pdfContent = await readFile(existingPath);
    res.send(pdfContent);
    return;
  }

  const { report, allCollected } = toPublicReportData(
    buildReportFromSession(session),
    sessionId,
  );

  const { filePath } = await generatePDF({
    reportData: { report, allCollected },
    sessionId,
    cacheVersion: pdfCacheVersion,
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="rapport-rgaa-${sessionId}.pdf"`);
  const pdfContent = await readFile(filePath);
  res.send(pdfContent);
}));
