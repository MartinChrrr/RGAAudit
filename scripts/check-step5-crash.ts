// Checkpoint manuel — Simuler un crash pendant l'audit
// Usage : npx tsx scripts/check-step5-crash.ts
// Pendant que ça tourne, appuie sur Ctrl+C après 2-3 "page_complete"
// Puis vérifie que le JSON contient les pages déjà auditées :
//   cat ~/.rgaaudit/sessions/audit-crash-test.json | head -20

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { homedir } from 'node:os';
import { auditPages, type ProgressEvent } from '../packages/core/analyzer/analyzer';

const FIXTURES_DIR = path.resolve(__dirname, '../e2e/fixtures/test-sites');

async function serve(): Promise<{ url: string; close: () => void }> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      // Ajoute un délai de 2s par page pour laisser le temps de Ctrl+C
      setTimeout(() => {
        const filePath = path.join(FIXTURES_DIR, req.url ?? '/');
        if (!fs.existsSync(filePath)) { res.writeHead(404); res.end(); return; }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(fs.readFileSync(filePath, 'utf-8'));
      }, 2000);
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
  const sessionPath = path.join(homedir(), '.rgaaudit', 'sessions', 'audit-crash-test.json');

  // Supprime l'ancien fichier si présent
  if (fs.existsSync(sessionPath)) fs.unlinkSync(sessionPath);

  console.log('=== Simulation de crash ===');
  console.log('Appuie sur Ctrl+C après 2-3 pages complétées.\n');

  // 8 pages avec maxConcurrent: 1 pour que ce soit séquentiel et prévisible
  const urls = [
    `${url}/valid-page.html`,
    `${url}/images/alt-missing.html`,
    `${url}/images/alt-generic.html`,
    `${url}/images/alt-decorative.html`,
    `${url}/links/generic-links.html`,
    `${url}/links/empty-links.html`,
    `${url}/headings/level-skip.html`,
    `${url}/headings/no-h1.html`,
  ];

  console.log(`${urls.length} pages à auditer (maxConcurrent: 1, ~4s/page)\n`);

  const gen = auditPages(urls, { maxConcurrent: 1, sessionId: 'crash-test' });

  let completed = 0;
  for await (const event of gen) {
    if (event.type === 'page_start') {
      console.log(`  ⏳ page_start: ${event.url.split('/').pop()}`);
    } else if (event.type === 'page_complete') {
      completed++;
      console.log(`  ✅ page_complete (${completed}/${urls.length}): ${event.url.split('/').pop()}`);
    } else if (event.type === 'audit_complete') {
      console.log(`\n  Audit terminé normalement (${completed}/${urls.length}).`);
    }
  }

  console.log(`\nVérifie le fichier :`);
  console.log(`  cat ~/.rgaaudit/sessions/audit-crash-test.json | python3 -m json.tool | head -10`);

  close();
}

main();
