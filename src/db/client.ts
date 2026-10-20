import { MongoClient, type Collection } from 'mongodb';
import {
  sessionExpiryIndex,
  sessionRefreshTokenIndex,
  sessionUserIndex,
  type SessionDocument,
} from '../auth/session.model.js';
import { env } from '../config/env.js';
import {
  userEmailHashIndex,
  userStatusIndex,
  type UserDocument,
} from '../users/user.model.js';

const USERS_COLLECTION = 'users';
const SESSIONS_COLLECTION = 'sessions';

let clientPromise: Promise<MongoClient> | undefined;
let userIndexesPromise: Promise<void> | undefined;
let sessionIndexesPromise: Promise<void> | undefined;

export function getMongoClient(): Promise<MongoClient> {
  if (!clientPromise) {
    const client = new MongoClient(env.mongodbUri, { retryWrites: false });
    clientPromise = client.connect().catch((error: unknown) => {
      clientPromise = undefined;
      throw error;
    });
  }

  return clientPromise;
}

async function ensureUserIndexes(
  collection: Collection<UserDocument>,
): Promise<void> {
  if (!userIndexesPromise) {
    userIndexesPromise = Promise.all([
      collection.createIndex(userEmailHashIndex.key, {
        unique: true,
        name: userEmailHashIndex.name,
      }),
      collection.createIndex(userStatusIndex.key, {
        name: userStatusIndex.name,
      }),
    ])
      .then(() => undefined)
      .catch((error: unknown) => {
        userIndexesPromise = undefined;
        throw error;
      });
  }

  await userIndexesPromise;
}

async function ensureSessionIndexes(
  collection: Collection<SessionDocument>,
): Promise<void> {
  if (!sessionIndexesPromise) {
    sessionIndexesPromise = Promise.all([
      collection.createIndex(sessionUserIndex.key, {
        name: sessionUserIndex.name,
      }),
      collection.createIndex(sessionExpiryIndex.key, {
        name: sessionExpiryIndex.name,
        expireAfterSeconds: sessionExpiryIndex.expireAfterSeconds,
      }),
      collection.createIndex(sessionRefreshTokenIndex.key, {
        unique: true,
        name: sessionRefreshTokenIndex.name,
      }),
    ])
      .then(() => undefined)
      .catch((error: unknown) => {
        sessionIndexesPromise = undefined;
        throw error;
      });
  }

  await sessionIndexesPromise;
}

export async function getUsersCollection(): Promise<Collection<UserDocument>> {
  const client = await getMongoClient();
  const collection = client.db().collection<UserDocument>(USERS_COLLECTION);

  await ensureUserIndexes(collection);

  return collection;
}

export async function getSessionsCollection(): Promise<Collection<SessionDocument>> {
  const client = await getMongoClient();
  const collection = client.db().collection<SessionDocument>(SESSIONS_COLLECTION);

  await ensureSessionIndexes(collection);

  return collection;
}

export async function connectToDatabase(): Promise<void> {
  await Promise.all([getUsersCollection(), getSessionsCollection()]);
}
