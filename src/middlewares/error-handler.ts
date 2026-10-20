import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { log } from '../logging/logger.js';
import { HttpError } from './http-error.js';

function publicMessage(statusCode: number, message: string): void {
  log(statusCode >= 500 ? 'error' : 'warn', message, { statusCode });
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof HttpError) {
    publicMessage(err.statusCode, err.message);
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  if (err instanceof ZodError) {
    publicMessage(400, 'Validation failed');
    res.status(400).json({
      error: 'Validation failed',
      details: err.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
    return;
  }

  publicMessage(500, 'Internal server error');
  res.status(500).json({ error: 'Internal server error' });
}
