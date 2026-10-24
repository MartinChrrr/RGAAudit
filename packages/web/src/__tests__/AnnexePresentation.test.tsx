import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import AnnexePresentation, { type PresentationSnapshotItem } from '../components/annexes/AnnexePresentation';

const snapshot: PresentationSnapshotItem = {
  scenario: 'viewport-320x256',
  status: 'observed',
  viewportWidth: 320,
  viewportHeight: 256,
  documentScrollWidth: 480,
  documentClientWidth: 320,
  focusObservations: [{
    selector: '#action',
    tagName: 'button',
    role: null,
    text: 'Action',
    focusVisible: false,
    flags: ['PRESENTATION_FOCUS_INDICATOR_NOT_OBSERVED'],
  }],
  flags: ['PRESENTATION_FOCUS_INDICATOR_NOT_OBSERVED'],
  pageUrl: 'https://example.com/',
};

describe('AnnexePresentation', () => {
  it('affiche le viewport et les preuves de focus sans verdict automatique', () => {
    render(<AnnexePresentation snapshots={[snapshot]} />);

    expect(screen.getByTestId('annexe-presentation')).toBeInTheDocument();
    expect(screen.getByText('Viewport 320 × 256')).toBeInTheDocument();
    expect(screen.getByText('Observé')).toBeInTheDocument();
    expect(screen.getByText('#action')).toBeInTheDocument();
    expect(screen.getByText(/indicateur non observé/)).toBeInTheDocument();
    expect(screen.getByRole('region')).toHaveAttribute('tabindex', '0');
  });

  it('isole les observations transmises par la revue du critère', () => {
    render(
      <AnnexePresentation
        snapshots={[
          snapshot,
          { ...snapshot, scenario: 'baseline', focusObservations: [{ ...snapshot.focusObservations![0], selector: '#other' }] },
        ]}
        focusedSelectors={['#action[viewport-320x256]']}
        focusedCriterionId="10.7"
      />,
    );

    expect(screen.getByText(/10\.7/)).toBeInTheDocument();
    expect(screen.getByText('#action')).toBeInTheDocument();
    expect(screen.queryByText('#other')).not.toBeInTheDocument();
  });
});
