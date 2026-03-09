import type { Request, Response, NextFunction } from 'express';

export class HttpError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  const statusCode = err instanceof HttpError ? err.statusCode : 500;
  const message = err.message || 'Erreur interne du serveur.';

  res.status(statusCode).json({ error: message });
}
