import { describe, expect, it } from 'vitest';
import {
  aggregateHumanStatus,
  coverageStatusesForCriterion,
  machineStatusFromLegacyStatus,
} from '../review';

describe('machineStatusFromLegacyStatus', () => {
  it('présente une violation comme une anomalie probable, pas comme un verdict', () => {
    expect(machineStatusFromLegacyStatus('violation')).toBe('probable_issue');
  });

  it('présente un passage automatique comme une absence d’anomalie détectée', () => {
    expect(machineStatusFromLegacyStatus('pass')).toBe('no_issue_detected');
    expect(machineStatusFromLegacyStatus('pass', 'partial')).toBe('needs_review');
    expect(machineStatusFromLegacyStatus('pass', 'manual_shell')).toBe('needs_review');
  });

  it('demande une revue pour les résultats manuels ou incomplets', () => {
    expect(machineStatusFromLegacyStatus('manual')).toBe('needs_review');
    expect(machineStatusFromLegacyStatus('incomplete')).toBe('needs_review');
  });
});

describe('aggregateHumanStatus', () => {
  it('reste non vérifié tant qu’une page ne l’est pas', () => {
    expect(aggregateHumanStatus(['compliant', 'not_tested'])).toBe('not_tested');
  });

  it('fait remonter une non-conformité et gère le non applicable', () => {
    expect(aggregateHumanStatus(['compliant', 'non_compliant'])).toBe('non_compliant');
    expect(aggregateHumanStatus(['not_tested', 'non_compliant'])).toBe('non_compliant');
    expect(aggregateHumanStatus(['not_applicable', 'not_applicable'])).toBe('not_applicable');
    expect(aggregateHumanStatus(['compliant', 'not_applicable'])).toBe('compliant');
  });
});

describe('coverageStatusesForCriterion', () => {
  it('sépare intégration, signal machine et attente de revue humaine', () => {
    expect(coverageStatusesForCriterion({
      implementationLot: 0,
      coverage: 'partial',
      humanStatus: 'not_tested',
      machineSignal: true,
    })).toEqual(['integrated', 'machine_signal', 'not_tested']);
  });

  it('marque un critère futur comme planifié sans lui attribuer un signal', () => {
    expect(coverageStatusesForCriterion({
      implementationLot: 2,
      coverage: 'manual_shell',
      humanStatus: 'compliant',
      machineSignal: false,
    })).toEqual(['planned', 'human_validated']);
  });
});
