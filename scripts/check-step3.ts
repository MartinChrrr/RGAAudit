// Checkpoint manuel — Étape 3 : Sitemap parser + URL normalizer
// Usage : npx tsx scripts/check-step3.ts

import { parseSitemap } from '../packages/core/crawler/sitemap.parser';
import { normalizeUrl } from '../packages/core/crawler/url.normalizer';

async function main() {
  console.log('=== Étape 3 — Checkpoints manuels ===\n');

  // 1. parseSitemap sur un vrai site
  console.log('--- parseSitemap sur un site avec sitemap ---');
  const r1 = await parseSitemap('https://www.ecologie.gouv.fr');
  console.log(`${r1.count} URLs trouvées, source: ${r1.source}`);
  if (r1.count > 0) {
    console.log('✅ Sitemap trouvé');
    r1.urls.slice(0, 3).forEach((u) => console.log(`  ${u}`));
  } else {
    console.log('⚠️  Aucune URL (le site a peut-être changé — essayez un autre site)');
  }

  // 2. parseSitemap sur un site sans sitemap
  console.log('\n--- parseSitemap sur site sans sitemap ---');
  const r2 = await parseSitemap('https://accessibilite.numerique.gouv.fr');
  console.log(
    r2.source === 'not_found' && r2.count === 0
      ? '✅ { urls: [], source: "not_found" } — pas de crash'
      : `❌ résultat inattendu: ${JSON.stringify(r2)}`
  );

  // 3. normalizeUrl
  console.log('\n--- normalizeUrl ---');
  const input = 'https://example.com/page/?utm_source=google#section';
  const output = normalizeUrl(input);
  const expected = 'https://example.com/page/';
  console.log(`  Input:    ${input}`);
  console.log(`  Output:   ${output}`);
  console.log(`  Attendu:  ${expected}`);
  console.log(output === expected ? '✅ Normalisation correcte' : '❌ Résultat différent');
}

main();
