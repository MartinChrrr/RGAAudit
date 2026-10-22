import { mkdir, writeFile, rename, access } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { chromium } from 'playwright';

import { renderReportHtml, type RenderOptions } from './html.renderer';

export interface GeneratePDFOptions {
  reportData: RenderOptions;
  sessionId: string;
  /** Changes the cache key when the public report serialization changes. */
  cacheVersion?: string;
}

export interface GeneratePDFResult {
  filePath: string;
}

function buildPdfPath(sessionId: string, date: string, cacheVersion = 'v1'): string {
  const dateStr = date.replace(/[/:]/g, '-').slice(0, 10);
  const dataDir = process.env.RGAAUDIT_DATA_DIR ?? join(homedir(), '.rgaaudit');
  return join(
    dataDir,
    'sessions',
    sessionId,
    `rapport-${dateStr}${cacheVersion === 'v1' ? '' : `-${cacheVersion}`}.pdf`,
  );
}

export async function generatePDF({
  reportData,
  sessionId,
  cacheVersion = 'v1',
}: GeneratePDFOptions): Promise<GeneratePDFResult> {
  const html = renderReportHtml(reportData);

  const date = reportData.report.metadata.date;
  const filePath = buildPdfPath(sessionId, date, cacheVersion);
  const dir = join(filePath, '..');

  await mkdir(dir, { recursive: true });

  const browser = await chromium.launch();
  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.setContent(html, { waitUntil: 'networkidle' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm',
      },
    });

    // Atomic write: .tmp then rename
    const tmpPath = filePath + '.tmp';
    await writeFile(tmpPath, pdfBuffer);
    await rename(tmpPath, filePath);

    await context.close();
  } finally {
    await browser.close();
  }

  return { filePath };
}

export async function getPdfPathIfExists(
  sessionId: string,
  date: string,
  cacheVersion = 'v1',
): Promise<string | null> {
  const filePath = buildPdfPath(sessionId, date, cacheVersion);
  try {
    await access(filePath);
    return filePath;
  } catch {
    return null;
  }
}
