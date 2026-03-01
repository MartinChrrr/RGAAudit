import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Results from '../pages/Results';

const mockReport = {
  metadata: {
    url: 'https://example.com',
    date: '2026-03-01',
    pagesAudited: 2,
    coveredThemes: ['Images', 'Liens'],
    totalRgaaCriteria: 106,
    coveredCriteria: 7,
  },
  limitBanner: 'Ce rapport ne couvre que 7 critères RGAA sur 106.',
  summary: {
    totalCriteria: 7,
    violations: 2,
    passes: 4,
    manual: 1,
    criteria: [
      { rgaaId: '1.1', title: 'Images', status: 'violation' },
      { rgaaId: '1.2', title: 'Images décoratives', status: 'pass' },
    ],
    topIssues: [
      { rgaaId: '1.1', title: 'Images', pagesViolating: ['https://example.com/'] },
    ],
    overlaysDetected: false,
  },
  uncoveredThemes: [
    { name: 'Tableaux', manualChecklist: ['Vérifier les tableaux de données'] },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

function renderResults(sessionId = 'test-session') {
  return render(
    <MemoryRouter initialEntries={[`/results/${sessionId}`]}>
      <Routes>
        <Route path="/results/:sessionId" element={<Results />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Results', () => {
  it('affiche le bandeau de limite toujours rendu', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockReport),
    } as Response);

    renderResults();

    await waitFor(() => {
      const banner = screen.getByTestId('limit-banner');
      expect(banner).toBeInTheDocument();
      expect(banner).toHaveTextContent(/7 critères RGAA sur 106/);
    });
  });

  it('affiche le bandeau même si les données sont minimales', async () => {
    const minimalReport = {
      ...mockReport,
      summary: { ...mockReport.summary, criteria: [], topIssues: [] },
      uncoveredThemes: [],
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(minimalReport),
    } as Response);

    renderResults();

    await waitFor(() => {
      expect(screen.getByTestId('limit-banner')).toBeInTheDocument();
    });
  });

  it('affiche les cartes de synthèse', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockReport),
    } as Response);

    renderResults();

    await waitFor(() => {
      expect(screen.getByText('7')).toBeInTheDocument(); // totalCriteria
      expect(screen.getByText('2')).toBeInTheDocument(); // violations
      expect(screen.getByText('4')).toBeInTheDocument(); // passes
    });
  });

  it('affiche un message d\'erreur si le fetch échoue', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('network'));

    renderResults();

    await waitFor(() => {
      expect(screen.getByText(/impossible de charger/i)).toBeInTheDocument();
    });
  });

  it('affiche les 3 onglets annexes', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockReport),
    } as Response);

    renderResults();

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /images/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /liens/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /titres/i })).toBeInTheDocument();
    });
  });
});
