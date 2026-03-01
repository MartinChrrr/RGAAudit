// Checkpoint manuel — Étape 2 : Moteur d'audit (adapter axe-core)
// Usage : npx tsx scripts/check-step2.ts

import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { AxeCoreAdapter } from '../packages/core/engines/axe-core.adapter';

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
  const adapter = new AxeCoreAdapter();

  console.log('=== Étape 2 — Checkpoints manuels ===\n');

  // 1. image-alt sur alt-missing.html
  const page1 = await context.newPage();
  await page1.goto(`${url}/images/alt-missing.html`);
  const r1 = await adapter.analyze(page1);
  if (!r1.error && r1.violations) {
    const imageAlt = r1.violations.find((v) => v.rule === 'image-alt');
    console.log(imageAlt ? '✅ violation "image-alt" détectée sur alt-missing.html' : '❌ image-alt non détecté');
  } else {
    console.log('❌ erreur:', r1.error);
  }
  await page1.close();

  // 2. 0 violation sur page valide
  const page2 = await context.newPage();
  await page2.goto(`${url}/valid-page.html`);
  const r2 = await adapter.analyze(page2);
  if (!r2.error && r2.violations) {
    console.log(r2.violations.length === 0 ? '✅ 0 violation sur page valide' : `❌ ${r2.violations.length} violations sur page valide`);
  }
  await page2.close();

  // 3. { error } sur timeout
  const slow = new AxeCoreAdapter({ timeout: 1 });
  const page3 = await context.newPage();
  await page3.goto(`${url}/images/alt-missing.html`);
  const r3 = await slow.analyze(page3);
  console.log(r3.error ? '✅ { error } retourné sur timeout — pas de throw' : '❌ pas d\'erreur sur timeout');
  await page3.close();

  await context.close();
  await browser.close();
  close();
}

main();
