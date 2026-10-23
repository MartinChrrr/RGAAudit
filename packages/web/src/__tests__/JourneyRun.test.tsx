import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import JourneyRun from '../pages/JourneyRun';

function renderJourney(runId = 'run-001') {
  return render(
    <MemoryRouter initialEntries={[`/journey-runs/${runId}`]}>
      <Routes>
        <Route path="/journey-runs/:runId" element={<JourneyRun />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('JourneyRun', () => {
  it('présente le contexte et la capture avec un équivalent textuel accessible', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        run: {
          runId: 'run-001',
          journeyId: 'journey-001',
          status: 'completed',
          startedAt: '2026-10-21T10:00:00.000Z',
          finishedAt: '2026-10-21T10:01:00.000Z',
          run: {
            steps: [{
              stepId: 'context-step',
              action: 'click',
              url: 'https://example.com/after',
              observedAt: '2026-10-21T10:00:30.000Z',
              title: 'Après',
              evidence: [],
              context: {
                trigger: { stepId: 'context-step', action: 'click', selector: '#open' },
                urlBefore: 'https://example.com',
                urlAfter: 'https://example.com/after',
                titleBefore: 'Avant',
                titleAfter: 'Après',
                changed: true,
                changeTypes: ['navigation', 'live-region'],
                disruptions: [],
                criterionIds: ['7.4', '7.5'],
                requiresHumanReview: true,
              },
              screenshotUrl: '/api/journey-runs/run-001/screenshots/000-context-step.png',
            }],
            comparisons: [{
              before: { url: 'https://example.com', pageId: 'page-before1234', observedAt: '2026-10-21T10:00:00.000Z', stepId: 'before-step', available: true, selectors: [] },
              after: { url: 'https://example.com/after', pageId: 'page-after5678', observedAt: '2026-10-21T10:00:30.000Z', stepId: 'context-step', available: true, selectors: [] },
              changed: true,
              added: ['link:a#new'],
              removed: [],
            }],
          },
        },
      }),
    } as Response);

    renderJourney();

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Exécution du parcours' })).toBeInTheDocument());
    expect(screen.getByRole('status')).toHaveTextContent('Terminée');
    expect(screen.getByText('Changement détecté — revue humaine requise.')).toBeInTheDocument();
    expect(screen.getByText('Navigation')).toBeInTheDocument();
    expect(screen.getByText('Région live')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Capture après l’étape context-step/i })).toBeInTheDocument();
    expect(screen.getByText(/description textuelle ci-dessus/i)).toBeInTheDocument();
    expect(screen.getByText(/Avant : Étape before-step.*Après : Étape context-step/)).toBeInTheDocument();
  });

  it('explique quand une capture est désactivée pour une étape sensible', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        run: {
          runId: 'run-001',
          journeyId: 'journey-001',
          status: 'completed',
          startedAt: '2026-10-21T10:00:00.000Z',
          run: {
            steps: [{
              stepId: 'secret-step',
              action: 'fill',
              url: 'https://example.com',
              observedAt: '2026-10-21T10:00:30.000Z',
              title: 'Connexion',
              evidence: [],
              screenshotSkippedReason: 'sensitive_step',
            }],
          },
        },
      }),
    } as Response);

    renderJourney();

    await waitFor(() => expect(screen.getByText(/Capture désactivée à partir d’une étape sensible/i)).toBeInTheDocument());
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('enregistre une décision humaine pour une preuve liée à un critère', async () => {
    const user = userEvent.setup();
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          run: {
            runId: 'run-001',
            journeyId: 'journey-001',
            status: 'completed',
            startedAt: '2026-10-21T10:00:00.000Z',
            finishedAt: '2026-10-21T10:01:00.000Z',
            run: {
              steps: [{
                stepId: 'step-1',
                action: 'click',
                url: 'https://example.com',
                observedAt: '2026-10-21T10:00:30.000Z',
                title: 'Accueil',
                evidence: [{ selector: '#main', context: 'Contenu principal', criterionIds: ['1.1'] }],
              }],
            },
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          run: {
            runId: 'run-001',
            journeyId: 'journey-001',
            status: 'completed',
            run: {
              steps: [{
                stepId: 'step-1',
                action: 'click',
                url: 'https://example.com',
                observedAt: '2026-10-21T10:00:30.000Z',
                title: 'Accueil',
                evidence: [{ selector: '#main', context: 'Contenu principal', criterionIds: ['1.1'] }],
              }],
              decisions: [{
                stepId: 'step-1', evidenceIndex: 0, criterionId: '1.1', status: 'compliant', comment: 'Vérifié', reviewedAt: '2026-10-21T10:02:00.000Z',
              }],
            },
          },
        }),
      } as Response);

    renderJourney();

    await waitFor(() => expect(screen.getByLabelText('Statut 1.1')).toBeInTheDocument());
    await user.selectOptions(screen.getByLabelText('Statut 1.1'), 'compliant');
    await user.type(screen.getByLabelText('Commentaire 1.1'), 'Vérifié');
    await user.click(screen.getByRole('button', { name: 'Enregistrer la décision' }));

    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/journey-runs/run-001/decision', expect.objectContaining({
      method: 'PATCH',
      body: expect.stringContaining('"criterionId":"1.1"'),
    })));
    expect(await screen.findByText('Décision enregistrée.')).toBeInTheDocument();
  });
});
