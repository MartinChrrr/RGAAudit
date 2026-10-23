import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import JourneyBuilder from '../pages/JourneyBuilder';

describe('JourneyBuilder', () => {
  it('crée un parcours avec une étape et envoie le contrat API', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ journey: { id: 'journey-001' } }),
    } as Response);

    render(
      <MemoryRouter initialEntries={['/journeys/new']}>
        <Routes>
          <Route path="/journeys/new" element={<JourneyBuilder />} />
          <Route path="/journeys/:journeyId/edit" element={<div />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText('Nom'), 'Connexion');
    await user.type(screen.getByLabelText('URL de départ'), 'https://example.com');
    await user.selectOptions(screen.getAllByLabelText('Action')[0], 'wait');
    await user.clear(screen.getByLabelText('Attente (ms)'));
    await user.type(screen.getByLabelText('Attente (ms)'), '250');
    await user.click(screen.getByRole('button', { name: 'Enregistrer le parcours' }));

    expect(fetchMock).toHaveBeenCalledWith('/api/journeys', expect.objectContaining({
      method: 'POST',
      body: expect.stringContaining('"waitMs":250'),
    }));
    fetchMock.mockRestore();
  });
});
