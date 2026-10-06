import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export type CriterionCoverage = 'full' | 'partial' | 'manual_shell';
export type HumanLevel = 'H0' | 'H1' | 'H2' | 'H3';
export type ImplementationLot = 0 | 1 | 2 | 3 | 4 | 5;

export interface RgaaCriterion {
  rgaa: { id: string; title: string; theme: string };
  wcag: string[];
  axeRules: string[];
  evaluationStrategy: string;
  dataCollectorFlags: string[];
  heuristicPatterns: Record<string, string[]>;
  altMaxLength?: number;
  limits: string;
  /** Niveau de couverture réellement fourni par le moteur. */
  coverage: CriterionCoverage;
  /** Niveau de validation humaine encore nécessaire. */
  humanLevel: HumanLevel;
  /** Lot du backlog dans lequel le critère est intégré (0 = socle actuel). */
  implementationLot: ImplementationLot;
}

export interface UncoveredTheme {
  id: string;
  name: string;
  manualChecklist: string[];
}

export interface RgaaMapping {
  version: string;
  totalCriteria: number;
  coveredThemes: string[];
  uncoveredThemes: UncoveredTheme[];
  overlayScripts: string[];
  criteria: RgaaCriterion[];
}

let cached: RgaaMapping | null = null;

export function loadMapping(): RgaaMapping {
  if (cached) return cached;
  const filePath = resolve(__dirname, 'rgaa-4.1.json');
  const raw = readFileSync(filePath, 'utf-8');
  const parsed = JSON.parse(raw) as RgaaMapping;
  validateMapping(parsed);
  cached = parsed;
  return cached;
}

function validateMapping(mapping: RgaaMapping): void {
  if (!Number.isInteger(mapping.totalCriteria) || mapping.totalCriteria <= 0) {
    throw new Error('Mapping invalide : totalCriteria doit être un entier positif');
  }
  if (!Array.isArray(mapping.criteria) || mapping.criteria.length !== mapping.totalCriteria) {
    throw new Error(`Mapping invalide : ${mapping.totalCriteria} critères attendus, ${mapping.criteria?.length ?? 0} trouvés`);
  }

  const ids = mapping.criteria.map((criterion) => criterion.rgaa?.id);
  if (ids.some((id) => !/^\d+\.\d+$/.test(id))) {
    throw new Error('Mapping invalide : chaque critère doit avoir un identifiant RGAA');
  }
  if (new Set(ids).size !== ids.length) {
    throw new Error('Mapping invalide : identifiants RGAA dupliqués');
  }

  for (const criterion of mapping.criteria) {
    if (!['full', 'partial', 'manual_shell'].includes(criterion.coverage)) {
      throw new Error(`Mapping invalide : couverture inconnue pour ${criterion.rgaa.id}`);
    }
    if (!['H0', 'H1', 'H2', 'H3'].includes(criterion.humanLevel)) {
      throw new Error(`Mapping invalide : niveau humain inconnu pour ${criterion.rgaa.id}`);
    }
    if (![0, 1, 2, 3, 4, 5].includes(criterion.implementationLot)) {
      throw new Error(`Mapping invalide : lot d'implémentation inconnu pour ${criterion.rgaa.id}`);
    }
  }
}

export function getCriterion(id: string): RgaaCriterion | undefined {
  return loadMapping().criteria.find((c) => c.rgaa.id === id);
}
