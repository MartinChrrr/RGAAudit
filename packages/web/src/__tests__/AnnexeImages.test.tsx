import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AnnexeImages, { deriveImageStatus, type ImageItem } from '../components/annexes/AnnexeImages';

const mockImages: ImageItem[] = [
  {
    selector: 'img#hero',
    tagName: 'img',
    src: '/hero.jpg',
    altAttribute: null,
    altStatus: 'absent',
    automatedStatus: 'violation',
    flags: ['ALT_ABSENT'],
    surroundingText: 'Bienvenue sur notre site',
    screenshotPath: null,
    isInLink: false,
    linkText: null,
    pageUrl: 'https://example.com/',
    elementIndex: 0,
  },
  {
    selector: 'img#logo',
    tagName: 'img',
    src: '/logo.png',
    altAttribute: 'Logo entreprise',
    altStatus: 'present',
    automatedStatus: 'pass',
    flags: [],
    surroundingText: '',
    screenshotPath: null,
    isInLink: false,
    linkText: null,
    pageUrl: 'https://example.com/',
    elementIndex: 1,
  },
  {
    selector: 'img#deco',
    tagName: 'img',
    src: '/deco.svg',
    altAttribute: '',
    altStatus: 'empty',
    automatedStatus: 'manual',
    flags: [],
    surroundingText: 'Section principale',
    screenshotPath: null,
    isInLink: false,
    linkText: null,
    pageUrl: 'https://example.com/about',
    elementIndex: 0,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('AnnexeImages', () => {
  it('affiche le bon nombre de lignes', () => {
    render(<AnnexeImages images={mockImages} sessionId="test-1" />);

    const rows = screen.getAllByRole('row');
    // 1 header + 3 data rows
    expect(rows.length).toBe(4);
  });

  it('affiche les alternatives détectées et les contrôles manuels spécialisés', () => {
    render(<AnnexeImages
      images={[{
        ...mockImages[1],
        alternativeSources: ['alt', 'figcaption'],
        manualChecks: ['1.4 — Vérifier le CAPTCHA', '1.8 — Vérifier le texte dans l’image'],
      }]}
      sessionId="test-specialized"
    />);

    expect(screen.getByText(/Alternatives détectées : alt, figcaption/)).toBeInTheDocument();
    expect(screen.getByText(/Contrôles manuels associés/)).toBeInTheDocument();
    expect(screen.getByText(/1\.4 — Vérifier le CAPTCHA/)).toBeInTheDocument();
  });

  it('filtre "Violations" masque les passes', async () => {
    const user = userEvent.setup();
    render(<AnnexeImages images={mockImages} sessionId="test-2" />);

    // Click the Violations filter button
    await user.click(screen.getByText(/violations/i, { selector: 'button' }));

    // Should only show the violation row + header
    const rows = screen.getAllByRole('row');
    expect(rows.length).toBe(2); // header + 1 violation
    expect(screen.getByText(/alt absent/i)).toBeInTheDocument();
    expect(screen.queryByText('Logo entreprise')).not.toBeInTheDocument();
  });

  it('persiste les décisions en localStorage', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ review: { imageDecisions: [] } }),
    } as Response);
    const user = userEvent.setup();
    render(<AnnexeImages images={mockImages} sessionId="test-3" />);

    // Valide la nature et enregistre la première image.
    await user.selectOptions(
      screen.getByRole('combobox', { name: /nature validée.*img#hero/i }),
      'decorative',
    );
    await user.click(screen.getByRole('button', { name: 'Enregistrer les modifications' }));

    // Wait for debounce (500ms)
    await new Promise((r) => setTimeout(r, 600));

    const stored = localStorage.getItem('rgaaudit-images-test-3');
    expect(stored).toBeTruthy();
    const parsed = JSON.parse(stored!);
    const key = 'https://example.com/\u001findex:0';
    expect(parsed[key]).toBeDefined();
    expect(parsed[key].decision).toBe('decorative');
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/audit/test-3/image-decisions',
      expect.objectContaining({ method: 'PATCH' }),
    ));
  });

  it('restaure les décisions depuis localStorage au montage', () => {
    // Pre-populate localStorage
    const decisions = {
      'img#hero': { decision: 'violation', notes: 'Alt manquant' },
    };
    localStorage.setItem('rgaaudit-images-test-4', JSON.stringify(decisions));

    render(<AnnexeImages images={mockImages} sessionId="test-4" />);

    // Les anciennes décisions "violation" restent non conformes.
    expect(screen.getByRole('combobox', { name: /nature validée.*img#hero/i })).toHaveValue('informative');
    expect(screen.getByText('Non conforme')).toBeInTheDocument();
  });

  it('déduit le verdict depuis la nature et le alt', () => {
    render(<AnnexeImages images={mockImages} sessionId="test-5" />);

    expect(screen.getByRole('combobox', { name: /nature validée.*img#hero/i })).toHaveValue('informative');
    expect(screen.getByRole('combobox', { name: /nature validée.*img#deco/i })).toHaveValue('decorative');
    expect(screen.getAllByText('Non conforme', { exact: true })).toHaveLength(1);
    expect(screen.getAllByText('Conforme', { exact: true })).toHaveLength(2);
  });

  it('ne transforme pas une alerte automatique en verdict humain', () => {
    const image = { ...mockImages[1], automatedStatus: 'violation' as const };
    expect(deriveImageStatus(image, { decision: 'informative', correctedAlt: '' })).toBe('compliant');
  });

  it('enregistre le verdict et la correction proposée du alt', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ review: { imageDecisions: [] } }),
    } as Response);
    const user = userEvent.setup();
    render(<AnnexeImages images={mockImages} sessionId="test-6" />);

    await user.type(screen.getAllByRole('textbox', { name: /correction proposée/i })[0], 'Photographie de l’équipe');
    await user.click(screen.getByRole('button', { name: 'Enregistrer les modifications' }));

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    const [, init] = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(JSON.parse(String(init?.body))).toEqual(expect.objectContaining({
      decisions: [expect.objectContaining({
        decision: 'informative',
        status: 'non_compliant',
        correctedAlt: 'Photographie de l’équipe',
        elementIndex: 0,
      })],
    }));
  });

  it('marque une image non conforme si la nature validée diffère de la suggestion', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ review: { imageDecisions: [] } }),
    } as Response);
    const user = userEvent.setup();
    render(<AnnexeImages images={mockImages} sessionId="test-6b" />);

    await user.selectOptions(
      screen.getByRole('combobox', { name: /nature validée.*img#logo/i }),
      'decorative',
    );
    expect(screen.getAllByText('Non conforme', { exact: true })).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Enregistrer les modifications' }));

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    const [, init] = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(JSON.parse(String(init?.body))).toEqual(expect.objectContaining({
      decisions: [expect.objectContaining({
        decision: 'decorative',
        status: 'non_compliant',
        elementIndex: 1,
      })],
    }));
  });

  it('garde des décisions distinctes quand deux images ont le même sélecteur', () => {
    const duplicateImages = [
      { ...mockImages[1], elementIndex: 0, src: '/logo-a.png' },
      { ...mockImages[1], elementIndex: 1, src: '/logo-b.png' },
    ];
    render(
      <AnnexeImages
        images={duplicateImages}
        sessionId="test-7"
        initialDecisions={[{
          pageUrl: 'https://example.com/',
          selector: 'img#logo',
          elementIndex: 0,
          decision: 'decorative',
          status: 'not_applicable',
          correctedAlt: '',
          notes: '',
        }]}
      />,
    );

    expect(screen.getAllByRole('combobox', { name: /nature validée.*img#logo/i })[0]).toHaveValue('decorative');
    expect(screen.getAllByRole('combobox', { name: /nature validée.*img#logo/i })[1]).toHaveValue('informative');
  });
});
