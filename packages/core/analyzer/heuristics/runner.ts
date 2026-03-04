import type { Page } from 'playwright';
import type { HeuristicResult, HeuristicFinding } from './heuristic.interface';
import { getHeuristics } from './index';

// ---------------------------------------------------------------------------
// Types pour les résultats agrégés
// ---------------------------------------------------------------------------

export interface AggregatedHeuristicFinding extends HeuristicFinding {
  heuristicId: string;
}

export interface AggregatedHeuristics {
  /** Findings regroupés par critère RGAA */
  byCriterion: Record<string, AggregatedHeuristicFinding[]>;
  /** Findings "certain" — comptent dans le score (❌) */
  violations: AggregatedHeuristicFinding[];
  /** Findings "likely" — affichés ⚠️, ne comptent pas dans le score */
  warnings: AggregatedHeuristicFinding[];
  /** Findings "possible" — annexe uniquement */
  suggestions: AggregatedHeuristicFinding[];
  /** Erreurs rencontrées par les heuristiques */
  errors: Array<{ heuristicId: string; error: string }>;
}

// ---------------------------------------------------------------------------
// runAllHeuristics
// ---------------------------------------------------------------------------

/**
 * Lance toutes les heuristiques en parallèle sur la page.
 * - Utilise `Promise.allSettled` pour ne jamais bloquer sur une heuristique défaillante
 * - Si une heuristique throw malgré tout : capture et retourne `{ findings: [], error: msg }`
 */
export async function runAllHeuristics(page: Page): Promise<HeuristicResult[]> {
  const heuristics = await getHeuristics();

  if (heuristics.length === 0) {
    return [];
  }

  const settled = await Promise.allSettled(
    heuristics.map((h) => h.analyze(page)),
  );

  return settled.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    }
    // Heuristique qui a throw malgré le contrat
    const error = result.reason instanceof Error
      ? result.reason.message
      : String(result.reason);
    return {
      heuristicId: `unknown-heuristic-${index}`,
      rgaaCriteria: [],
      findings: [],
      error,
    };
  });
}

// ---------------------------------------------------------------------------
// aggregateHeuristicResults
// ---------------------------------------------------------------------------

/**
 * Regroupe les findings par critère RGAA et filtre par confidence :
 * - `"certain"`  → violations (comptent dans le score)
 * - `"likely"`   → warnings (ne comptent pas dans le score)
 * - `"possible"` → suggestions (annexe uniquement)
 */
export function aggregateHeuristicResults(
  results: HeuristicResult[],
): AggregatedHeuristics {
  const byCriterion: Record<string, AggregatedHeuristicFinding[]> = {};
  const violations: AggregatedHeuristicFinding[] = [];
  const warnings: AggregatedHeuristicFinding[] = [];
  const suggestions: AggregatedHeuristicFinding[] = [];
  const errors: Array<{ heuristicId: string; error: string }> = [];

  for (const result of results) {
    if (result.error) {
      errors.push({ heuristicId: result.heuristicId, error: result.error });
    }

    for (const finding of result.findings) {
      const augmented: AggregatedHeuristicFinding = {
        ...finding,
        heuristicId: result.heuristicId,
      };

      // Regrouper par critère RGAA
      for (const criterionId of result.rgaaCriteria) {
        if (!byCriterion[criterionId]) {
          byCriterion[criterionId] = [];
        }
        byCriterion[criterionId].push(augmented);
      }

      // Classer par confidence
      switch (finding.confidence) {
        case 'certain':
          violations.push(augmented);
          break;
        case 'likely':
          warnings.push(augmented);
          break;
        case 'possible':
          suggestions.push(augmented);
          break;
      }
    }
  }

  return { byCriterion, violations, warnings, suggestions, errors };
}
