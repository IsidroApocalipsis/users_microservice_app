import { ObjectId } from 'mongodb';
import { hashEmail } from '../crypto/encryption.js';
import { HttpError } from '../middlewares/http-error.js';
import { toPublicUser, toUserChanges, toUserDocument } from './user.mapper.js';
import type { PublicUser, UserDocument, UserRole, UserUpdate } from './user.model.js';
import {
  DuplicateEmailError,
  type UserListQuery,
  type UserPage,
} from './user.repository.js';
import type { CreateUserInput, ListUsersQuery, UpdateUserInput } from './user.schema.js';

export type UserList = {
  users: PublicUser[];
  page: number;
  limit: number;
  total: number;
};

export type UserStore = {
  findByEmailHash(emailHash: string): Promise<UserDocument | null>;
  findById(id: string): Promise<UserDocument | null>;
  insertUser(document: Omit<UserDocument, '_id'>): Promise<UserDocument>;
  listUsers(query: UserListQuery): Promise<UserPage>;
  updateUser(id: string, changes: UserUpdate): Promise<UserDocument | null>;
  revokeSessions(userId: string): Promise<void>;
};

type Actor = {
  sub: string;
  rol: UserRole;
};

export function createUserService(users: UserStore) {
  return {
    async create(input: CreateUserInput): Promise<PublicUser> {
      const existing = await users.findByEmailHash(hashEmail(input.email));

      if (existing) {
        throw new HttpError(409, 'Email already exists');
      }

      try {
        const created = await users.insertUser(await toUserDocument(input));
        return toPublicUser(created);
      } catch (error) {
        if (error instanceof DuplicateEmailError) {
          throw new HttpError(409, 'Email already exists');
        }

        throw error;
      }
    },

    async getById(actor: Actor, id: string): Promise<PublicUser> {
      if (actor.rol !== 'ADMIN' && actor.sub !== id) {
        throw new HttpError(403, 'Forbidden');
      }

      if (!ObjectId.isValid(id)) {
        throw new HttpError(400, 'Invalid user id');
      }

      const user = await users.findById(id);

      if (!user) {
        throw new HttpError(404, 'User not found');
      }

      return toPublicUser(user);
    },

    async list(query: ListUsersQuery): Promise<UserList> {
      const page = await users.listUsers({
        estatus: query.estatus,
        skip: (query.page - 1) * query.limit,
        limit: query.limit,
      });

      return {
        users: page.users.map((user) => toPublicUser(user)),
        page: query.page,
        limit: query.limit,
        total: page.total,
      };
    },

    async update(
      actor: Actor,
      id: string,
      input: UpdateUserInput,
    ): Promise<PublicUser> {
      if (actor.rol !== 'ADMIN' && actor.sub !== id) {
        throw new HttpError(403, 'Forbidden');
      }

      if (actor.rol !== 'ADMIN' && input.rol !== undefined) {
        throw new HttpError(403, 'Cannot change role');
      }

      if (!ObjectId.isValid(id)) {
        throw new HttpError(400, 'Invalid user id');
      }

      const current = await users.findById(id);

      if (!current) {
        throw new HttpError(404, 'User not found');
      }

      if (input.email !== undefined) {
        const existing = await users.findByEmailHash(hashEmail(input.email));

        if (existing && !existing._id.equals(current._id)) {
          throw new HttpError(409, 'Email already exists');
        }
      }

      try {
        const updated = await users.updateUser(id, await toUserChanges(input));

        if (!updated) {
          throw new HttpError(404, 'User not found');
        }

        if (
          input.password !== undefined ||
          input.rol !== undefined ||
          input.estatus === 'INACTIVO'
        ) {
          await users.revokeSessions(updated._id.toHexString());
        }

        return toPublicUser(updated);
      } catch (error) {
        if (error instanceof DuplicateEmailError) {
          throw new HttpError(409, 'Email already exists');
        }

        throw error;
      }
    },

    async deactivate(id: string): Promise<PublicUser> {
      if (!ObjectId.isValid(id)) {
        throw new HttpError(400, 'Invalid user id');
      }

      const current = await users.findById(id);

      if (!current) {
        throw new HttpError(404, 'User not found');
      }

      if (current.estatus === 'INACTIVO') {
        await users.revokeSessions(id);
        return toPublicUser(current);
      }

      const updated = await users.updateUser(id, {
        estatus: 'INACTIVO',
        updatedAt: new Date(),
      });

      if (!updated) {
        throw new HttpError(404, 'User not found');
      }

      await users.revokeSessions(id);

      return toPublicUser(updated);
    },
  };
}
