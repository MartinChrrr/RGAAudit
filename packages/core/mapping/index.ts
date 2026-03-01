import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface RgaaCriterion {
  rgaa: { id: string; title: string; theme: string };
  wcag: string[];
  axeRules: string[];
  evaluationStrategy: string;
  dataCollectorFlags: string[];
  heuristicPatterns: Record<string, string[]>;
  altMaxLength?: number;
  limits: string;
}

export interface RgaaMapping {
  version: string;
  criteria: RgaaCriterion[];
}

let cached: RgaaMapping | null = null;

export function loadMapping(): RgaaMapping {
  if (cached) return cached;
  const filePath = resolve(__dirname, 'rgaa-4.1.json');
  const raw = readFileSync(filePath, 'utf-8');
  cached = JSON.parse(raw) as RgaaMapping;
  return cached;
}

export function getCriterion(id: string): RgaaCriterion | undefined {
  return loadMapping().criteria.find((c) => c.rgaa.id === id);
}
