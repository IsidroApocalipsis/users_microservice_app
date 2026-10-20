import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { describe, it } from 'node:test';
import { ObjectId } from 'mongodb';
import { HttpError } from '../middlewares/http-error.js';
import type { UserDocument } from './user.model.js';

process.env.DATA_ENCRYPTION_KEY ??= randomBytes(32).toString('base64');
process.env.MONGODB_URI ??=
  'mongodb://127.0.0.1:27017/users?retryWrites=false';
process.env.JWT_SECRET ??= randomBytes(32).toString('hex');

const { createUserService } = await import('./user.service.js');
const { DuplicateEmailError } = await import('./user.repository.js');
const { encryptField } = await import('../crypto/encryption.js');

const missingStoreMethods = {
  findById: async () => null,
};

const input = {
  nombre: 'Ana Perez',
  email: 'ana@example.com',
  password: 'secret123',
};

describe('create user', () => {
  it('returns the public user without the password', async () => {
    const service = createUserService({
      ...missingStoreMethods,
      findByEmailHash: async () => null,
      insertUser: async (document) => ({
        ...document,
        _id: new ObjectId(),
      }),
    });

    const created = await service.create(input);

    assert.equal(created.email, 'ana@example.com');
    assert.equal(created.nombre, 'Ana Perez');
    assert.equal(created.rol, 'USER');
    assert.equal(created.estatus, 'ACTIVO');
    assert.equal('password' in created, false);
    assert.equal('passwordHash' in created, false);
    assert.equal('emailHash' in created, false);
  });

  it('returns 409 when the email already exists', async () => {
    const service = createUserService({
      ...missingStoreMethods,
      findByEmailHash: async () => ({ _id: new ObjectId() }) as UserDocument,
      insertUser: async () => {
        throw new Error('should not insert');
      },
    });

    await assert.rejects(
      () => service.create(input),
      (error: unknown) => {
        assert.ok(error instanceof HttpError);
        assert.equal(error.statusCode, 409);
        assert.equal(error.message, 'Email already exists');
        return true;
      },
    );
  });

  it('returns 409 when the unique index rejects the insert', async () => {
    const service = createUserService({
      ...missingStoreMethods,
      findByEmailHash: async () => null,
      insertUser: async () => {
        throw new DuplicateEmailError();
      },
    });

    await assert.rejects(
      () => service.create(input),
      (error: unknown) => {
        assert.ok(error instanceof HttpError);
        assert.equal(error.statusCode, 409);
        return true;
      },
    );
  });
});

describe('get user by id', () => {
  it('returns the decrypted user to the owner', async () => {
    const id = new ObjectId();
    const service = createUserService({
      findByEmailHash: async () => null,
      insertUser: async (document) => ({ ...document, _id: new ObjectId() }),
      findById: async () => ({
        _id: id,
        nombre: 'Ana Perez',
        email: encryptField('ana@example.com'),
        emailHash: 'hash',
        telefono: null,
        curp: null,
        passwordHash: 'hashed',
        rol: 'USER',
        estatus: 'ACTIVO',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
    });

    const user = await service.getById(
      { sub: id.toHexString(), rol: 'USER' },
      id.toHexString(),
    );

    assert.equal(user.email, 'ana@example.com');
    assert.equal('password' in user, false);
    assert.equal('passwordHash' in user, false);
    assert.equal('emailHash' in user, false);
  });

  it('returns 403 when a user requests another id', async () => {
    let lookedUp = false;
    const service = createUserService({
      findByEmailHash: async () => null,
      insertUser: async (document) => ({ ...document, _id: new ObjectId() }),
      findById: async () => {
        lookedUp = true;
        return null;
      },
    });

    await assert.rejects(
      () =>
        service.getById(
          { sub: new ObjectId().toHexString(), rol: 'USER' },
          new ObjectId().toHexString(),
        ),
      (error: unknown) => {
        assert.ok(error instanceof HttpError);
        assert.equal(error.statusCode, 403);
        assert.equal(lookedUp, false);
        return true;
      },
    );
  });

  it('returns 404 when the id does not exist', async () => {
    const service = createUserService({
      findByEmailHash: async () => null,
      insertUser: async (document) => ({ ...document, _id: new ObjectId() }),
      findById: async () => null,
    });

    await assert.rejects(
      () =>
        service.getById(
          { sub: new ObjectId().toHexString(), rol: 'ADMIN' },
          new ObjectId().toHexString(),
        ),
      (error: unknown) => {
        assert.ok(error instanceof HttpError);
        assert.equal(error.statusCode, 404);
        return true;
      },
    );
  });

  it('returns 400 when the id is not an ObjectId', async () => {
    const service = createUserService({
      findByEmailHash: async () => null,
      insertUser: async (document) => ({ ...document, _id: new ObjectId() }),
      findById: async () => null,
    });

    await assert.rejects(
      () => service.getById({ sub: 'admin', rol: 'ADMIN' }, 'not-an-id'),
      (error: unknown) => {
        assert.ok(error instanceof HttpError);
        assert.equal(error.statusCode, 400);
        return true;
      },
    );
  });
});
