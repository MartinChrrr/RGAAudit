import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import AnnexeCadres, { type FrameItem } from '../components/annexes/AnnexeCadres';

const frames: FrameItem[] = [
  {
    selector: 'iframe#missing',
    tagName: 'iframe',
    src: '/widget',
    titleAttribute: null,
    titleStatus: 'absent',
    flags: ['FRAME_TITLE_ABSENT'],
    pageUrl: 'https://example.com/',
  },
  {
    selector: 'iframe#help',
    tagName: 'iframe',
    src: '/help',
    titleAttribute: 'Aide',
    titleStatus: 'present',
    titleEvidence: {
      criterionId: '2.2',
      state: 'to_review',
      proof: ['Titre de cadre observé : Aide'],
      limits: ['Pertinence à vérifier'],
      humanChecks: ['2.2 — pertinence du titre'],
    },
    flags: [],
    pageUrl: 'https://example.com/',
  },
];

describe('AnnexeCadres', () => {
  it('affiche uniquement les cadres ciblés depuis le critère 2.1', () => {
    render(
      <AnnexeCadres
        frames={frames}
        sessionId="session-1"
        initialPageUrl="https://example.com/"
        focusedSelectors={['iframe#missing']}
        focusedCriterionId="2.1"
      />,
    );

    expect(screen.getByText(/1 élément\(s\) lié\(s\) au critère 2\.1/i)).toBeInTheDocument();
    expect(screen.getByText('iframe#missing')).toBeInTheDocument();
    expect(screen.queryByText('iframe#help')).not.toBeInTheDocument();
    expect(screen.getByText('Attribut title absent')).toBeInTheDocument();
  });

  it('affiche un état positif lorsque tous les cadres visibles ont un titre', () => {
    render(
      <AnnexeCadres
        frames={[frames[1]]}
        sessionId="session-1"
      />,
    );

    expect(screen.getByText('Tous les cadres affichés possèdent un titre')).toBeInTheDocument();
    expect(screen.getByText('Aide')).toBeInTheDocument();
    expect(screen.getByText(/Pertinence du titre — critère 2\.2/)).toBeInTheDocument();
  });

  it('signale une preuve de frame illisible même si son titre est présent', () => {
    render(
      <AnnexeCadres
        frames={[{ ...frames[1], evidenceStatus: 'unreadable', origin: 'https://other.example' }]}
        sessionId="session-1"
      />,
    );

    expect(screen.getByText('Preuve illisible — à vérifier')).toBeInTheDocument();
    expect(screen.getByText('https://other.example')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /annexe cadres/i })).toBeInTheDocument();
    expect(screen.getByRole('table')).toHaveAccessibleName('Annexe Cadres');
    expect(screen.getAllByRole('columnheader')).toHaveLength(5);
  });
});
