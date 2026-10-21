import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
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
  });
});
