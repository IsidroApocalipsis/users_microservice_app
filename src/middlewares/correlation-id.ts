import type { NextFunction, Request, Response } from 'express';
import {
  resolveCorrelationId,
  runWithCorrelationId,
} from '../logging/request-context.js';

export function correlationId(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const id = resolveCorrelationId(req.header('x-request-id'));
  res.setHeader('x-request-id', id);
  runWithCorrelationId(id, () => next());
}
