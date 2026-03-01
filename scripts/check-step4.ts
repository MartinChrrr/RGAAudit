// Checkpoint manuel — Étape 4 : Data collector (images, liens, titres)
// Usage : npx tsx scripts/check-step4.ts

import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { collectImages, collectLinks, collectHeadings } from '../packages/core/analyzer/data-collector';

const FIXTURES_DIR = path.resolve(__dirname, '../e2e/fixtures/test-sites');

async function serve(): Promise<{ url: string; close: () => void }> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const filePath = path.join(FIXTURES_DIR, req.url ?? '/');
      if (!fs.existsSync(filePath)) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(fs.readFileSync(filePath, 'utf-8'));
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') {
        resolve({ url: `http://127.0.0.1:${addr.port}`, close: () => server.close() });
      }
    });
  });
}

async function main() {
  const { url, close } = await serve();
  const browser = await chromium.launch();
  const context = await browser.newContext();

  console.log('=== Étape 4 — Checkpoints manuels ===\n');

  // 1. collectImages sur alt-missing.html → ALT_ABSENT
  console.log('--- collectImages sur alt-missing.html ---');
  const p1 = await context.newPage();
  await p1.goto(`${url}/images/alt-missing.html`);
  const images = await collectImages(p1);
  const altAbsent = images.filter((i) => i.flags.includes('ALT_ABSENT'));
  console.log(`  ${images.length} images trouvées, ${altAbsent.length} avec ALT_ABSENT`);
  console.log(altAbsent.length >= 2 ? '✅ ALT_ABSENT détecté' : '❌ ALT_ABSENT non détecté');
  await p1.close();

  // 2. collectLinks sur generic-links.html → GENERIC_LABEL
  console.log('\n--- collectLinks sur generic-links.html ---');
  const p2 = await context.newPage();
  await p2.goto(`${url}/links/generic-links.html`);
  const links = await collectLinks(p2);
  const generic = links.filter((l) => l.flags.includes('GENERIC_LABEL'));
  console.log(`  ${links.length} liens trouvés, ${generic.length} avec GENERIC_LABEL`);
  for (const l of generic.slice(0, 3)) {
    console.log(`    "${l.accessibleLabel}" → GENERIC_LABEL ✅`);
  }
  console.log(generic.length >= 3 ? '✅ GENERIC_LABEL lu depuis rgaa-4.1.json' : '❌ GENERIC_LABEL non détecté');
  await p2.close();

  // 3. collectHeadings sur level-skip.html → LEVEL_SKIP
  console.log('\n--- collectHeadings sur level-skip.html ---');
  const p3 = await context.newPage();
  await p3.goto(`${url}/headings/level-skip.html`);
  const headings = await collectHeadings(p3);
  console.log(`  ${headings.headings.length} headings, flags page: [${headings.flags.join(', ')}]`);
  const h4 = headings.headings.find((h) => h.level === 4);
  if (h4) {
    const skip = h4.flags.find((f) => typeof f === 'object' && f.flag === 'LEVEL_SKIP');
    if (skip && typeof skip === 'object') {
      console.log(`  h4 → LEVEL_SKIP skipFrom:${skip.skipFrom} skipTo:${skip.skipTo}`);
      console.log('✅ LEVEL_SKIP avec skipFrom:2, skipTo:4');
    } else {
      console.log('❌ LEVEL_SKIP non trouvé sur h4');
    }
  }
  await p3.close();

  // 4. collectHeadings sur no-h1.html → NO_H1
  console.log('\n--- collectHeadings sur no-h1.html ---');
  const p4 = await context.newPage();
  await p4.goto(`${url}/headings/no-h1.html`);
  const noH1 = await collectHeadings(p4);
  console.log(noH1.flags.includes('NO_H1') ? '✅ NO_H1 détecté' : '❌ NO_H1 non détecté');
  await p4.close();

  // 5. Vérifier que les patterns ne sont pas hardcodés
  console.log('\n--- Vérification RÈGLE 1 (pas de hardcoding) ---');
  const collectorSrc = fs.readFileSync(
    path.resolve(__dirname, '../packages/core/analyzer/data-collector.ts'),
    'utf-8'
  );
  const hardcoded = ['lire la suite', 'en savoir plus', 'cliquez ici', '"photo"', '"accueil"'].filter(
    (term) => collectorSrc.includes(term)
  );
  console.log(
    hardcoded.length === 0
      ? '✅ Aucun pattern hardcodé dans data-collector.ts'
      : `❌ Patterns hardcodés trouvés: ${hardcoded.join(', ')}`
  );

  await context.close();
  await browser.close();
  close();
}

main();
