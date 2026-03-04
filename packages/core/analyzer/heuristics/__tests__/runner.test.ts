import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { HeuristicResult, HeuristicAnalyzer } from '../heuristic.interface';
import { aggregateHeuristicResults } from '../runner';

// ---------------------------------------------------------------------------
// Mock getHeuristics pour contrôler les heuristiques chargées
// ---------------------------------------------------------------------------

const mockGetHeuristics = vi.hoisted(() => vi.fn());

vi.mock('../index', () => ({
  getHeuristics: mockGetHeuristics,
}));

// Import after mock setup
import { runAllHeuristics } from '../runner';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFinding(overrides?: Partial<HeuristicResult['findings'][0]>) {
  return {
    selector: 'div.test',
    html: '<div class="test">contenu</div>',
    evidence: 'Élément de test suspect',
    confidence: 'certain' as const,
    context: 'contexte de test',
    ...overrides,
  };
}

function makeHeuristicResult(overrides?: Partial<HeuristicResult>): HeuristicResult {
  return {
    heuristicId: 'test-heuristic',
    rgaaCriteria: ['1.1'],
    findings: [makeFinding()],
    error: null,
    ...overrides,
  };
}

/** Page Playwright factice pour les tests */
const mockPage = {} as any;

// ---------------------------------------------------------------------------
// runAllHeuristics
// ---------------------------------------------------------------------------

