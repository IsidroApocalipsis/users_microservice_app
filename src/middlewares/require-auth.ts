import type { NextFunction, Request, Response } from 'express';
import type { SessionDocument } from '../auth/session.model.js';
import { findSessionById } from '../auth/session.repository.js';
import { verifyAccessToken, type AccessTokenPayload } from '../auth/token.js';
import type { UserRole } from '../users/user.model.js';
import { HttpError } from './http-error.js';

export type AuthenticatedRequest = Request & {
  auth?: AccessTokenPayload;
};

export type SessionLookup = {
  findById(id: string): Promise<SessionDocument | null>;
};

function sessionIsActive(session: SessionDocument, subject: string, now: Date): boolean {
  return (
    session.revokedAt === null &&
    session.expiresAt.getTime() > now.getTime() &&
    session.userId.toHexString() === subject
  );
}

export function createRequireAuth(sessions: SessionLookup) {
  return (req: Request, _res: Response, next: NextFunction): void => {
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

    void authenticate(sessions, token)
      .then((payload) => {
        (req as AuthenticatedRequest).auth = payload;
        next();
      })
      .catch((error: unknown) => {
        next(error);
      });
  };
}

async function authenticate(
  sessions: SessionLookup,
  token: string,
): Promise<AccessTokenPayload> {
  const payload = verifyAccessToken(token);
  const session = await sessions.findById(payload.sid);

  if (!session || !sessionIsActive(session, payload.sub, new Date())) {
    throw new HttpError(401, 'Unauthorized');
  }

  return payload;
}

export const requireAuth = createRequireAuth({ findById: findSessionById });

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
