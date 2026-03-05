import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AnnexeHeuristiques, { type HeuristicFindingItem } from '../components/annexes/AnnexeHeuristiques';

const mockFindings: HeuristicFindingItem[] = [
  {
    selector: '#fake-link-hash',
    html: '<a href="#" onclick="doSomething()" id="fake-link-hash">Ouvrir</a>',
    evidence: "<a href='#'> avec handler onclick",
    confidence: 'certain',
    context: 'Ouvrir le modal',
    heuristicId: 'fake-interactive',
    rgaaCriteria: ['7.1'],
    pageUrl: 'https://example.com/',
  },
  {
    selector: '#div-clickable',
    html: '<div onclick="openMenu()" id="div-clickable">Menu</div>',
    evidence: '<div onclick> sans role ARIA',
    confidence: 'likely',
    context: 'Menu',
    heuristicId: 'fake-interactive',
    rgaaCriteria: ['7.1'],
    pageUrl: 'https://example.com/',
  },
  {
    selector: '#focusable-no-role',
    html: '<div tabindex="0" id="focusable-no-role">Focusable</div>',
    evidence: 'focusable sans rôle déclaré',
    confidence: 'possible',
    context: 'Focusable element',
    heuristicId: 'fake-interactive',
    rgaaCriteria: ['7.1'],
    pageUrl: 'https://example.com/',
  },
  {
    selector: '#fake-heading',
    html: '<div style="font-size:28px" id="fake-heading">Notre mission</div>',
    evidence: 'probablement un titre',
    confidence: 'likely',
    context: 'Notre mission',
    heuristicId: 'unsemantic-text',
    rgaaCriteria: ['8.9'],
    pageUrl: 'https://example.com/',
  },
  {
    selector: '#svg-no-title',
    html: '<svg role="img" id="svg-no-title"><circle/></svg>',
    evidence: "sans <title> enfant",
    confidence: 'certain',
    context: '',
    heuristicId: 'svg-accessible',
    rgaaCriteria: ['1.1'],
    pageUrl: 'https://example.com/',
  },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AnnexeHeuristiques', () => {
  it('les findings "possible" sont masqués par défaut', () => {
    render(<AnnexeHeuristiques findings={mockFindings} sessionId="test-1" />);

    // The "possible" finding should not be visible
    const cards = screen.getAllByTestId('finding-card');
    const possibleCards = cards.filter(
      (card) => card.getAttribute('data-confidence') === 'possible',
    );
    expect(possibleCards).toHaveLength(0);

    // The "certain" finding should be visible
    const certainCards = cards.filter(
      (card) => card.getAttribute('data-confidence') === 'certain',
    );
    expect(certainCards.length).toBeGreaterThanOrEqual(1);
  });

  it('toggle "Afficher les détections possibles" → findings "possible" apparaissent', async () => {
    const user = userEvent.setup();
    render(<AnnexeHeuristiques findings={mockFindings} sessionId="test-2" />);

    const toggle = screen.getByTestId('toggle-possible');
    await user.click(toggle);

    const cards = screen.getAllByTestId('finding-card');
    const possibleCards = cards.filter(
      (card) => card.getAttribute('data-confidence') === 'possible',
    );
    expect(possibleCards.length).toBeGreaterThanOrEqual(1);
  });

  it('filtre "Certain" masque les findings "likely" et "possible"', async () => {
    const user = userEvent.setup();
    render(<AnnexeHeuristiques findings={mockFindings} sessionId="test-3" />);

    await user.click(screen.getByTestId('filter-certain'));

    const cards = screen.getAllByTestId('finding-card');
    for (const card of cards) {
      expect(card.getAttribute('data-confidence')).toBe('certain');
    }
  });

  it('un finding sans contexte n\'affiche pas de section contexte vide', async () => {
    const user = userEvent.setup();
    render(<AnnexeHeuristiques findings={mockFindings} sessionId="test-4" />);

    // Switch to SVG tab to see the finding without context
    const svgTab = screen.getByTestId('subtab-svg');
    await user.click(svgTab);

    const cards = screen.getAllByTestId('finding-card');
    // The SVG finding has empty context — no "finding-context" element should be present
    const svgCard = cards[0];
    expect(svgCard.querySelector('[data-testid="finding-context"]')).toBeNull();
  });

  it('le sélecteur CSS est copiable au clic', async () => {
    const user = userEvent.setup();

    // Mock clipboard via defineProperty (navigator.clipboard is read-only in jsdom)
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      writable: true,
      configurable: true,
    });

    render(<AnnexeHeuristiques findings={mockFindings} sessionId="test-5" />);

    const selectorButtons = screen.getAllByTestId('selector-copy');
    await user.click(selectorButtons[0]);

    expect(writeTextMock).toHaveBeenCalledWith('#fake-link-hash');
  });
});
