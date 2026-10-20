import { ObjectId } from 'mongodb';
import { getSessionsCollection } from '../db/client.js';
import type { SessionDocument } from './session.model.js';

export type NewSession = {
  userId: ObjectId;
  refreshTokenHash: string;
  expiresAt: Date;
};

export async function createSession(
  input: NewSession,
  now = new Date(),
): Promise<SessionDocument> {
  const collection = await getSessionsCollection();
  const session: SessionDocument = {
    _id: new ObjectId(),
    userId: input.userId,
    refreshTokenHash: input.refreshTokenHash,
    expiresAt: input.expiresAt,
    revokedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  await collection.insertOne(session);

  return session;
}

export async function findSessionById(id: string): Promise<SessionDocument | null> {
  if (!ObjectId.isValid(id)) {
    return null;
  }

  const collection = await getSessionsCollection();

  return collection.findOne({ _id: new ObjectId(id) });
}

export async function rotateRefreshToken(
  currentHash: string,
  nextHash: string,
  now = new Date(),
): Promise<SessionDocument | null> {
  const collection = await getSessionsCollection();

  return collection.findOneAndUpdate(
    {
      refreshTokenHash: currentHash,
      revokedAt: null,
      expiresAt: { $gt: now },
    },
    { $set: { refreshTokenHash: nextHash, updatedAt: now } },
    { returnDocument: 'after' },
  );
}

export async function revokeByRefreshTokenHash(
  refreshTokenHash: string,
  now = new Date(),
): Promise<void> {
  const collection = await getSessionsCollection();

  await collection.updateOne(
    { refreshTokenHash, revokedAt: null },
    { $set: { revokedAt: now, updatedAt: now } },
  );
}

export async function revokeSessionById(id: string, now = new Date()): Promise<void> {
  if (!ObjectId.isValid(id)) {
    return;
  }

  const collection = await getSessionsCollection();

  await collection.updateOne(
    { _id: new ObjectId(id), revokedAt: null },
    { $set: { revokedAt: now, updatedAt: now } },
  );
}

export async function revokeSessionsByUserId(
  userId: string,
  now = new Date(),
): Promise<void> {
  if (!ObjectId.isValid(userId)) {
    return;
  }

  const collection = await getSessionsCollection();

  await collection.updateMany(
    { userId: new ObjectId(userId), revokedAt: null },
    { $set: { revokedAt: now, updatedAt: now } },
  );
}
