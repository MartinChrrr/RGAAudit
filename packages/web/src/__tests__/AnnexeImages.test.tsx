import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AnnexeImages, { type ImageItem } from '../components/annexes/AnnexeImages';

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
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('AnnexeImages', () => {
  it('affiche le bon nombre de lignes', () => {
    render(<AnnexeImages images={mockImages} sessionId="test-1" />);

    const rows = screen.getAllByRole('row');
    // 1 header + 3 data rows
    expect(rows.length).toBe(4);
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
    const user = userEvent.setup();
    render(<AnnexeImages images={mockImages} sessionId="test-3" />);

    // Select a decision for the first image
    const radios = screen.getAllByRole('radio', { name: /décorative/i });
    await user.click(radios[0]);

    // Wait for debounce (500ms)
    await new Promise((r) => setTimeout(r, 600));

    const stored = localStorage.getItem('rgaaudit-images-test-3');
    expect(stored).toBeTruthy();
    const parsed = JSON.parse(stored!);
    expect(parsed['img#hero']).toBeDefined();
    expect(parsed['img#hero'].decision).toBe('decorative');
  });

  it('restaure les décisions depuis localStorage au montage', () => {
    // Pre-populate localStorage
    const decisions = {
      'img#hero': { decision: 'violation', notes: 'Alt manquant' },
    };
    localStorage.setItem('rgaaudit-images-test-4', JSON.stringify(decisions));

    render(<AnnexeImages images={mockImages} sessionId="test-4" />);

    // The "Violation" radio should be checked
    const violationRadios = screen.getAllByRole('radio', { name: /violation/i });
    // First image's violation radio
    expect(violationRadios[0]).toBeChecked();
  });
});
