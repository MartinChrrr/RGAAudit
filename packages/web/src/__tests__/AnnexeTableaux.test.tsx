import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import AnnexeTableaux, { type TableItem } from '../components/annexes/AnnexeTableaux';

const table: TableItem = {
  selector: '#complex-data',
  dataFeatures: ['TH', 'SCOPE'],
  flags: ['TABLE_COMPLEX_CANDIDATE'],
  tableKind: 'data_candidate',
  complexitySignals: ['ROWSPAN_PRESENT'],
  captionText: 'Résultats',
  summaryText: 'Résumé',
  linearizedText: 'Nom | Score',
  pageUrl: 'https://example.com/',
};

describe('AnnexeTableaux', () => {
  it('affiche les preuves et conserve la décision humaine explicite', () => {
    render(<AnnexeTableaux tables={[table]} />);

    expect(screen.getByTestId('annexe-tables')).toBeInTheDocument();
    expect(screen.getByText('#complex-data')).toBeInTheDocument();
    expect(screen.getByText('Nom | Score')).toBeInTheDocument();
    expect(screen.getByText(/Caractéristiques observées : TH, SCOPE/)).toBeInTheDocument();
    expect(screen.getByText(/Revue humaine requise/)).toBeInTheDocument();
    expect(screen.getByRole('region')).toHaveAttribute('tabindex', '0');
    expect(screen.getAllByRole('columnheader')).toHaveLength(5);
  });

  it('permet de filtrer par page', () => {
    render(<AnnexeTableaux tables={[table, { ...table, selector: '#layout', pageUrl: 'https://example.com/other' }]} />);

    fireEvent.change(screen.getByLabelText(/Filtrer par page/), { target: { value: 'https://example.com/other' } });

    expect(screen.getByText('#layout')).toBeInTheDocument();
    expect(screen.queryByText('#complex-data')).not.toBeInTheDocument();
  });

  it('isole le tableau ciblé depuis une revue de critère', () => {
    render(<AnnexeTableaux tables={[table, { ...table, selector: '#other' }]} focusedSelectors={['#complex-data']} focusedCriterionId="5.1" />);

    expect(screen.getByText(/5\.1/)).toBeInTheDocument();
    expect(screen.getByText('#complex-data')).toBeInTheDocument();
    expect(screen.queryByText('#other')).not.toBeInTheDocument();
  });
});
