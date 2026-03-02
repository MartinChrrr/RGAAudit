import { describe, it, expect } from 'vitest';
import { createServer } from 'node:net';
import { findAvailablePort, isPortAvailable } from '../lib';

describe('isPortAvailable', () => {
  it('retourne true pour un port libre', async () => {
    const result = await isPortAvailable(0);
    expect(result).toBe(true);
  });

  it('retourne false pour un port occupé', async () => {
    const server = createServer();
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });

    const port = (server.address() as { port: number }).port;

    const result = await isPortAvailable(port);
    expect(result).toBe(false);

    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
});

describe('findAvailablePort', () => {
  it('retourne le port demandé s\'il est libre', async () => {
    const server = createServer();
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
    const freePort = (server.address() as { port: number }).port;
    await new Promise<void>((resolve) => server.close(() => resolve()));

    const result = await findAvailablePort(freePort);
    expect(result).toBe(freePort);
  });

  it('trouve le prochain port libre si le premier est occupé', async () => {
    const server = createServer();
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
    const occupiedPort = (server.address() as { port: number }).port;

    const result = await findAvailablePort(occupiedPort);
    expect(result).toBeGreaterThan(occupiedPort);
    expect(result).toBeLessThanOrEqual(occupiedPort + 10);

    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('throw si aucun port disponible dans la plage', async () => {
    const servers: ReturnType<typeof createServer>[] = [];
    const basePort = 19700;

    for (let i = 0; i < 3; i++) {
      const srv = createServer();
      await new Promise<void>((resolve) => {
        srv.listen(basePort + i, '127.0.0.1', () => resolve());
      });
      servers.push(srv);
    }

    await expect(findAvailablePort(basePort, 3)).rejects.toThrow('Aucun port disponible');

    for (const srv of servers) {
      await new Promise<void>((resolve) => srv.close(() => resolve()));
    }
  });
});
