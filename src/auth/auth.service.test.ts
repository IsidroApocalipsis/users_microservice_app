import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { describe, it } from 'node:test';
import type { Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { HttpError } from '../middlewares/http-error.js';
import type { UserDocument } from '../users/user.model.js';

process.env.DATA_ENCRYPTION_KEY ??= randomBytes(32).toString('base64');
process.env.MONGODB_URI ??=
  'mongodb://127.0.0.1:27017/users?retryWrites=false';
process.env.JWT_SECRET ??= randomBytes(32).toString('hex');
process.env.JWT_EXPIRES_IN ??= '1h';

const { createAuthService } = await import('./auth.service.js');
const { hashPassword } = await import('../crypto/encryption.js');
const { signAccessToken, verifyAccessToken } = await import('./token.js');
const { createRequireAuth } = await import('../middlewares/require-auth.js');
const { ObjectId: SessionObjectId } = await import('mongodb');

const password = 'secret123';

function user(overrides: Partial<UserDocument> = {}): UserDocument {
  return {
    _id: new ObjectId(),
    nombre: 'Ana',
    email: { iv: 'aQ==', tag: 'dGFn', ciphertext: 'Y2lwaGVy' },
    emailHash: 'hash',
    telefono: null,
    curp: null,
    passwordHash: '',
    rol: 'USER',
    estatus: 'ACTIVO',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

type StoredSession = {
  _id: ObjectId;
  userId: ObjectId;
  refreshTokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function sessionStore() {
  const docs: StoredSession[] = [];

  return {
    docs,
    async createSession(input: {
      userId: ObjectId;
      refreshTokenHash: string;
      expiresAt: Date;
    }) {
      const doc: StoredSession = {
        _id: new ObjectId(),
        revokedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...input,
      };
      docs.push(doc);
      return doc;
    },
    async rotateRefreshToken(currentHash: string, nextHash: string, now: Date) {
      const doc = docs.find(
        (item) =>
          item.refreshTokenHash === currentHash &&
          item.revokedAt === null &&
          item.expiresAt.getTime() > now.getTime(),
      );

      if (!doc) {
        return null;
      }

      doc.refreshTokenHash = nextHash;
      doc.updatedAt = now;
      return doc;
    },
    async revokeByRefreshTokenHash(refreshTokenHash: string, now: Date) {
      const doc = docs.find(
        (item) => item.refreshTokenHash === refreshTokenHash && item.revokedAt === null,
      );

      if (doc) {
        doc.revokedAt = now;
        doc.updatedAt = now;
      }
    },
    async revokeSessionById(id: string, now: Date) {
      const doc = docs.find((item) => item._id.toHexString() === id && item.revokedAt === null);

      if (doc) {
        doc.revokedAt = now;
        doc.updatedAt = now;
      }
    },
  };
}

function authServiceFor(existing: UserDocument | null, store = sessionStore()) {
  return createAuthService(
    {
      findByEmailHash: async () => existing,
      findById: async (id) =>
        existing && existing._id.toHexString() === id ? existing : null,
    },
    store,
  );
}

describe('login', () => {
  it('returns 401 when the email does not exist', async () => {
    const store = sessionStore();
    store.createSession = async () => {
      throw new Error('should not create a session');
    };
    const service = authServiceFor(null, store);

    await assert.rejects(
      () => service.login({ email: 'ana@example.com', password }),
      (error: unknown) => {
        assert.ok(error instanceof HttpError);
        assert.equal(error.statusCode, 401);
        assert.equal(error.message, 'Invalid credentials');
        return true;
      },
    );
  });

  it('returns 401 when the password does not match', async () => {
    const passwordHash = await hashPassword(password);
    const service = authServiceFor(user({ passwordHash }));

    await assert.rejects(
      () => service.login({ email: 'ana@example.com', password: 'wrong-pass' }),
      (error: unknown) => {
        assert.ok(error instanceof HttpError);
        assert.equal(error.statusCode, 401);
        assert.equal(error.message, 'Invalid credentials');
        return true;
      },
    );
  });

  it('returns 403 when the user is inactive', async () => {
    const passwordHash = await hashPassword(password);
    const store = sessionStore();
    store.createSession = async () => {
      throw new Error('should not create a session');
    };
    const service = authServiceFor(user({ passwordHash, estatus: 'INACTIVO' }), store);

    await assert.rejects(
      () => service.login({ email: 'ana@example.com', password }),
      (error: unknown) => {
        assert.ok(error instanceof HttpError);
        assert.equal(error.statusCode, 403);
        assert.equal(error.message, 'User is inactive');
        return true;
      },
    );
  });

  it('returns an access token and a refresh token when the credentials are valid', async () => {
    const passwordHash = await hashPassword(password);
    const existing = user({ passwordHash, rol: 'ADMIN' });
    const store = sessionStore();
    const service = authServiceFor(existing, store);

    const result = await service.login({
      email: 'ana@example.com',
      password,
    });
    const payload: JwtPayload = jwt.verify(
      result.accessToken,
      process.env.JWT_SECRET ?? '',
    ) as JwtPayload;

    assert.equal(payload.sub, existing._id.toHexString());
    assert.equal(payload.rol, 'ADMIN');
    assert.equal(payload.sid, store.docs[0]?._id.toHexString());
    assert.equal(typeof result.refreshToken, 'string');
    assert.equal(result.refreshToken.length > 20, true);
    assert.equal(result.expiresIn, '1h');
  });
});

describe('refresh and logout', () => {
  it('rotates the refresh token and rejects the previous one', async () => {
    const passwordHash = await hashPassword(password);
    const existing = user({ passwordHash, rol: 'USER' });
    const store = sessionStore();
    const service = authServiceFor(existing, store);
    const first = await service.login({ email: 'ana@example.com', password });
    const second = await service.refresh({ refreshToken: first.refreshToken });

    assert.notEqual(second.refreshToken, first.refreshToken);
    assert.equal(second.expiresIn, '1h');

    const payload: JwtPayload = jwt.verify(
      second.accessToken,
      process.env.JWT_SECRET ?? '',
    ) as JwtPayload;
    assert.equal(payload.rol, 'USER');
    assert.equal(payload.sid, store.docs[0]?._id.toHexString());

    await assert.rejects(
      () => service.refresh({ refreshToken: first.refreshToken }),
      (error: unknown) => {
        assert.ok(error instanceof HttpError);
        assert.equal(error.statusCode, 401);
        return true;
      },
    );
  });

  it('returns 401 for an unknown refresh token', async () => {
    const service = authServiceFor(null);

    await assert.rejects(
      () => service.refresh({ refreshToken: 'missing-token' }),
      (error: unknown) => {
        assert.ok(error instanceof HttpError);
        assert.equal(error.statusCode, 401);
        assert.equal(error.message, 'Unauthorized');
        return true;
      },
    );
  });

  it('logout revokes the session and a second logout still succeeds', async () => {
    const passwordHash = await hashPassword(password);
    const existing = user({ passwordHash });
    const store = sessionStore();
    const service = authServiceFor(existing, store);
    const issued = await service.login({ email: 'ana@example.com', password });

    await service.logout({ refreshToken: issued.refreshToken });
    await service.logout({ refreshToken: issued.refreshToken });

    assert.ok(store.docs[0]?.revokedAt instanceof Date);
    await assert.rejects(
      () => service.refresh({ refreshToken: issued.refreshToken }),
      (error: unknown) => {
        assert.ok(error instanceof HttpError);
        assert.equal(error.statusCode, 401);
        return true;
      },
    );
  });
});

describe('requireAuth session check', () => {
  it('rejects an access token without a session id', () => {
    const token = jwt.sign(
      { sub: new ObjectId().toHexString(), rol: 'USER' },
      process.env.JWT_SECRET ?? '',
      { expiresIn: '1h' },
    );

    assert.throws(
      () => verifyAccessToken(token),
      (error: unknown) => {
        assert.ok(error instanceof HttpError);
        assert.equal(error.statusCode, 401);
        return true;
      },
    );
  });

  it('rejects a revoked session', async () => {
    const existing = user();
    const sessionId = new SessionObjectId();
    const accessToken = signAccessToken(existing, sessionId);
    const requireAuth = createRequireAuth({
      findById: async () => ({
        _id: sessionId,
        userId: existing._id,
        refreshTokenHash: 'hash',
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    });

    const error = await new Promise<unknown>((resolve) => {
      requireAuth(
        { header: () => `Bearer ${accessToken}` } as unknown as Request,
        {} as Response,
        (nextError) => resolve(nextError),
      );
    });

    assert.ok(error instanceof HttpError);
    assert.equal(error.statusCode, 401);
  });
});
