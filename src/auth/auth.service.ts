import { comparePassword, hashEmail } from '../crypto/encryption.js';
import { HttpError } from '../middlewares/http-error.js';
import type { UserDocument } from '../users/user.model.js';
import type { LoginUserInput } from '../users/user.schema.js';
import { signAccessToken } from './token.js';

const DUMMY_PASSWORD_HASH =
  '$2b$12$MlXEy.RlMpQKAz7n2/otxexmbHRXR5UrY2obQPOpju3Hu5JF4lV9S';

export type UserLookup = {
  findByEmailHash(emailHash: string): Promise<UserDocument | null>;
};

export type AccessTokenResult = {
  accessToken: string;
};

export function createAuthService(users: UserLookup) {
  return {
    async login(input: LoginUserInput): Promise<AccessTokenResult> {
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

      return { accessToken: signAccessToken(user) };
    },
  };
}
