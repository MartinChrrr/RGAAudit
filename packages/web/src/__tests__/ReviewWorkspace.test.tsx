import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReviewWorkspace, { type ReviewData } from '../components/ReviewWorkspace';

const review: ReviewData = {
  updatedAt: '2026-09-11T00:00:00.000Z',
  coverage: {
    total: 106,
    integrated: 27,
    machineSignal: 26,
    humanReview: 101,
    full: 5,
    partial: 21,
    manualShell: 80,
  },
  summary: {
    total: 1,
    reviewed: 0,
    compliant: 0,
    nonCompliant: 0,
    notApplicable: 0,
    notTested: 1,
  },
  pages: [{
    url: 'https://example.com/',
    criteria: [{
      rgaaId: '1.1',
      title: 'Chaque image porteuse d’information a-t-elle une alternative textuelle ?',
      theme: 'Images',
      coverage: 'partial',
      humanLevel: 'H2',
      implementationLot: 0,
      wcag: ['1.1.1'],
      machineStatus: 'needs_review',
      humanStatus: 'not_tested',
      comment: '',
      reviewedAt: null,
      violationsCount: 0,
      incompletesCount: 1,
      elements: [{ selector: 'img#logo', flags: [] }],
      manualChecks: [],
    }],
  }],
};

describe('ReviewWorkspace', () => {
  it('ouvre l’annexe pertinente avec la page et les éléments du critère', async () => {
    const onOpenAnnex = vi.fn();
    const user = userEvent.setup();
    render(
      <ReviewWorkspace
        sessionId="session-1"
        review={review}
        onOpenAnnex={onOpenAnnex}
      />,
    );

    await user.click(screen.getByRole('button', { name: /examiner dans l’annexe images/i }));

    expect(onOpenAnnex).toHaveBeenCalledWith({
      tab: 'images',
      pageUrl: 'https://example.com/',
      criterionId: '1.1',
      selectors: ['img#logo'],
      elementIndexes: [],
    });
  });

  it('annonce clairement les anomalies détectées par la machine', () => {
    const reviewWithViolation: ReviewData = {
      ...review,
      pages: [{
        ...review.pages[0],
        criteria: [{
          ...review.pages[0].criteria[0],
          rgaaId: '3.2',
          title: 'Le contraste du texte est-il suffisamment élevé ?',
          machineStatus: 'probable_issue',
          violationsCount: 1,
        }],
      }],
    };

    render(<ReviewWorkspace sessionId="session-1" review={reviewWithViolation} />);

    expect(screen.getByText('Anomalies détectées')).toBeInTheDocument();
  });

  it('affiche la preuve axe liée au critère', () => {
    render(
      <ReviewWorkspace
        sessionId="session-1"
        review={{
          ...review,
          pages: [{
            ...review.pages[0],
            criteria: [{
              ...review.pages[0].criteria[0],
              evidence: [{
                kind: 'violation',
                rule: 'image-alt',
                description: 'Images must have alternate text',
                selector: 'img#logo',
                target: ['img#logo'],
                html: '<img id="logo">',
                context: 'Parent HTML: <main>…</main>',
              }],
            }],
          }],
        }}
      />,
    );

    expect(screen.getByTestId('criterion-evidence-1.1')).toHaveTextContent('image-alt');
    expect(screen.getByTestId('criterion-evidence-1.1')).toHaveTextContent('Parent HTML:');
  });

  it('affiche la couverture partielle séparément du signal machine', () => {
    render(<ReviewWorkspace sessionId="session-1" review={review} />);

    expect(screen.getByText('Couverture partielle')).toBeInTheDocument();
    expect(screen.getByText('À vérifier')).toBeInTheDocument();
  });

  it('affiche le périmètre des 106 critères', () => {
    render(<ReviewWorkspace sessionId="session-1" review={review} />);

    expect(screen.getByTestId('review-coverage-summary')).toHaveTextContent('Critères intégrés');
    expect(screen.getByTestId('review-coverage-summary')).toHaveTextContent('106');
    expect(screen.getByTestId('review-coverage-summary')).toHaveTextContent('Revue humaine requise');
  });

  it('met la décision humaine au premier plan après validation', () => {
    render(
      <ReviewWorkspace
        sessionId="session-1"
        review={{
          ...review,
          pages: [{
            ...review.pages[0],
            criteria: [{
              ...review.pages[0].criteria[0],
              humanStatus: 'non_compliant',
              machineStatus: 'no_issue_detected',
            }],
          }],
        }}
      />,
    );

    expect(screen.getByText('Auditeur : Non conforme')).toBeInTheDocument();
    expect(screen.getByText('Signal automatique : Aucune anomalie détectée')).toBeInTheDocument();
  });

  it('enregistre une décision humaine et son commentaire depuis le résultat', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ review }),
    } as Response);

    render(<ReviewWorkspace sessionId="session-1" review={review} />);

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Décision humaine pour le critère 1.1' }),
      'non_compliant',
    );
    await user.type(screen.getByLabelText('Commentaire ou preuve'), 'Alt à corriger sur le logo.');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(fetchMock).toHaveBeenCalledWith('/api/audit/session-1/decision', expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify({
        pageUrl: 'https://example.com/',
        criterionId: '1.1',
        status: 'non_compliant',
        comment: 'Alt à corriger sur le logo.',
      }),
    }));
    expect(await screen.findByRole('button', { name: 'Enregistré' })).toBeInTheDocument();

    fetchMock.mockRestore();
  });

  it('autorise une décision humaine sans commentaire', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ review }),
    } as Response);

    render(<ReviewWorkspace sessionId="session-1" review={review} />);

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Décision humaine pour le critère 1.1' }),
      'compliant',
    );
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(fetchMock).toHaveBeenCalledWith('/api/audit/session-1/decision', expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify({
        pageUrl: 'https://example.com/',
        criterionId: '1.1',
        status: 'compliant',
        comment: '',
      }),
    }));
    expect(await screen.findByRole('button', { name: 'Enregistré' })).toBeInTheDocument();

    fetchMock.mockRestore();
  });
});
