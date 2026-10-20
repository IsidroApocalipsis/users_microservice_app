import type { IndexDescription, ObjectId } from 'mongodb';

export type SessionDocument = {
  _id: ObjectId;
  userId: ObjectId;
  refreshTokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export const sessionUserIndex: IndexDescription = {
  key: { userId: 1 },
  name: 'sessions_userId',
};

export const sessionExpiryIndex: IndexDescription = {
  key: { expiresAt: 1 },
  name: 'sessions_expiresAt_ttl',
  expireAfterSeconds: 0,
};

export const sessionRefreshTokenIndex: IndexDescription = {
  key: { refreshTokenHash: 1 },
  unique: true,
  name: 'sessions_refreshTokenHash_unique',
};
