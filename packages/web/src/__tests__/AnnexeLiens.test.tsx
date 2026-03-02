import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AnnexeLiens, { type LinkItem } from '../components/annexes/AnnexeLiens';

const mockLinks: LinkItem[] = [
  {
    selector: 'a#link1',
    tagName: 'a',
    accessibleLabel: 'lire la suite',
    href: 'https://example.com/article-1',
    opensNewWindow: false,
    hasNewWindowWarning: false,
    flags: ['GENERIC_LABEL'],
    pageUrl: 'https://example.com/',
  },
  {
    selector: 'a#link2',
    tagName: 'a',
    accessibleLabel: 'lire la suite',
    href: 'https://example.com/article-2',
    opensNewWindow: false,
    hasNewWindowWarning: false,
    flags: ['GENERIC_LABEL'],
    pageUrl: 'https://example.com/',
  },
  {
    selector: 'a#link3',
    tagName: 'a',
    accessibleLabel: 'lire la suite',
    href: 'https://example.com/article-3',
    opensNewWindow: false,
    hasNewWindowWarning: false,
    flags: ['GENERIC_LABEL'],
    pageUrl: 'https://example.com/page2',
  },
  {
    selector: 'a#link4',
    tagName: 'a',
    accessibleLabel: null,
    href: 'https://example.com/empty',
    opensNewWindow: false,
    hasNewWindowWarning: false,
    flags: ['EMPTY_LABEL'],
    pageUrl: 'https://example.com/',
  },
  {
    selector: 'a#link5',
    tagName: 'a',
    accessibleLabel: 'Contact',
    href: 'https://example.com/contact',
    opensNewWindow: true,
    hasNewWindowWarning: false,
    flags: ['NEW_WINDOW_NO_WARNING'],
    pageUrl: 'https://example.com/',
  },
];

describe('AnnexeLiens', () => {
  it('groupe les doublons (même label, URLs différentes)', async () => {
    const user = userEvent.setup();
    render(<AnnexeLiens links={mockLinks} sessionId="test-1" />);

    // Switch to duplicates filter
    await user.click(screen.getByText(/doublons/i, { selector: 'button' }));

    // Should display a grouped row with count
    const duplicateLabel = screen.getByTestId('duplicate-label');
    expect(duplicateLabel).toBeInTheDocument();
    expect(duplicateLabel.textContent).toContain('lire la suite');
    expect(duplicateLabel.textContent).toContain('3');
  });

  it('affiche tous les liens en mode table', () => {
    render(<AnnexeLiens links={mockLinks} sessionId="test-2" />);

    const rows = screen.getAllByRole('row');
    // 1 header + 5 data rows
    expect(rows.length).toBe(6);
  });

  it('filtre les liens vides', async () => {
    const user = userEvent.setup();
    render(<AnnexeLiens links={mockLinks} sessionId="test-3" />);

    await user.click(screen.getByText(/vides/i, { selector: 'button' }));

    const rows = screen.getAllByRole('row');
    // 1 header + 1 empty link
    expect(rows.length).toBe(2);
  });
});
