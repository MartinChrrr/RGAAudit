import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import AnnexeFormulaires, { type FormItem } from '../components/annexes/AnnexeFormulaires';

const forms: FormItem[] = [{
  selector: '#account',
  action: '/account',
  method: 'post',
  pageUrl: 'https://example.com/form',
  flags: ['FORM_SUBMISSION_REVIEW', 'FORM_SUBMISSION_NOT_EXECUTED'],
  groups: [{ selector: 'fieldset#profile', legend: 'Profil', controlSelectors: ['#email'], flags: ['FORM_GROUP_REVIEW'] }],
  controls: [{
    selector: '#email',
    tagName: 'input',
    type: 'email',
    id: 'email',
    name: 'email',
    label: 'Adresse électronique',
    labelSource: 'label',
    required: true,
    invalid: true,
    autocomplete: 'email',
    describedByIds: ['email-help'],
    helpText: 'Utilisez une adresse professionnelle.',
    errorMessage: 'Saisissez une adresse valide.',
    flags: [],
    labelSelector: 'label[for="email"]',
    labelAdjacent: true,
  }],
}];

describe('AnnexeFormulaires', () => {
  it('affiche les champs, leurs aides et leurs erreurs', () => {
    render(<AnnexeFormulaires forms={forms} />);

    expect(screen.getByRole('heading', { name: 'Annexe Formulaires' })).toBeInTheDocument();
    expect(screen.getByText('Adresse électronique')).toBeInTheDocument();
    expect(screen.getByText('Utilisez une adresse professionnelle.')).toBeInTheDocument();
    expect(screen.getByText('Saisissez une adresse valide.')).toBeInTheDocument();
    expect(screen.getByText('Requis')).toBeInTheDocument();
    expect(screen.getByText('État invalide observé')).toBeInTheDocument();
    expect(screen.getByText('autocomplete: email')).toBeInTheDocument();
    expect(screen.getByText(/aucune soumission exécutée/)).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Champs du formulaire #account' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Annexe Formulaires — faites défiler horizontalement pour consulter toutes les colonnes' })).toBeInTheDocument();
    expect(screen.getByText(/Groupes de champs/)).toBeInTheDocument();
    expect(screen.getByText('fieldset#profile')).toBeInTheDocument();
  });

  it('signale un champ sans libellé', () => {
    render(<AnnexeFormulaires forms={[{
      ...forms[0],
      controls: [{ ...forms[0].controls[0], label: null, flags: ['FORM_LABEL_ABSENT'] }],
    }]} />);

    expect(screen.getByText('Libellé absent')).toBeInTheDocument();
    expect(screen.getByText('Libellé de champ absent')).toBeInTheDocument();
    expect(screen.getByText('À vérifier')).toBeInTheDocument();
  });
});
