import type { Page } from 'playwright';

// ---------------------------------------------------------------------------
// HeuristicFinding — un élément suspect détecté par une heuristique
// ---------------------------------------------------------------------------

export interface HeuristicFinding {
  /** Sélecteur CSS unique de l'élément suspect */
  selector: string;
  /** Extrait HTML de l'élément (max 200 caractères) */
  html: string;
  /**
   * Explication humaine de pourquoi c'est suspect.
   * Ex : "<a href='#' onclick='...'> — lien sans destination réelle"
   */
  evidence: string;
  /**
   * Niveau de confiance du résultat.
   *
   * - `"certain"` → affiché ❌ dans le rapport, **compte dans le score**
   * - `"likely"`   → affiché ⚠️ dans le rapport, **ne compte pas dans le score**
   * - `"possible"` → visible uniquement dans l'annexe, pas dans le résumé ni le score
   *
   * Ces niveaux sont NON-NÉGOCIABLES pour éviter les faux positifs qui
   * éroderaient la crédibilité de l'outil auprès des auditeurs professionnels.
   */
  confidence: 'certain' | 'likely' | 'possible';
  /** Texte environnant pour l'auditeur (max 100 caractères) */
  context: string;
}

// ---------------------------------------------------------------------------
// HeuristicResult — résultat complet d'une heuristique
// ---------------------------------------------------------------------------

export interface HeuristicResult {
  /** Identifiant unique de l'heuristique. Ex : "fake-interactive" */
  heuristicId: string;
  /** Critères RGAA concernés. Ex : ["7.1", "12.1"] */
  rgaaCriteria: string[];
  /** Éléments suspects détectés */
  findings: HeuristicFinding[];
  /**
   * Erreur rencontrée lors de l'analyse.
   * Les heuristiques ne doivent jamais throw — retourner l'erreur ici.
   */
  error: string | null;
}

// ---------------------------------------------------------------------------
// HeuristicAnalyzer — contrat pour chaque heuristique
// ---------------------------------------------------------------------------

/**
 * Interface pour les analyseurs heuristiques.
 *
 * Chaque heuristique implémente `analyze(page)` qui inspecte la page
 * Playwright et retourne un `HeuristicResult`.
 *
 * **Contrat :**
 * - Ne jamais `throw` — capturer les erreurs et les retourner dans `result.error`
 * - Tronquer `html` à 200 caractères et `context` à 100 caractères
 * - Utiliser le bon niveau de `confidence` selon les règles documentées ci-dessus
 */
export interface HeuristicAnalyzer {
  analyze(page: Page): Promise<HeuristicResult>;
}