describe('runAllHeuristics', () => {
  beforeEach(() => {
    mockGetHeuristics.mockReset();
  });

  it('retourne un tableau même si une heuristique throw', async () => {
    const goodHeuristic: HeuristicAnalyzer = {
      async analyze() {
        return makeHeuristicResult({ heuristicId: 'good' });
      },
    };

    const badHeuristic: HeuristicAnalyzer = {
      async analyze() {
        throw new Error('Heuristique cassée');
      },
    };

    mockGetHeuristics.mockResolvedValue([goodHeuristic, badHeuristic]);

    const results = await runAllHeuristics(mockPage);

    expect(Array.isArray(results)).toBe(true);
    expect(results).toHaveLength(2);

    // La bonne heuristique a ses résultats
    const good = results.find((r) => r.heuristicId === 'good');
    expect(good).toBeDefined();
    expect(good!.findings).toHaveLength(1);
    expect(good!.error).toBeNull();

    // La mauvaise heuristique a une erreur capturée
    const bad = results.find((r) => r.error !== null && r.heuristicId !== 'good');
    expect(bad).toBeDefined();
    expect(bad!.error).toContain('Heuristique cassée');
    expect(bad!.findings).toHaveLength(0);
  });

  it('une heuristique défaillante ne bloque pas les autres', async () => {
    const heuristic1: HeuristicAnalyzer = {
      async analyze() {
        return makeHeuristicResult({ heuristicId: 'h1', findings: [makeFinding({ selector: '#a' })] });
      },
    };
    const heuristic2: HeuristicAnalyzer = {
      async analyze() {
        throw new Error('crash');
      },
    };
    const heuristic3: HeuristicAnalyzer = {
      async analyze() {
        return makeHeuristicResult({ heuristicId: 'h3', findings: [makeFinding({ selector: '#c' })] });
      },
    };

    mockGetHeuristics.mockResolvedValue([heuristic1, heuristic2, heuristic3]);

    const results = await runAllHeuristics(mockPage);

    expect(results).toHaveLength(3);

    // h1 et h3 ont bien leurs résultats
    const h1 = results.find((r) => r.heuristicId === 'h1');
    const h3 = results.find((r) => r.heuristicId === 'h3');
    expect(h1!.findings).toHaveLength(1);
    expect(h3!.findings).toHaveLength(1);

    // h2 est en erreur mais n'a pas bloqué
    const errored = results.find((r) => r.error !== null);
    expect(errored).toBeDefined();
    expect(errored!.error).toContain('crash');
  });

  it('retourne un tableau vide si aucune heuristique chargée', async () => {
    mockGetHeuristics.mockResolvedValue([]);

    const results = await runAllHeuristics(mockPage);

    expect(results).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// aggregateHeuristicResults
// ---------------------------------------------------------------------------

describe('aggregateHeuristicResults', () => {
  it('les findings "certain" sont dans violations', () => {
    const results: HeuristicResult[] = [
      makeHeuristicResult({
        heuristicId: 'h1',
        rgaaCriteria: ['1.1'],
        findings: [
          makeFinding({ confidence: 'certain', selector: '#certain-el' }),
        ],
      }),
    ];

    const aggregated = aggregateHeuristicResults(results);

    expect(aggregated.violations).toHaveLength(1);
    expect(aggregated.violations[0].selector).toBe('#certain-el');
    expect(aggregated.violations[0].heuristicId).toBe('h1');
    expect(aggregated.warnings).toHaveLength(0);
    expect(aggregated.suggestions).toHaveLength(0);
  });

  it('les findings "likely" sont dans warnings, pas dans violations', () => {
    const results: HeuristicResult[] = [
      makeHeuristicResult({
        heuristicId: 'h1',
        rgaaCriteria: ['6.1'],
        findings: [
          makeFinding({ confidence: 'likely', selector: '#likely-el' }),
        ],
      }),
    ];

    const aggregated = aggregateHeuristicResults(results);

    expect(aggregated.warnings).toHaveLength(1);
    expect(aggregated.warnings[0].selector).toBe('#likely-el');
    expect(aggregated.violations).toHaveLength(0);
    expect(aggregated.suggestions).toHaveLength(0);
  });

  it('les findings "possible" ne sont pas dans le résumé (ni violations ni warnings)', () => {
    const results: HeuristicResult[] = [
      makeHeuristicResult({
        heuristicId: 'h1',
        rgaaCriteria: ['9.1'],
        findings: [
          makeFinding({ confidence: 'possible', selector: '#possible-el' }),
        ],
      }),
    ];

    const aggregated = aggregateHeuristicResults(results);

    expect(aggregated.suggestions).toHaveLength(1);
    expect(aggregated.suggestions[0].selector).toBe('#possible-el');
    expect(aggregated.violations).toHaveLength(0);
    expect(aggregated.warnings).toHaveLength(0);
  });

  it('regroupe les findings par critère RGAA', () => {
    const results: HeuristicResult[] = [
      makeHeuristicResult({
        heuristicId: 'h1',
        rgaaCriteria: ['1.1', '1.2'],
        findings: [
          makeFinding({ confidence: 'certain', selector: '#el1' }),
        ],
      }),
      makeHeuristicResult({
        heuristicId: 'h2',
        rgaaCriteria: ['1.1'],
        findings: [
          makeFinding({ confidence: 'likely', selector: '#el2' }),
        ],
      }),
    ];

    const aggregated = aggregateHeuristicResults(results);

    // Critère 1.1 doit avoir 2 findings
    expect(aggregated.byCriterion['1.1']).toHaveLength(2);
    // Critère 1.2 doit avoir 1 finding
    expect(aggregated.byCriterion['1.2']).toHaveLength(1);
  });

  it('collecte les erreurs des heuristiques', () => {
    const results: HeuristicResult[] = [
      makeHeuristicResult({
        heuristicId: 'broken',
        findings: [],
        error: 'quelque chose a planté',
      }),
    ];

    const aggregated = aggregateHeuristicResults(results);

    expect(aggregated.errors).toHaveLength(1);
    expect(aggregated.errors[0].heuristicId).toBe('broken');
    expect(aggregated.errors[0].error).toContain('planté');
  });

  it('gère un tableau vide de résultats', () => {
    const aggregated = aggregateHeuristicResults([]);

    expect(aggregated.violations).toHaveLength(0);
    expect(aggregated.warnings).toHaveLength(0);
    expect(aggregated.suggestions).toHaveLength(0);
    expect(aggregated.errors).toHaveLength(0);
    expect(Object.keys(aggregated.byCriterion)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Factory (getHeuristics) — mock fs pour vérifier le chargement
// ---------------------------------------------------------------------------

describe('getHeuristics factory', () => {
  it('charge les fichiers *-heuristic du dossier', async () => {
    // On vérifie via le mock que getHeuristics est bien appelé
    // et retourne les heuristiques qu'on lui fournit
    const stubAnalyzer: HeuristicAnalyzer = {
      async analyze() {
        return makeHeuristicResult({ heuristicId: 'stub' });
      },
    };

    mockGetHeuristics.mockResolvedValue([stubAnalyzer]);

    const heuristics = await mockGetHeuristics();

    expect(heuristics).toHaveLength(1);
    expect(typeof heuristics[0].analyze).toBe('function');

    const result = await heuristics[0].analyze(mockPage);
    expect(result.heuristicId).toBe('stub');
  });

  it('retourne un tableau vide si aucun fichier *-heuristic', async () => {
    mockGetHeuristics.mockResolvedValue([]);

    const heuristics = await mockGetHeuristics();

    expect(heuristics).toHaveLength(0);
  });
});
