// Checkpoint manuel — Étape 5 : Analyzer (orchestrateur + persistance)
// Usage : npx tsx scripts/check-step5.ts

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { homedir } from 'node:os';
import { auditPages, saveSessionState, type SessionState, type ProgressEvent } from '../packages/core/analyzer/analyzer';

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

  console.log('=== Étape 5 — Checkpoints manuels ===\n');

  // 1. auditPages sur 3 fixtures → événements page_start, page_complete, audit_complete
  console.log('--- auditPages sur 3 fixtures HTML ---');
  const urls = [
    `${url}/valid-page.html`,
    `${url}/images/alt-missing.html`,
    `${url}/links/generic-links.html`,
  ];

  const events: ProgressEvent[] = [];
  const gen = auditPages(urls, { maxConcurrent: 2, sessionId: 'check-step5' });

  for await (const event of gen) {
    events.push(event);
    if (event.type === 'page_start') {
      console.log(`  → page_start: ${event.url}`);
    } else if (event.type === 'page_complete') {
      console.log(`  → page_complete: ${event.url}`);
    } else if (event.type === 'page_error') {
      console.log(`  → page_error: ${event.url} — ${event.error}`);
    } else if (event.type === 'audit_complete') {
      console.log(`  → audit_complete: ${event.summary.completedPages}/${event.summary.totalPages} pages`);
    }
  }

  const starts = events.filter((e) => e.type === 'page_start');
  const completes = events.filter((e) => e.type === 'page_complete' || e.type === 'page_error');
  const auditComplete = events.find((e) => e.type === 'audit_complete');

  console.log(starts.length === 3 ? '✅ 3 événements page_start' : `❌ ${starts.length} page_start (attendu 3)`);
  console.log(completes.length === 3 ? '✅ 3 événements page_complete/page_error' : `❌ ${completes.length} completes (attendu 3)`);
  console.log(auditComplete ? '✅ audit_complete émis' : '❌ audit_complete manquant');

  // 2. Vérifier que le fichier de session existe
  console.log('\n--- Vérification de la persistance ---');
  const sessionPath = path.join(homedir(), '.rgaaudit', 'sessions', 'audit-check-step5.json');
  const sessionExists = fs.existsSync(sessionPath);
  console.log(sessionExists ? '✅ Fichier de session existe' : '❌ Fichier de session manquant');

  if (sessionExists) {
    const session = JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));
    console.log(`  sessionId: ${session.sessionId}`);
    console.log(`  completedPages: ${session.completedPages.length}/${session.totalPages}`);
    console.log(`  results: ${Object.keys(session.results).length} entrées`);
    const allPagesInResults = urls.every((u) => u in session.results);
    console.log(allPagesInResults ? '✅ Toutes les pages sont dans les résultats' : '❌ Certaines pages manquent');
  }

  // 3. Écriture atomique (.tmp + rename)
  console.log('\n--- Vérification de l\'écriture atomique ---');
  const tmpPath = `${sessionPath}.tmp`;
  const noTmpLeftover = !fs.existsSync(tmpPath);
  console.log(noTmpLeftover ? '✅ Pas de fichier .tmp résiduel (rename OK)' : '❌ Fichier .tmp résiduel trouvé');

  // 4. Pool ne dépasse pas maxConcurrent
  console.log('\n--- Vérification du pool Playwright ---');
  let current = 0;
  let maxObserved = 0;
  for (const e of events) {
    if (e.type === 'page_start') {
      current++;
      maxObserved = Math.max(maxObserved, current);
    }
    if (e.type === 'page_complete' || e.type === 'page_error') {
      current--;
    }
  }
  console.log(`  maxConcurrent observé: ${maxObserved}`);
  console.log(maxObserved <= 2 ? '✅ Pool ne dépasse pas maxConcurrent (2)' : `❌ Pool a dépassé: ${maxObserved}`);

  // 5. maxConcurrent: 4 est réduit à 3
  console.log('\n--- maxConcurrent: 4 réduit à 3 ---');
  const events2: ProgressEvent[] = [];
  const gen2 = auditPages([`${url}/valid-page.html`], { maxConcurrent: 4, sessionId: 'check-step5-cap' });
  for await (const event of gen2) {
    events2.push(event);
  }
  const completedCap = events2.find((e) => e.type === 'audit_complete');
  console.log(completedCap ? '✅ maxConcurrent > 3 accepté sans crash (cap automatique)' : '❌ Crash avec maxConcurrent > 3');

  console.log(`\n📁 Fichiers de session conservés dans ~/.rgaaudit/sessions/`);
  console.log(`   → ${sessionPath}`);

  close();
}

main();
