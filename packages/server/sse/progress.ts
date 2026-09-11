import type { Response } from 'express';

export class SSEManager {
  private clients = new Map<string, Set<Response>>();

  addClient(id: string, res: Response): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();

    const sessionClients = this.clients.get(id) ?? new Set<Response>();
    sessionClients.add(res);
    this.clients.set(id, sessionClients);

    res.on('close', () => {
      this.removeClient(id, res);
    });
  }

  removeClient(id: string, res?: Response): void {
    if (!res) {
      this.clients.delete(id);
      return;
    }

    const sessionClients = this.clients.get(id);
    sessionClients?.delete(res);
    if (sessionClients?.size === 0) this.clients.delete(id);
  }

  broadcast(eventType: string, data: unknown): void {
    const payload = formatSSE(eventType, data);
    for (const sessionClients of this.clients.values()) {
      for (const client of sessionClients) client.write(payload);
    }
  }

  send(id: string, eventType: string, data: unknown): void {
    const sessionClients = this.clients.get(id);
    if (!sessionClients) return;
    const payload = formatSSE(eventType, data);
    for (const client of sessionClients) client.write(payload);
  }

  hasClient(id: string): boolean {
    return this.clients.has(id);
  }

  get size(): number {
    return [...this.clients.values()].reduce((total, clients) => total + clients.size, 0);
  }
}

function formatSSE(eventType: string, data: unknown): string {
  return `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
}

export const sseManager = new SSEManager();
