import type { RequestHandler } from 'express';
import { ZodError, type ZodSchema } from 'zod';
import { HttpError } from './error.handler';

/**
 * Express middleware that validates req.body against a Zod schema.
 * On success, replaces req.body with the parsed (coerced/stripped) value.
 * On failure, throws an HttpError 400 with a human-readable message.
 */
export function validateBody(schema: ZodSchema): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const message = formatZodError(result.error);
      throw new HttpError(400, message);
    }

    req.body = result.data;
    next();
  };
}

function formatZodError(error: ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
      return `${path}${issue.message}`;
    })
    .join('. ');
}
