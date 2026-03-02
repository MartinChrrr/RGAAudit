import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AnnexeTitres, { type HeadingTreeData } from '../components/annexes/AnnexeTitres';

const mockHeadingData: HeadingTreeData[] = [
  {
    url: 'https://example.com/',
    documentTitle: 'Accueil — Mon site',
    headings: [
      { level: 1, text: 'Bienvenue', selector: 'h1', flags: [] },
      { level: 2, text: 'Nos services', selector: 'h2#services', flags: [] },
      {
        level: 4,
        text: 'Détails',
        selector: 'h4#details',
        flags: [{ flag: 'LEVEL_SKIP', skipFrom: 2, skipTo: 4 }],
      },
    ],
    flags: ['LEVEL_SKIP'],
  },
  {
    url: 'https://example.com/about',
    documentTitle: 'accueil',
    headings: [
      { level: 1, text: 'À propos', selector: 'h1', flags: [] },
    ],
    flags: ['TITLE_GENERIC'],
  },
];

describe('AnnexeTitres', () => {
  it('saut de niveau affiché en rouge avec message explicite', () => {
    render(<AnnexeTitres headingData={mockHeadingData} sessionId="test-1" />);

    const skipMessage = screen.getByTestId('level-skip');
    expect(skipMessage).toBeInTheDocument();
    expect(skipMessage.textContent).toContain('h2');
    expect(skipMessage.textContent).toContain('h4');
    expect(skipMessage.textContent).toContain('h3');
    // Red color
    expect(skipMessage.className).toContain('text-red-600');
  });

  it('affiche le badge de problèmes détectés', () => {
    render(<AnnexeTitres headingData={mockHeadingData} sessionId="test-2" />);

    // The first page has a LEVEL_SKIP issue
    expect(screen.getByText(/problème\(s\) détecté/i)).toBeInTheDocument();
  });

  it('affiche le titre de la page avec statut', () => {
    render(<AnnexeTitres headingData={mockHeadingData} sessionId="test-3" />);

    expect(screen.getByText('Accueil — Mon site')).toBeInTheDocument();
  });

  it('affiche la structure des titres avec indentation', () => {
    render(<AnnexeTitres headingData={mockHeadingData} sessionId="test-4" />);

    expect(screen.getByText('Bienvenue')).toBeInTheDocument();
    expect(screen.getByText('Nos services')).toBeInTheDocument();
    expect(screen.getByText('Détails')).toBeInTheDocument();
  });

  it('navigation entre pages avec le sélecteur', async () => {
    render(<AnnexeTitres headingData={mockHeadingData} sessionId="test-5" />);

    // Page 1 shown by default
    expect(screen.getByText('Accueil — Mon site')).toBeInTheDocument();

    // The select should have both pages
    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();
    expect(select.children.length).toBe(2);

    // We can also check the "Suivante" button exists
    expect(screen.getByText(/suivante/i)).toBeInTheDocument();
  });
});
