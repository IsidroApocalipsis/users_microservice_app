import { env, refreshTokenTtlMs } from '../config/env.js';
import { comparePassword, hashEmail } from '../crypto/encryption.js';
import { HttpError } from '../middlewares/http-error.js';
import type { UserDocument } from '../users/user.model.js';
import type { LoginUserInput, RefreshTokenInput } from '../users/user.schema.js';
import { createRefreshToken, hashRefreshToken } from './refresh-token.js';
import type { SessionDocument } from './session.model.js';
import type { NewSession } from './session.repository.js';
import { signAccessToken } from './token.js';

const DUMMY_PASSWORD_HASH =
  '$2b$12$MlXEy.RlMpQKAz7n2/otxexmbHRXR5UrY2obQPOpju3Hu5JF4lV9S';

export type UserLookup = {
  findByEmailHash(emailHash: string): Promise<UserDocument | null>;
  findById(id: string): Promise<UserDocument | null>;
};

export type SessionStore = {
  createSession(input: NewSession): Promise<SessionDocument>;
  rotateRefreshToken(
    currentHash: string,
    nextHash: string,
    now: Date,
  ): Promise<SessionDocument | null>;
  revokeByRefreshTokenHash(refreshTokenHash: string, now: Date): Promise<void>;
  revokeSessionById(id: string, now: Date): Promise<void>;
};

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
};

function tokenPair(user: UserDocument, session: SessionDocument, refreshToken: string): TokenPair {
  return {
    accessToken: signAccessToken(user, session._id),
    refreshToken,
    expiresIn: env.jwtExpiresIn,
  };
}

export function createAuthService(users: UserLookup, sessions: SessionStore) {
  return {
    async login(input: LoginUserInput): Promise<TokenPair> {
      const user = await users.findByEmailHash(hashEmail(input.email));
      const passwordMatches = await comparePassword(
        input.password,
        user?.passwordHash ?? DUMMY_PASSWORD_HASH,
      );

      if (!user || !passwordMatches) {
        throw new HttpError(401, 'Invalid credentials');
      }

      if (user.estatus !== 'ACTIVO') {
        throw new HttpError(403, 'User is inactive');
      }

      const refreshToken = createRefreshToken();
      const session = await sessions.createSession({
        userId: user._id,
        refreshTokenHash: hashRefreshToken(refreshToken),
        expiresAt: new Date(Date.now() + refreshTokenTtlMs(env.jwtRefreshExpiresIn)),
      });

      return tokenPair(user, session, refreshToken);
    },

    async refresh(input: RefreshTokenInput): Promise<TokenPair> {
      const now = new Date();
      const refreshToken = createRefreshToken();
      const session = await sessions.rotateRefreshToken(
        hashRefreshToken(input.refreshToken),
        hashRefreshToken(refreshToken),
        now,
      );

      if (!session) {
        throw new HttpError(401, 'Unauthorized');
      }

      const user = await users.findById(session.userId.toHexString());

      if (!user || user.estatus !== 'ACTIVO') {
        await sessions.revokeSessionById(session._id.toHexString(), now);
        throw new HttpError(401, 'Unauthorized');
      }

      return tokenPair(user, session, refreshToken);
    },

    async logout(input: RefreshTokenInput): Promise<void> {
      await sessions.revokeByRefreshTokenHash(
        hashRefreshToken(input.refreshToken),
        new Date(),
      );
    },
  };
}
