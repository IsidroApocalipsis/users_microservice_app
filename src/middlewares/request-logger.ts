import type { NextFunction, Request, Response } from 'express';
import { log } from '../logging/logger.js';
import { currentCorrelationId } from '../logging/request-context.js';

export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const started = process.hrtime.bigint();
  const correlationId = currentCorrelationId();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - started) / 1_000_000;

    log('info', 'request completed', {
      correlationId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: Math.round(durationMs),
    });
  });

  next();
}
