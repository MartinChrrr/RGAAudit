import type { Response } from 'express';

interface SSEClient {
  id: string;
  res: Response;
}

export class SSEManager {
  private clients = new Map<string, SSEClient>();

  addClient(id: string, res: Response): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();

    this.clients.set(id, { id, res });

    res.on('close', () => {
      this.removeClient(id);
    });
  }

  removeClient(id: string): void {
    this.clients.delete(id);
  }

  broadcast(eventType: string, data: unknown): void {
    const payload = formatSSE(eventType, data);
    for (const client of this.clients.values()) {
      client.res.write(payload);
    }
  }

  send(id: string, eventType: string, data: unknown): void {
    const client = this.clients.get(id);
    if (!client) return;
    client.res.write(formatSSE(eventType, data));
  }

  hasClient(id: string): boolean {
    return this.clients.has(id);
  }

  get size(): number {
    return this.clients.size;
  }
}

function formatSSE(eventType: string, data: unknown): string {
  return `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
}

export const sseManager = new SSEManager();
