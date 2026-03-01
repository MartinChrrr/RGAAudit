import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import PageSelection from '../pages/PageSelection';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({
      state: {
        urls: ['https://example.com/', 'https://example.com/about'],
        siteUrl: 'https://example.com',
      },
      pathname: '/selection',
      search: '',
      hash: '',
      key: 'default',
    }),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

function renderPageSelection() {
  return render(
    <MemoryRouter>
      <PageSelection />
    </MemoryRouter>,
  );
}

describe('PageSelection', () => {
  it('"Tout sélectionner" coche toutes les checkboxes', async () => {
    const user = userEvent.setup();
    renderPageSelection();

    // Deselect all first to ensure a clean state
    await user.click(screen.getByRole('button', { name: /tout désélectionner/i }));

    const checkboxes = screen.getAllByRole('checkbox');
    for (const cb of checkboxes) {
      expect(cb).not.toBeChecked();
    }

    await user.click(screen.getByRole('button', { name: /tout sélectionner/i }));

    for (const cb of screen.getAllByRole('checkbox')) {
      expect(cb).toBeChecked();
    }
  });

  it('bouton "Lancer l\'audit" désactivé si 0 pages cochées', async () => {
    const user = userEvent.setup();
    renderPageSelection();

    await user.click(screen.getByRole('button', { name: /tout désélectionner/i }));

    const startButton = screen.getByRole('button', { name: /lancer l'audit/i });
    expect(startButton).toBeDisabled();
  });

  it('affiche le compteur de pages sélectionnées', async () => {
    renderPageSelection();

    // Both URLs should be selected initially
    expect(screen.getByText(/2 page\(s\) sélectionnée\(s\)/i)).toBeInTheDocument();
  });

  it('permet d\'ajouter une URL manuellement', async () => {
    const user = userEvent.setup();
    renderPageSelection();

    const input = screen.getByPlaceholderText(/exemple\.fr\/page/i);
    await user.type(input, 'https://example.com/contact');
    await user.click(screen.getByRole('button', { name: /ajouter/i }));

    expect(screen.getByText('https://example.com/contact')).toBeInTheDocument();
  });
});
