import { readdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import type { HeuristicAnalyzer } from './heuristic.interface';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Charge dynamiquement toutes les heuristiques du dossier.
 * Chaque fichier `*-heuristic.ts` (ou `.js`) doit exporter par défaut
 * un objet implémentant `HeuristicAnalyzer`.
 */
export async function getHeuristics(): Promise<HeuristicAnalyzer[]> {
  const files = await readdir(__dirname);
  const heuristicFiles = files.filter(
    (f) => f.endsWith('-heuristic.ts') || f.endsWith('-heuristic.js'),
  );

  const heuristics: HeuristicAnalyzer[] = [];

  for (const file of heuristicFiles) {
    const fullPath = resolve(__dirname, file);
    const fileUrl = pathToFileURL(fullPath).href;
    const mod = await import(fileUrl);
    const analyzer: HeuristicAnalyzer = mod.default ?? mod;
    if (typeof analyzer.analyze === 'function') {
      heuristics.push(analyzer);
    }
  }

  return heuristics;
}

export type { HeuristicAnalyzer, HeuristicResult, HeuristicFinding } from './heuristic.interface';
