// Checkpoint manuel — Étape 7 : Serveur Express + SSE
// Usage : npx tsx scripts/check-step7.ts

import http from 'node:http';
import type { AddressInfo } from 'node:net';

// Import the app (will resolve mocked core modules at runtime)
// For this check script, we test the server in isolation by hitting
// endpoints that don't require real core functionality.

async function post(port: number, path: string, body: unknown): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(
      {
        hostname: 'localhost',
        port,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode!, body: JSON.parse(raw) });
          } catch {
            resolve({ status: res.statusCode!, body: raw });
          }
        });
      },
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function get(port: number, path: string): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://localhost:${port}${path}`, (res) => {
      let raw = '';
      res.on('data', (chunk) => (raw += chunk));
      res.on('end', () => {
        resolve({ status: res.statusCode!, headers: res.headers, body: raw });
      });
    });
    req.on('error', reject);
  });
}

async function getSSEHeaders(port: number, path: string): Promise<http.IncomingHttpHeaders> {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://localhost:${port}${path}`, (res) => {
      resolve(res.headers);
      res.destroy();
    });
    req.on('error', reject);
  });
}

async function main() {
  console.log('=== Étape 7 — Checkpoints manuels ===\n');

  // Dynamic import to avoid top-level module resolution issues
  const { app } = await import('../packages/server/index');

  const server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  console.log(`Serveur de test démarré sur le port ${port}\n`);

  try {
    // 1. POST /api/crawl — 400 si URL invalide
    console.log('--- POST /api/crawl (URL invalide) ---');
    const crawlBad = await post(port, '/api/crawl', { url: 'not-a-url' });
    console.log(`  Status: ${crawlBad.status}`);
    console.log(`  Error: ${crawlBad.body.error}`);
    console.log(crawlBad.status === 400
      ? '✅ 400 sur URL invalide'
      : '❌ Devrait retourner 400');

    // 2. POST /api/crawl — 400 si url manquant
    console.log('\n--- POST /api/crawl (champ manquant) ---');
    const crawlMissing = await post(port, '/api/crawl', {});
    console.log(`  Status: ${crawlMissing.status}`);
    console.log(crawlMissing.status === 400
      ? '✅ 400 sur champ manquant'
      : '❌ Devrait retourner 400');

    // 3. POST /api/audit/start — 400 si urls vide
    console.log('\n--- POST /api/audit/start (urls vide) ---');
    const auditEmpty = await post(port, '/api/audit/start', { urls: [] });
    console.log(`  Status: ${auditEmpty.status}`);
    console.log(auditEmpty.status === 400
      ? '✅ 400 sur tableau vide'
      : '❌ Devrait retourner 400');

    // 4. POST /api/audit/start — 400 si plus de 50 URLs
    console.log('\n--- POST /api/audit/start (> 50 URLs) ---');
    const urls51 = Array.from({ length: 51 }, (_, i) => `https://example.com/p${i}`);
    const auditTooMany = await post(port, '/api/audit/start', { urls: urls51 });
    console.log(`  Status: ${auditTooMany.status}`);
    console.log(auditTooMany.status === 400
      ? '✅ 400 sur > 50 URLs'
      : '❌ Devrait retourner 400');

    // 5. GET /api/audit/progress/:sessionId — headers SSE
    console.log('\n--- GET /api/audit/progress/:sessionId (SSE headers) ---');
    const sseHeaders = await getSSEHeaders(port, '/api/audit/progress/test-check');
    console.log(`  Content-Type: ${sseHeaders['content-type']}`);
    console.log(`  Cache-Control: ${sseHeaders['cache-control']}`);
    const sseOk = sseHeaders['content-type']?.includes('text/event-stream')
      && sseHeaders['cache-control']?.includes('no-cache');
    console.log(sseOk
      ? '✅ Headers SSE corrects'
      : '❌ Headers SSE incorrects');

    // 6. GET /api/report/:sessionId — 404 si session inexistante
    console.log('\n--- GET /api/report/:sessionId (session inexistante) ---');
    const reportNotFound = await get(port, '/api/report/inexistant');
    console.log(`  Status: ${reportNotFound.status}`);
    console.log(reportNotFound.status === 404
      ? '✅ 404 sur session inexistante'
      : '❌ Devrait retourner 404');

    // 7. Vérifier que CORS est activé
    console.log('\n--- CORS activé ---');
    const corsCheck = await get(port, '/api/report/test');
    const corsHeader = corsCheck.headers['access-control-allow-origin'];
    console.log(`  Access-Control-Allow-Origin: ${corsHeader}`);
    console.log(corsHeader === '*'
      ? '✅ CORS activé'
      : '❌ CORS non activé');

    console.log('\n=== Tous les checkpoints terminés ===');
  } finally {
    server.close();
  }
}

main().catch((err) => {
  console.error('❌ Erreur fatale:', err);
  process.exit(1);
});
