import { Router } from 'express';
import { readFile } from 'node:fs/promises';
import { renderReportHtml } from '@rgaaudit/core/report/html.renderer';
import { createPdfCacheVersion, generatePDF, getPdfPathIfExists } from '@rgaaudit/core/report/pdf.generator';
import { loadReviews, loadSession } from '../services/session.store';
import { loadJourneyRunsForSession } from '../services/journey.store';
import { buildReportFromSession, toPublicReportData } from '../services/report.service';
import { asyncHandler, HttpError } from '../middleware/error.handler';
import { config } from '../config';

export const reportRouter = Router();

// GET /api/report/:sessionId
reportRouter.get('/api/report/:sessionId', asyncHandler(async (req, res) => {
  const sessionId = req.params.sessionId as string;
  const session = await loadSession(sessionId);

  if (!session) {
    throw new HttpError(404, 'Session introuvable.');
  }

  const reviews = await loadReviews(sessionId);
  const journeyRuns = await loadJourneyRunsForSession(sessionId);
  const publicReport = toPublicReportData(buildReportFromSession(session, reviews, journeyRuns), sessionId);
  const { report, allCollected, contrastViolations, extractorRuns, heuristicFindings, review, journeyAnnex } = publicReport;
  res.json({ ...report, allCollected, contrastViolations, extractorRuns, heuristicFindings, review, journeyAnnex });
}));

// GET /api/report/:sessionId/html
reportRouter.get('/api/report/:sessionId/html', asyncHandler(async (req, res) => {
  const sessionId = req.params.sessionId as string;
  const session = await loadSession(sessionId);

  if (!session) {
    throw new HttpError(404, 'Session introuvable.');
  }

  const reviews = await loadReviews(sessionId);
  const journeyRuns = await loadJourneyRunsForSession(sessionId);
  const { report, allCollected, contrastViolations, journeyAnnex } = toPublicReportData(
    buildReportFromSession(session, reviews, journeyRuns),
    sessionId,
  );
  const html = renderReportHtml({ report, allCollected, contrastViolations, journeyAnnex });
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

  const reviews = await loadReviews(sessionId);
  const journeyRuns = await loadJourneyRunsForSession(sessionId);
  const { report, allCollected, contrastViolations, journeyAnnex } = toPublicReportData(
    buildReportFromSession(session, reviews, journeyRuns),
    sessionId,
  );
  const reportData = { report, allCollected, contrastViolations, journeyAnnex };
  // The cache key is derived from the public report content, so journey runs
  // and their human decisions invalidate the PDF without manual cleanup.
  const pdfCacheVersion = createPdfCacheVersion(reportData, 'tables-annex-v2');
  const existingPath = await getPdfPathIfExists(sessionId, session.startedAt, pdfCacheVersion);
  if (existingPath) {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="rapport-rgaa-${sessionId}.pdf"`);
    const pdfContent = await readFile(existingPath);
    res.send(pdfContent);
    return;
  }

  const { filePath } = await generatePDF({
    reportData,
    sessionId,
    cacheVersion: pdfCacheVersion,
    resourceBaseUrl: `http://${config.host === '0.0.0.0' || config.host === '::' ? '127.0.0.1' : config.host}:${config.port}/`,
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="rapport-rgaa-${sessionId}.pdf"`);
  const pdfContent = await readFile(filePath);
  res.send(pdfContent);
}));
