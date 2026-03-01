import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Home from '../pages/Home';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

function renderHome() {
  return render(
    <MemoryRouter>
      <Home />
    </MemoryRouter>,
  );
}

describe('Home', () => {
  it('soumet le formulaire avec URL valide et appelle /api/crawl', async () => {
    const user = userEvent.setup();
    const mockResponse = { urls: ['https://example.com/'], count: 1, source: 'sitemap' };
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    } as Response);

    renderHome();

    const input = screen.getByLabelText(/url du site/i);
    await user.type(input, 'https://example.com');
    await user.click(screen.getByRole('button', { name: /rechercher les pages/i }));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/crawl', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ url: 'https://example.com' }),
      }));
    });

    expect(mockNavigate).toHaveBeenCalledWith('/selection', {
      state: { urls: ['https://example.com/'], siteUrl: 'https://example.com' },
    });
  });

  it('affiche un message d\'erreur si URL invalide, pas d\'appel API', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    renderHome();

    const input = screen.getByLabelText(/url du site/i);
    await user.type(input, 'not-a-url');
    await user.click(screen.getByRole('button', { name: /rechercher les pages/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(/http:\/\/ ou https:\/\//);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('affiche le message sitemap non trouvé avec option continuer', async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ urls: [], count: 0, source: 'not_found' }),
    } as Response);

    renderHome();

    const input = screen.getByLabelText(/url du site/i);
    await user.type(input, 'https://example.com');
    await user.click(screen.getByRole('button', { name: /rechercher les pages/i }));

    await waitFor(() => {
      expect(screen.getByText(/aucun sitemap/i)).toBeInTheDocument();
    });

    await user.click(screen.getByText(/continuer sans sitemap/i));
    expect(mockNavigate).toHaveBeenCalledWith('/selection', {
      state: { urls: [], siteUrl: 'https://example.com' },
    });
  });
});
