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
const { updateUserSchema } = await import('./user.schema.js');

const missingStoreMethods = {
  findById: async () => null,
  listUsers: async () => ({ users: [], total: 0 }),
  updateUser: async () => null,
  revokeSessions: async () => undefined,
};

function storedUser(overrides: Partial<UserDocument> = {}): UserDocument {
  return {
    _id: new ObjectId(),
    nombre: 'Ana Perez',
    email: encryptField('ana@example.com'),
    emailHash: 'hash',
    telefono: encryptField('5512345678'),
    curp: null,
    passwordHash: 'hashed',
    rol: 'USER',
    estatus: 'ACTIVO',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

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
      ...missingStoreMethods,
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
      ...missingStoreMethods,
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
      ...missingStoreMethods,
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
      ...missingStoreMethods,
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

describe('list users', () => {
  it('returns a decrypted page without passwords', async () => {
    const id = new ObjectId();
    const service = createUserService({
      ...missingStoreMethods,
      findByEmailHash: async () => null,
      insertUser: async (document) => ({ ...document, _id: new ObjectId() }),
      listUsers: async () => ({
        users: [
          {
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
          },
        ],
        total: 1,
      }),
    });

    const page = await service.list({ page: 1, limit: 20 });

    assert.equal(page.page, 1);
    assert.equal(page.limit, 20);
    assert.equal(page.total, 1);
    assert.equal(page.users[0]?.email, 'ana@example.com');
    assert.equal('password' in (page.users[0] ?? {}), false);
    assert.equal('passwordHash' in (page.users[0] ?? {}), false);
    assert.equal('emailHash' in (page.users[0] ?? {}), false);
  });

  it('forwards the status filter and page offset', async () => {
    let received: { estatus?: string; skip: number; limit: number } | undefined;
    const service = createUserService({
      ...missingStoreMethods,
      findByEmailHash: async () => null,
      insertUser: async (document) => ({ ...document, _id: new ObjectId() }),
      listUsers: async (query) => {
        received = query;
        return { users: [], total: 0 };
      },
    });

    await service.list({ page: 2, limit: 10, estatus: 'ACTIVO' });

    assert.deepEqual(received, { estatus: 'ACTIVO', skip: 10, limit: 10 });
  });
});

describe('update user schema', () => {
  it('rejects an empty patch', () => {
    const result = updateUserSchema.safeParse({});

    assert.equal(result.success, false);
  });

  it('clears telefono with null and ignores a blank string when another field is present', () => {
    const cleared = updateUserSchema.parse({ telefono: null });
    const ignored = updateUserSchema.parse({ nombre: 'Ana', telefono: '' });

    assert.equal(cleared.telefono, null);
    assert.equal(ignored.nombre, 'Ana');
    assert.equal(ignored.telefono, undefined);
  });
});

describe('update user', () => {
  it('lets an admin change another user without returning secrets', async () => {
    const current = storedUser();
    const service = createUserService({
      ...missingStoreMethods,
      findByEmailHash: async () => null,
      insertUser: async (document) => ({ ...document, _id: new ObjectId() }),
      findById: async () => current,
      updateUser: async (_id, changes) => ({ ...current, ...changes }),
    });

    const updated = await service.update(
      { sub: new ObjectId().toHexString(), rol: 'ADMIN' },
      current._id.toHexString(),
      { nombre: 'Ana Lopez' },
    );

    assert.equal(updated.nombre, 'Ana Lopez');
    assert.equal(updated.email, 'ana@example.com');
    assert.equal('password' in updated, false);
    assert.equal('passwordHash' in updated, false);
    assert.equal('emailHash' in updated, false);
  });

  it('lets a user change their own email', async () => {
    const current = storedUser();
    let wroteEmail = false;
    const service = createUserService({
      ...missingStoreMethods,
      findByEmailHash: async () => null,
      insertUser: async (document) => ({ ...document, _id: new ObjectId() }),
      findById: async () => current,
      updateUser: async (_id, changes) => {
        wroteEmail = changes.emailHash !== undefined;
        return { ...current, ...changes };
      },
    });

    const updated = await service.update(
      { sub: current._id.toHexString(), rol: 'USER' },
      current._id.toHexString(),
      { email: 'ana.nueva@example.com' },
    );

    assert.equal(updated.email, 'ana.nueva@example.com');
    assert.equal(wroteEmail, true);
  });

  it('returns 403 when a user sends a role and does not write', async () => {
    let lookedUp = false;
    let wrote = false;
    const id = new ObjectId().toHexString();
    const service = createUserService({
      ...missingStoreMethods,
      findByEmailHash: async () => null,
      insertUser: async (document) => ({ ...document, _id: new ObjectId() }),
      findById: async () => {
        lookedUp = true;
        return null;
      },
      updateUser: async () => {
        wrote = true;
        return null;
      },
    });

    await assert.rejects(
      () => service.update({ sub: id, rol: 'USER' }, id, { rol: 'ADMIN' }),
      (error: unknown) => {
        assert.ok(error instanceof HttpError);
        assert.equal(error.statusCode, 403);
        assert.equal(error.message, 'Cannot change role');
        assert.equal(lookedUp, false);
        assert.equal(wrote, false);
        return true;
      },
    );
  });

  it('returns 403 when a user updates another id without a lookup', async () => {
    let lookedUp = false;
    const service = createUserService({
      ...missingStoreMethods,
      findByEmailHash: async () => null,
      insertUser: async (document) => ({ ...document, _id: new ObjectId() }),
      findById: async () => {
        lookedUp = true;
        return null;
      },
    });

    await assert.rejects(
      () =>
        service.update(
          { sub: new ObjectId().toHexString(), rol: 'USER' },
          new ObjectId().toHexString(),
          { nombre: 'Otra' },
        ),
      (error: unknown) => {
        assert.ok(error instanceof HttpError);
        assert.equal(error.statusCode, 403);
        assert.equal(error.message, 'Forbidden');
        assert.equal(lookedUp, false);
        return true;
      },
    );
  });

  it('returns 400 when the id is not an ObjectId', async () => {
    const service = createUserService({
      ...missingStoreMethods,
      findByEmailHash: async () => null,
      insertUser: async (document) => ({ ...document, _id: new ObjectId() }),
    });

    await assert.rejects(
      () => service.update({ sub: 'admin', rol: 'ADMIN' }, 'not-an-id', { nombre: 'Ana' }),
      (error: unknown) => {
        assert.ok(error instanceof HttpError);
        assert.equal(error.statusCode, 400);
        return true;
      },
    );
  });

  it('returns 404 when the id does not exist', async () => {
    let wrote = false;
    const service = createUserService({
      ...missingStoreMethods,
      findByEmailHash: async () => null,
      insertUser: async (document) => ({ ...document, _id: new ObjectId() }),
      findById: async () => null,
      updateUser: async () => {
        wrote = true;
        return null;
      },
    });

    await assert.rejects(
      () =>
        service.update(
          { sub: new ObjectId().toHexString(), rol: 'ADMIN' },
          new ObjectId().toHexString(),
          { nombre: 'Ana' },
        ),
      (error: unknown) => {
        assert.ok(error instanceof HttpError);
        assert.equal(error.statusCode, 404);
        assert.equal(wrote, false);
        return true;
      },
    );
  });

  it('returns 409 when the email belongs to someone else', async () => {
    const current = storedUser();
    let wrote = false;
    const service = createUserService({
      ...missingStoreMethods,
      findByEmailHash: async () => storedUser(),
      insertUser: async (document) => ({ ...document, _id: new ObjectId() }),
      findById: async () => current,
      updateUser: async () => {
        wrote = true;
        return current;
      },
    });

    await assert.rejects(
      () =>
        service.update(
          { sub: current._id.toHexString(), rol: 'USER' },
          current._id.toHexString(),
          { email: 'ocupado@example.com' },
        ),
      (error: unknown) => {
        assert.ok(error instanceof HttpError);
        assert.equal(error.statusCode, 409);
        assert.equal(wrote, false);
        return true;
      },
    );
  });

  it('keeps the update when the email already belongs to the same user', async () => {
    const current = storedUser();
    let wrote = false;
    const service = createUserService({
      ...missingStoreMethods,
      findByEmailHash: async () => current,
      insertUser: async (document) => ({ ...document, _id: new ObjectId() }),
      findById: async () => current,
      updateUser: async (_id, changes) => {
        wrote = true;
        return { ...current, ...changes };
      },
    });

    const updated = await service.update(
      { sub: current._id.toHexString(), rol: 'USER' },
      current._id.toHexString(),
      { email: 'ana@example.com' },
    );

    assert.equal(updated.email, 'ana@example.com');
    assert.equal(wrote, true);
  });

  it('stores a password hash and clears telefono', async () => {
    const current = storedUser();
    let changesSeen: { passwordHash?: string; telefono?: unknown } = {};
    const service = createUserService({
      ...missingStoreMethods,
      findByEmailHash: async () => null,
      insertUser: async (document) => ({ ...document, _id: new ObjectId() }),
      findById: async () => current,
      updateUser: async (_id, changes) => {
        changesSeen = changes;
        return {
          ...current,
          ...changes,
          telefono: changes.telefono === undefined ? current.telefono : changes.telefono,
        };
      },
    });

    const updated = await service.update(
      { sub: current._id.toHexString(), rol: 'USER' },
      current._id.toHexString(),
      { password: 'nueva1234', telefono: null, estatus: 'INACTIVO' },
    );

    assert.equal(updated.telefono, null);
    assert.equal(updated.estatus, 'INACTIVO');
    assert.equal(changesSeen.telefono, null);
    assert.match(changesSeen.passwordHash ?? '', /^\$2[aby]\$/);
    assert.notEqual(changesSeen.passwordHash, 'nueva1234');
    assert.equal('password' in updated, false);
  });
});

describe('deactivate user', () => {
  it('marks an active user inactive without returning secrets', async () => {
    const current = storedUser();
    let changesSeen: { estatus?: string; updatedAt?: Date } = {};
    const service = createUserService({
      ...missingStoreMethods,
      findByEmailHash: async () => null,
      insertUser: async (document) => ({ ...document, _id: new ObjectId() }),
      findById: async () => current,
      updateUser: async (_id, changes) => {
        changesSeen = changes;
        return { ...current, ...changes };
      },
    });

    const deactivated = await service.deactivate(current._id.toHexString());

    assert.equal(deactivated.estatus, 'INACTIVO');
    assert.equal(deactivated.email, 'ana@example.com');
    assert.equal(deactivated.createdAt.toISOString(), current.createdAt.toISOString());
    assert.equal(changesSeen.estatus, 'INACTIVO');
    assert.ok(changesSeen.updatedAt instanceof Date);
    assert.equal('password' in deactivated, false);
    assert.equal('passwordHash' in deactivated, false);
    assert.equal('emailHash' in deactivated, false);
  });

  it('returns an inactive user without writing again', async () => {
    const current = storedUser({ estatus: 'INACTIVO' });
    let wrote = false;
    const service = createUserService({
      ...missingStoreMethods,
      findByEmailHash: async () => null,
      insertUser: async (document) => ({ ...document, _id: new ObjectId() }),
      findById: async () => current,
      updateUser: async () => {
        wrote = true;
        return current;
      },
    });

    const deactivated = await service.deactivate(current._id.toHexString());

    assert.equal(deactivated.estatus, 'INACTIVO');
    assert.equal(wrote, false);
  });

  it('returns 404 when the id does not exist', async () => {
    const service = createUserService({
      ...missingStoreMethods,
      findByEmailHash: async () => null,
      insertUser: async (document) => ({ ...document, _id: new ObjectId() }),
      findById: async () => null,
    });

    await assert.rejects(
      () => service.deactivate(new ObjectId().toHexString()),
      (error: unknown) => {
        assert.ok(error instanceof HttpError);
        assert.equal(error.statusCode, 404);
        return true;
      },
    );
  });

  it('returns 400 when the id is not an ObjectId', async () => {
    let lookedUp = false;
    const service = createUserService({
      ...missingStoreMethods,
      findByEmailHash: async () => null,
      insertUser: async (document) => ({ ...document, _id: new ObjectId() }),
      findById: async () => {
        lookedUp = true;
        return null;
      },
    });

    await assert.rejects(
      () => service.deactivate('not-an-id'),
      (error: unknown) => {
        assert.ok(error instanceof HttpError);
        assert.equal(error.statusCode, 400);
        assert.equal(lookedUp, false);
        return true;
      },
    );
  });
});

describe('session revocation', () => {
  it('revokes sessions when an active user is deactivated', async () => {
    const current = storedUser();
    let revokedId = '';
    const service = createUserService({
      ...missingStoreMethods,
      findByEmailHash: async () => null,
      insertUser: async (document) => ({ ...document, _id: new ObjectId() }),
      findById: async () => current,
      updateUser: async (_id, changes) => ({ ...current, ...changes }),
      revokeSessions: async (userId) => {
        revokedId = userId;
      },
    });

    await service.deactivate(current._id.toHexString());

    assert.equal(revokedId, current._id.toHexString());
  });

  it('revokes sessions when the user is already inactive', async () => {
    const current = storedUser({ estatus: 'INACTIVO' });
    let revoked = false;
    const service = createUserService({
      ...missingStoreMethods,
      findByEmailHash: async () => null,
      insertUser: async (document) => ({ ...document, _id: new ObjectId() }),
      findById: async () => current,
      revokeSessions: async () => {
        revoked = true;
      },
    });

    await service.deactivate(current._id.toHexString());

    assert.equal(revoked, true);
  });

  it('revokes sessions when the password, role, or status changes', async () => {
    const current = storedUser();
    const revoked: string[] = [];
    const service = createUserService({
      ...missingStoreMethods,
      findByEmailHash: async () => null,
      insertUser: async (document) => ({ ...document, _id: new ObjectId() }),
      findById: async () => current,
      updateUser: async (_id, changes) => ({ ...current, ...changes }),
      revokeSessions: async () => {
        revoked.push('revoked');
      },
    });
    const actor = { sub: new ObjectId().toHexString(), rol: 'ADMIN' as const };

    await service.update(actor, current._id.toHexString(), { nombre: 'Ana Lopez' });
    await service.update(actor, current._id.toHexString(), { password: 'nueva1234' });
    await service.update(actor, current._id.toHexString(), { rol: 'ADMIN' });
    await service.update(actor, current._id.toHexString(), { estatus: 'INACTIVO' });

    assert.deepEqual(revoked, ['revoked', 'revoked', 'revoked']);
  });
});
