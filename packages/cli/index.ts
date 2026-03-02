#!/usr/bin/env npx tsx
import { type Server } from 'node:net';
import minimist from 'minimist';
import { startServer } from '@rgaaudit/server';
import { findAvailablePort, printHelp } from './lib';

const args = minimist(process.argv.slice(2), {
  alias: { p: 'port', h: 'help' },
  default: { port: 3000, 'max-pages': 50 },
  boolean: ['help', 'no-open'],
});

if (args.help) {
  printHelp();
  process.exit(0);
}

const requestedPort = Number(args.port);
const maxPages = Number(args['max-pages']);
const noOpen = Boolean(args['no-open']);

if (Number.isNaN(requestedPort) || requestedPort < 1 || requestedPort > 65535) {
  console.error(`Port invalide : ${args.port}`);
  process.exit(1);
}

if (Number.isNaN(maxPages) || maxPages < 1) {
  console.error(`Nombre de pages invalide : ${args['max-pages']}`);
  process.exit(1);
}

async function main(): Promise<void> {
  const port = await findAvailablePort(requestedPort);

  if (port !== requestedPort) {
    console.log(`Port ${requestedPort} occupé, utilisation du port ${port}`);
  }

  process.env.RGAAUDIT_MAX_PAGES = String(maxPages);

  const server = startServer(port);
  const url = `http://localhost:${port}`;

  console.log(`\nRGAAudit démarré → ${url}\n`);

  if (!noOpen) {
    try {
      const openModule = await import('open');
      await openModule.default(url);
    } catch {
      console.log(`Ouvrez votre navigateur sur ${url}`);
    }
  }

  const shutdown = (): void => {
    console.log('\nArrêt de RGAAudit…');
    (server as Server).close(() => {
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 3000);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Erreur fatale :', (err as Error).message);
  process.exit(1);
});
