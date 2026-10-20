import type { NextFunction, Request, Response } from 'express';
import { verifyAccessToken, type AccessTokenPayload } from '../auth/token.js';
import type { UserRole } from '../users/user.model.js';
import { HttpError } from './http-error.js';

export type AuthenticatedRequest = Request & {
  auth?: AccessTokenPayload;
};

export function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const header = req.header('authorization');

  if (!header?.startsWith('Bearer ')) {
    next(new HttpError(401, 'Unauthorized'));
    return;
  }

  const token = header.slice('Bearer '.length).trim();

  if (!token) {
    next(new HttpError(401, 'Unauthorized'));
    return;
  }

  try {
    (req as AuthenticatedRequest).auth = verifyAccessToken(token);
    next();
  } catch (error) {
    next(error);
  }
}

export function requireRole(role: UserRole) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const auth = (req as AuthenticatedRequest).auth;

    if (!auth) {
      next(new HttpError(401, 'Unauthorized'));
      return;
    }

    if (auth.rol !== role) {
      next(new HttpError(403, 'Forbidden'));
      return;
    }

    next();
  };
}
