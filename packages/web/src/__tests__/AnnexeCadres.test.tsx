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
  });
});
