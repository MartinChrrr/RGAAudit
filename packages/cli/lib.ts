import { createServer } from 'node:net';

export async function findAvailablePort(startPort: number, maxAttempts = 10): Promise<number> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const port = startPort + attempt;
    const available = await isPortAvailable(port);
    if (available) return port;
  }
  throw new Error(`Aucun port disponible entre ${startPort} et ${startPort + maxAttempts - 1}`);
}

export function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, '127.0.0.1');
  });
}

export function printHelp(): void {
  console.log(`
RGAAudit — Audit d'accessibilité RGAA 4.1

Usage : npx rgaaudit [options]

Options :
  -p, --port <port>     Port du serveur (défaut : 3000)
  --max-pages <n>       Nombre max de pages par audit (défaut : 50)
  --no-open             Ne pas ouvrir le navigateur automatiquement
  -h, --help            Afficher cette aide
`);
}
