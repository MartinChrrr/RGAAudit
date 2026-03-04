import type { Page } from 'playwright';
import type { HeuristicAnalyzer, HeuristicResult } from './heuristic.interface';

/**
 * Heuristique de test — retourne toujours 1 finding "certain"
 * sur le premier élément de la page.
 * Utilisée pour valider que le pipeline complet fonctionne.
 */
const stubHeuristic: HeuristicAnalyzer = {
  async analyze(page: Page): Promise<HeuristicResult> {
    try {
      const firstElement = await page.$('body *');
      const html = firstElement
        ? await firstElement.evaluate((el) => el.outerHTML.slice(0, 200))
        : '<unknown>';
      const selector = firstElement
        ? await firstElement.evaluate((el) => {
            const tag = el.tagName.toLowerCase();
            const id = el.id ? `#${el.id}` : '';
            return `${tag}${id}`;
          })
        : 'body';

      return {
        heuristicId: 'stub',
        rgaaCriteria: ['1.1'],
        findings: [
          {
            selector,
            html: html.slice(0, 200),
            evidence: 'Élément détecté par l\'heuristique de test (stub)',
            confidence: 'certain',
            context: 'stub heuristic — test only'.slice(0, 100),
          },
        ],
        error: null,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        heuristicId: 'stub',
        rgaaCriteria: ['1.1'],
        findings: [],
        error: message,
      };
    }
  },
};

export default stubHeuristic;
