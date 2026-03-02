import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockMkdir,
  mockWriteFile,
  mockRename,
  mockAccess,
} = vi.hoisted(() => ({
  mockMkdir: vi.fn(),
  mockWriteFile: vi.fn(),
  mockRename: vi.fn(),
  mockAccess: vi.fn(),
}));

const mockPdfBuffer = Buffer.from('%PDF-1.4 mock');

const mockPage = {
  setContent: vi.fn(),
  pdf: vi.fn().mockResolvedValue(mockPdfBuffer),
};

const mockContext = {
  newPage: vi.fn().mockResolvedValue(mockPage),
  close: vi.fn(),
};

const mockBrowser = {
  newContext: vi.fn().mockResolvedValue(mockContext),
  close: vi.fn(),
};

const mockLaunch = vi.hoisted(() => vi.fn());

vi.mock('node:fs/promises', () => ({
  mkdir: mockMkdir,
  writeFile: mockWriteFile,
  rename: mockRename,
  access: mockAccess,
}));

vi.mock('playwright', () => ({
  chromium: { launch: mockLaunch },
}));

vi.mock('../html.renderer', () => ({
  renderReportHtml: vi.fn().mockReturnValue('<!DOCTYPE html><html><body>Test</body></html>'),
}));

import { generatePDF, getPdfPathIfExists } from '../pdf.generator';
import type { Report } from '../../mapping/mapper';

beforeEach(() => {
  vi.clearAllMocks();
  mockLaunch.mockResolvedValue(mockBrowser);
  mockMkdir.mockResolvedValue(undefined);
  mockWriteFile.mockResolvedValue(undefined);
  mockRename.mockResolvedValue(undefined);
});

function makeReportData() {
  const report: Report = {
    metadata: {
      url: 'https://example.com',
      date: '2026-03-01',
      version: '0.1.0',
      pagesAudited: 1,
      coveredThemes: ['Images'],
      totalRgaaCriteria: 106,
      coveredCriteria: 1,
    },
    limitBanner: 'Ce rapport ne couvre que 1 critères sur 106.',
    overlaysDetected: [],
    summary: {
      totalCriteria: 1,
      automated: 1,
      violations: 0,
      passes: 1,
      manual: 0,
      incomplete: 0,
      topIssues: [],
      criteria: [],
    },
    uncoveredThemes: [],
  };
  return { report };
}

describe('generatePDF', () => {
  it('génère un PDF via Playwright page.pdf()', async () => {
    const result = await generatePDF({
      reportData: makeReportData(),
      sessionId: 'test-session',
    });

    expect(mockLaunch).toHaveBeenCalled();
    expect(mockPage.setContent).toHaveBeenCalledWith(
      expect.stringContaining('<!DOCTYPE html>'),
      { waitUntil: 'networkidle' },
    );
    expect(mockPage.pdf).toHaveBeenCalledWith({
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
    });
    expect(result.filePath).toContain('rapport-2026-03-01.pdf');
  });

  it('utilise l\'écriture atomique (.tmp + rename)', async () => {
    await generatePDF({
      reportData: makeReportData(),
      sessionId: 'atomic-test',
    });

    expect(mockWriteFile).toHaveBeenCalledWith(
      expect.stringContaining('.tmp'),
      mockPdfBuffer,
    );
    expect(mockRename).toHaveBeenCalledWith(
      expect.stringContaining('.tmp'),
      expect.stringContaining('.pdf'),
    );
    // .tmp path should NOT end with .pdf.tmp — it should be path.pdf.tmp
    const tmpArg = mockWriteFile.mock.calls[0][0] as string;
    expect(tmpArg).toMatch(/\.pdf\.tmp$/);
  });

  it('crée le répertoire de session', async () => {
    await generatePDF({
      reportData: makeReportData(),
      sessionId: 'mkdir-test',
    });

    expect(mockMkdir).toHaveBeenCalledWith(
      expect.stringContaining('mkdir-test'),
      { recursive: true },
    );
  });

  it('ferme le browser même en cas d\'erreur', async () => {
    mockPage.pdf.mockRejectedValueOnce(new Error('PDF generation failed'));

    await expect(
      generatePDF({
        reportData: makeReportData(),
        sessionId: 'error-test',
      }),
    ).rejects.toThrow('PDF generation failed');

    expect(mockBrowser.close).toHaveBeenCalled();
  });

  it('retourne un chemin dans ~/.rgaaudit/sessions/', async () => {
    const result = await generatePDF({
      reportData: makeReportData(),
      sessionId: 'path-test',
    });

    expect(result.filePath).toContain('.rgaaudit');
    expect(result.filePath).toContain('sessions');
    expect(result.filePath).toContain('path-test');
  });
});

describe('getPdfPathIfExists', () => {
  it('retourne le chemin si le fichier existe', async () => {
    mockAccess.mockResolvedValue(undefined);

    const result = await getPdfPathIfExists('existing-session', '2026-03-01');

    expect(result).toContain('rapport-2026-03-01.pdf');
  });

  it('retourne null si le fichier n\'existe pas', async () => {
    mockAccess.mockRejectedValue(new Error('ENOENT'));

    const result = await getPdfPathIfExists('missing-session', '2026-03-01');

    expect(result).toBeNull();
  });
});
