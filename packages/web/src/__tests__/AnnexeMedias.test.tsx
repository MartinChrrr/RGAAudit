import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import AnnexeMedias, { type MediaItem } from '../components/annexes/AnnexeMedias';

const media: MediaItem[] = [{
  selector: 'video#demo',
  kind: 'video',
  sources: ['https://example.com/demo.mp4'],
  accessibleName: 'Démonstration',
  fallbackText: 'Lecteur vidéo',
  surroundingText: 'Présentation',
  controls: true,
  autoplay: false,
  tracks: [{ kind: 'captions', src: 'captions.vtt', srcLang: 'fr', label: 'Français', isDefault: true }],
  alternativeSources: ['aria-label', 'fallback-text'],
  criterionIds: ['4.1', '4.3'],
  manualChecks: ['4.1 — Vérifier la transcription'],
  flags: ['MEDIA_REQUIRES_HUMAN_REVIEW'],
  requiresHumanReview: true,
  evidence: [{
    criterionId: '4.3',
    state: 'observed',
    proof: ['piste captions (fr)'],
    limits: ['Vérification humaine requise'],
    humanChecks: ['4.3 — Vérifier la synchronisation'],
  }],
  pageUrl: 'https://example.com/',
}];

describe('AnnexeMedias', () => {
  it('affiche la source, les pistes et les contrôles manuels', () => {
    render(<AnnexeMedias media={media} />);

    expect(screen.getByTestId('annexe-media')).toBeInTheDocument();
    expect(screen.getByText('video#demo')).toBeInTheDocument();
    expect(screen.getByText('https://example.com/demo.mp4')).toBeInTheDocument();
    expect(screen.getByText(/Français · fr · par défaut/)).toBeInTheDocument();
    expect(screen.getByText('4.1 — Vérifier la transcription')).toBeInTheDocument();
    expect(screen.getByText(/piste captions \(fr\)/)).toBeInTheDocument();
    expect(screen.getByText(/Vérification humaine requise/)).toBeInTheDocument();
    expect(screen.getByText(/Validation humaine : 4.3/)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /Annexe Médias — faites défiler horizontalement/ })).toHaveAttribute('tabindex', '0');
  });

  it('permet de filtrer les médias par page', () => {
    render(<AnnexeMedias media={[media[0], { ...media[0], selector: 'audio#other', pageUrl: 'https://example.com/other' }]} />);

    const filter = screen.getByLabelText(/Filtrer par page/);
    fireEvent.change(filter, { target: { value: 'https://example.com/other' } });

    expect(screen.getByText('audio#other')).toBeInTheDocument();
    expect(screen.queryByText('video#demo')).not.toBeInTheDocument();
  });
});
