import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.js';
import type { UserDocument } from '../users/user.model.js';

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
