import { ObjectId } from 'mongodb';
import type { AccessTokenPayload } from '../auth/token.js';
import { hashEmail } from '../crypto/encryption.js';
import { HttpError } from '../middlewares/http-error.js';
import { toPublicUser, toUserDocument } from './user.mapper.js';
import type { PublicUser, UserDocument } from './user.model.js';
import { DuplicateEmailError } from './user.repository.js';
import type { CreateUserInput } from './user.schema.js';

export type UserStore = {
  findByEmailHash(emailHash: string): Promise<UserDocument | null>;
  findById(id: string): Promise<UserDocument | null>;
  insertUser(document: Omit<UserDocument, '_id'>): Promise<UserDocument>;
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

    async getById(actor: AccessTokenPayload, id: string): Promise<PublicUser> {
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
  };
}
