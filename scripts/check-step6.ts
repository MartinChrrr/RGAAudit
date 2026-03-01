// Checkpoint manuel — Étape 6 : Mapper RGAA
// Usage : npx tsx scripts/check-step6.ts

import fs from 'node:fs';
import path from 'node:path';
import type { EngineResult } from '../packages/core/engines/engine.interface';
import type { CollectedData } from '../packages/core/analyzer/data-collector';
import {
  loadMapping,
  mapPageResults,
  aggregateResults,
  buildReport,
} from '../packages/core/mapping/mapper';

function makeAxeResult(overrides?: Partial<EngineResult>): EngineResult {
  return { violations: [], passes: [], incomplete: [], ...overrides };
}

function makeCollectedData(overrides?: Partial<CollectedData>): CollectedData {
  return {
    images: [],
    links: [],
    headings: {
      documentTitle: 'Test',
      headings: [{ level: 1, text: 'H1', selector: 'h1', flags: [] }],
      flags: [],
    },
    ...overrides,
  };
}

function main() {
  console.log('=== Étape 6 — Checkpoints manuels ===\n');

  // 1. loadMapping
  console.log('--- loadMapping ---');
  const mapping = loadMapping();
  console.log(`  version: ${mapping.version}`);
  console.log(`  ${mapping.criteria.length} critères chargés`);
  console.log(mapping.version === '4.1' && mapping.criteria.length > 0
    ? '✅ Mapping chargé et validé'
    : '❌ Mapping invalide');

  // 2. mapPageResults — violation image-alt → critère 1.1 violation
  console.log('\n--- mapPageResults : 1 violation image-alt ---');
  const axeViolation = makeAxeResult({
    violations: [{
      rule: 'image-alt',
      impact: 'critical',
      description: 'Images must have alternate text',
      helpUrl: 'https://dequeuniversity.com/rules/axe/4.9/image-alt',
      elements: [{ html: '<img src="x">', target: ['img'] }],
    }],
  });
  const result1 = mapPageResults(axeViolation, makeCollectedData(), 'http://example.com/page1');
  const c11 = result1.criteria.find((c) => c.rgaaId === '1.1');
  console.log(`  Critère 1.1 status: ${c11?.status}`);
  console.log(c11?.status === 'violation'
    ? '✅ Critère 1.1 = violation'
    : '❌ Critère 1.1 devrait être violation');

  // 3. mapPageResults — 0 violation → critère 1.1 pass
  console.log('\n--- mapPageResults : 0 violation → pass ---');
  const axePass = makeAxeResult({
    passes: [{ rule: 'image-alt', description: 'ok', elements: [] }],
  });
  const result2 = mapPageResults(axePass, makeCollectedData(), 'http://example.com/page2');
  const c11pass = result2.criteria.find((c) => c.rgaaId === '1.1');
  console.log(`  Critère 1.1 status: ${c11pass?.status}`);
  console.log(c11pass?.status === 'pass'
    ? '✅ Critère 1.1 = pass'
    : '❌ Critère 1.1 devrait être pass');

  // 4. MANUAL_ONLY — critère 8.6 → toujours manual
  console.log('\n--- MANUAL_ONLY : critère 8.6 ---');
  const result3 = mapPageResults(axePass, makeCollectedData({
    headings: { documentTitle: 'accueil', headings: [], flags: ['TITLE_GENERIC'] },
  }), 'http://example.com/page3');
  const c86 = result3.criteria.find((c) => c.rgaaId === '8.6');
  console.log(`  Critère 8.6 status: ${c86?.status}`);
  console.log(c86?.status === 'manual'
    ? '✅ MANUAL_ONLY → toujours manual'
    : '❌ MANUAL_ONLY devrait être manual');

  // 5. aggregateResults
  console.log('\n--- aggregateResults sur 3 pages ---');
  const summary = aggregateResults([result1, result2, result3]);
  console.log(`  totalCriteria: ${summary.totalCriteria}`);
  console.log(`  violations: ${summary.violations}, passes: ${summary.passes}, manual: ${summary.manual}`);
  const aggC11 = summary.criteria.find((c) => c.rgaaId === '1.1');
  console.log(aggC11?.status === 'violation'
    ? '✅ Critère 1.1 agrégé = violation (1 page viole)'
    : '❌ Agrégation incorrecte');

  // 6. buildReport
  console.log('\n--- buildReport ---');
  const report = buildReport(summary, {
    url: 'http://example.com',
    date: '2026-03-01',
    pagesAudited: 3,
    version: '0.1.0',
  });
  console.log(`  limitBanner: "${report.limitBanner.slice(0, 60)}..."`);
  console.log(`  uncoveredThemes: ${report.uncoveredThemes.length}`);
  console.log(`  coveredThemes: ${report.metadata.coveredThemes.join(', ')}`);
  console.log(report.limitBanner.includes('7') && report.limitBanner.includes('106')
    ? '✅ limitBanner depuis locales/fr.json'
    : '❌ limitBanner incorrect');
  console.log(report.uncoveredThemes.length === 9
    ? '✅ 9 thématiques non couvertes'
    : '❌ Nombre de thématiques incorrect');

  // 7. Vérifier RÈGLE 1 — pas de hardcoding dans mapper.ts
  console.log('\n--- Vérification RÈGLE 1 (pas de hardcoding) ---');
  const mapperSrc = fs.readFileSync(
    path.resolve(__dirname, '../packages/core/mapping/mapper.ts'),
    'utf-8',
  );
  const hardcoded = ['"image-alt"', '"link-name"', '"1.1"', '"6.1"', '"heading-order"'].filter(
    (term) => mapperSrc.includes(term),
  );
  console.log(hardcoded.length === 0
    ? '✅ Aucun identifiant de règle/critère hardcodé dans mapper.ts'
    : `❌ Hardcoding trouvé: ${hardcoded.join(', ')}`);

  // 8. Vérifier que notes viennent du JSON
  console.log('\n--- Vérification notes/limits depuis le JSON ---');
  const criterionWithNotes = result1.criteria.find((c) => c.notes && c.notes.length > 0);
  console.log(criterionWithNotes
    ? `✅ Notes présentes (ex: "${criterionWithNotes.notes.slice(0, 50)}...")`
    : '❌ Aucune note trouvée');
}

main();
