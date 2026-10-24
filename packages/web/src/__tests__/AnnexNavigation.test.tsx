import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Results from '../pages/Results';

const image = (selector: string, altAttribute: string) => ({
  selector,
  tagName: 'img',
  src: `/${selector.slice(4)}.png`,
  altAttribute,
  altStatus: 'present' as const,
  automatedStatus: 'pass' as const,
  flags: [],
  surroundingText: '',
  screenshotPath: null,
  isInLink: false,
  linkText: null,
});

const report = {
  metadata: {
    url: 'https://example.com/',
    date: '2026-09-11',
    pagesAudited: 1,
    coveredThemes: ['Images', 'Cadres'],
    totalRgaaCriteria: 106,
    coveredCriteria: 2,
  },
  limitBanner: 'Rapport assisté à confirmer manuellement.',
  summary: {
    totalCriteria: 2,
    violations: 1,
    passes: 1,
    manual: 0,
    criteria: [
      { rgaaId: '1.1', title: 'Images', status: 'pass' },
      { rgaaId: '2.1', title: 'Cadres', status: 'violation' },
    ],
    topIssues: [],
    overlaysDetected: false,
  },
  uncoveredThemes: [],
  allCollected: [{
    url: 'https://example.com/',
    collectedData: {
      images: [image('img#one', 'Une'), image('img#two', 'Deux')],
      frames: [{
        selector: 'iframe#missing-title',
        tagName: 'iframe',
        src: '/widget',
        titleAttribute: null,
        titleStatus: 'absent' as const,
        flags: ['FRAME_TITLE_ABSENT'],
      }],
      links: [],
      headings: { documentTitle: 'Test', headings: [], flags: [] },
    },
  }],
  review: {
    updatedAt: '2026-09-11T00:00:00.000Z',
    summary: {
      total: 2,
      reviewed: 0,
      compliant: 0,
      nonCompliant: 0,
      notApplicable: 0,
      notTested: 2,
    },
    pages: [{
      url: 'https://example.com/',
      criteria: [
        {
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
          elements: [{ selector: 'img#one', flags: [], elementIndex: 0 }],
          manualChecks: [],
        },
        {
          rgaaId: '2.1',
          title: 'Chaque cadre a-t-il un titre de cadre ?',
          theme: 'Cadres',
          coverage: 'full',
          humanLevel: 'H0',
          implementationLot: 0,
          wcag: ['4.1.2'],
          machineStatus: 'probable_issue',
          humanStatus: 'not_tested',
          comment: '',
          reviewedAt: null,
          violationsCount: 1,
          incompletesCount: 0,
          elements: [{ selector: 'iframe#missing-title', flags: ['FRAME_TITLE_ABSENT'] }],
          manualChecks: [],
        },
      ],
    }],
  },
};

describe('navigation entre un critère et son annexe', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(report),
    } as Response);
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    });
  });

  it('ouvre l’annexe Images et limite la liste aux éléments du critère', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/results/session-1']}>
        <Routes>
          <Route path="/results/:sessionId" element={<Results />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole('button', { name: /examiner dans l’annexe images/i }));

    await waitFor(() => {
      expect(screen.getByText(/1 élément\(s\) lié\(s\) au critère 1\.1/i)).toBeInTheDocument();
      expect(screen.getAllByRole('row')).toHaveLength(2);
    });
    expect(document.getElementById('annexes')).toContainElement(screen.getByRole('tabpanel'));
  });

  it('ouvre l’annexe Cadres sur les éléments du critère 2.1', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/results/session-1']}>
        <Routes>
          <Route path="/results/:sessionId" element={<Results />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole('button', { name: /examiner dans l’annexe cadres/i }));

    await waitFor(() => {
      expect(screen.getByText(/1 élément\(s\) lié\(s\) au critère 2\.1/i)).toBeInTheDocument();
      expect(screen.getAllByText('iframe#missing-title').length).toBeGreaterThan(0);
      expect(screen.getByText('Attribut title absent')).toBeInTheDocument();
    });
  });
});
