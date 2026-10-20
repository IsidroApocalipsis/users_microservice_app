import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.js';
import { HttpError } from '../middlewares/http-error.js';
import { USER_ROLES, type UserDocument, type UserRole } from '../users/user.model.js';

export type AccessTokenPayload = {
  sub: string;
  rol: UserDocument['rol'];
};

export function signAccessToken(
  user: Pick<UserDocument, '_id' | 'rol'>,
): string {
  const payload: AccessTokenPayload = {
    sub: user._id.toHexString(),
    rol: user.rol,
  };

  const options: SignOptions = {
    expiresIn: env.jwtExpiresIn as SignOptions['expiresIn'],
  };

  return jwt.sign(payload, env.jwtSecret, options);
}

function isUserRole(value: unknown): value is UserRole {
  return USER_ROLES.some((role) => role === value);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const decoded = jwt.verify(token, env.jwtSecret);

    if (
      typeof decoded === 'string' ||
      typeof decoded.sub !== 'string' ||
      !isUserRole(decoded.rol)
    ) {
      throw new HttpError(401, 'Unauthorized');
    }

    return { sub: decoded.sub, rol: decoded.rol };
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    throw new HttpError(401, 'Unauthorized');
  }
}
