import { mkdir, writeFile, rename, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { chromium } from 'playwright';

import { renderReportHtml, type RenderOptions } from './html.renderer';

export interface GeneratePDFOptions {
  reportData: RenderOptions;
  sessionId: string;
  /** Changes the cache key when the public report serialization changes. */
  cacheVersion?: string;
  /** Same-origin base used to resolve private journey screenshot URLs. */
  resourceBaseUrl?: string;
}

export interface GeneratePDFResult {
  filePath: string;
}

/**
 * Serialize JSON-like report data with object keys in a stable order.
 * Arrays keep their order because it is meaningful for report sections.
 */
function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`)
    .join(',')}}`;
}

/**
 * Build a content-addressed cache suffix for the public PDF inputs.
 * `journeyAnnex.generatedAt` is intentionally excluded: it is generated at
 * request time and is not a content change.
 */
export function createPdfCacheVersion(
  reportData: RenderOptions,
  baseVersion = 'v1',
): string {
  const fingerprintInput = {
    report: reportData.report,
    allCollected: reportData.allCollected ?? [],
    contrastViolations: reportData.contrastViolations ?? [],
    journeyAnnex: reportData.journeyAnnex
      ? { ...reportData.journeyAnnex, generatedAt: undefined }
      : undefined,
  };
  const digest = createHash('sha256')
    .update(stableSerialize(fingerprintInput))
    .digest('hex')
    .slice(0, 16);
  return `${baseVersion}-${digest}`;
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
  resourceBaseUrl,
}: GeneratePDFOptions): Promise<GeneratePDFResult> {
  const renderedHtml = renderReportHtml(reportData);
  const html = resourceBaseUrl
    ? renderedHtml.replace('<head>', `<head><base href="${resourceBaseUrl.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}" />`)
    : renderedHtml;

  const date = reportData.report.metadata.date;
  const filePath = buildPdfPath(sessionId, date, cacheVersion);
  const dir = join(filePath, '..');

  await mkdir(dir, { recursive: true });

  const browser = await chromium.launch();
  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.setContent(html, { waitUntil: 'networkidle' });
    if (resourceBaseUrl) {
      await page.evaluate(async () => {
        const pending = Array.from(document.images)
          .filter((image) => !image.complete)
          .map((image) => new Promise<void>((resolve) => {
            const timer = window.setTimeout(resolve, 2_000);
            image.addEventListener('load', () => { window.clearTimeout(timer); resolve(); }, { once: true });
            image.addEventListener('error', () => { window.clearTimeout(timer); resolve(); }, { once: true });
          }));
        await Promise.all(pending);
      });
    }

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
