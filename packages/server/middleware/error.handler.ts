import type { Request, Response, NextFunction, RequestHandler } from 'express';

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

/**
 * Wraps an async route handler so rejected promises are forwarded to next().
 * Needed because Express 4 does not catch async rejections.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
