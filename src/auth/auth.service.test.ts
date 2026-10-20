import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { describe, it } from 'node:test';
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

describe('login', () => {
  it('returns 401 when the email does not exist', async () => {
    const service = createAuthService({
      findByEmailHash: async () => null,
    });

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
    const service = createAuthService({
      findByEmailHash: async () => user({ passwordHash }),
    });

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
    const service = createAuthService({
      findByEmailHash: async () => user({ passwordHash, estatus: 'INACTIVO' }),
    });

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

  it('returns an access token when the credentials are valid', async () => {
    const passwordHash = await hashPassword(password);
    const existing = user({ passwordHash, rol: 'ADMIN' });
    const service = createAuthService({
      findByEmailHash: async () => existing,
    });

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
  });
});
