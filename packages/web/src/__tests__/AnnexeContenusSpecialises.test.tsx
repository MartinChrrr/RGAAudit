import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import AnnexeContenusSpecialises, { type SpecializedContentItem } from '../components/annexes/AnnexeContenusSpecialises';

const items: SpecializedContentItem[] = [
  {
    kind: 'captcha',
    selector: 'img#captcha',
    source: 'https://example.com/captcha.png',
    label: 'Captcha visuel',
    context: 'Vérifiez que vous êtes humain.',
    criterionIds: ['1.4', '1.5'],
    status: 'review_required',
    evidence: ['alt'],
    flags: ['CAPTCHA_REQUIRES_HUMAN_REVIEW'],
    pageUrl: 'https://example.com/',
  },
  {
    kind: 'document',
    selector: 'a[href="guide.pdf"]',
    source: 'https://example.com/guide.pdf',
    label: 'Guide',
    context: '',
    criterionIds: ['13.3', '13.4'],
    status: 'review_required',
    evidence: [],
    flags: ['DOCUMENT_REQUIRES_HUMAN_REVIEW'],
    documentEvidence: {
      state: 'to_review',
      declaredMime: 'application/pdf',
      declaredSizeBytes: 4096,
      downloadDeclared: true,
      sourceExtension: 'pdf',
      localAnalysis: 'not_executed',
      proof: ['MIME déclaré: application/pdf'],
      limits: ['Le document distant n’est pas exécuté.'],
      humanChecks: ['13.3 — version accessible', '13.4 — même information'],
    },
    pageUrl: 'https://example.com/other',
  },
];

describe('AnnexeContenusSpecialises', () => {
  it('regroupe les éléments et affiche leur statut de revue', () => {
    render(<AnnexeContenusSpecialises items={items} />);

    expect(screen.getByTestId('annexe-specialized')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /annexe contenus spécialisés/i })).toBeInTheDocument();
    expect(screen.getByText('CAPTCHA')).toBeInTheDocument();
    expect(screen.getByText('Revue humaine requise: 2')).toBeInTheDocument();
    expect(screen.getByText('1.4, 1.5')).toBeInTheDocument();
    expect(screen.getByText('Contrôles document (13.3–13.4)')).toBeInTheDocument();
    expect(screen.getByText('application/pdf')).toBeInTheDocument();
    expect(screen.getByText(/Le document distant n’est pas exécuté/)).toBeInTheDocument();
  });

  it('filtre par page', () => {
    render(<AnnexeContenusSpecialises items={items} />);
    fireEvent.change(screen.getByLabelText(/Filtrer par page/), { target: { value: 'https://example.com/other' } });

    expect(screen.getByText('a[href="guide.pdf"]')).toBeInTheDocument();
    expect(screen.queryByText('img#captcha')).not.toBeInTheDocument();
  });
});
