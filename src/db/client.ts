import { MongoClient, type Collection } from 'mongodb';
import { env } from '../config/env.js';
import {
  userEmailHashIndex,
  userStatusIndex,
  type UserDocument,
} from '../users/user.model.js';

const USERS_COLLECTION = 'users';

let clientPromise: Promise<MongoClient> | undefined;
let indexesPromise: Promise<void> | undefined;

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
  if (!indexesPromise) {
    indexesPromise = Promise.all([
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
        indexesPromise = undefined;
        throw error;
      });
  }

  await indexesPromise;
}

export async function getUsersCollection(): Promise<Collection<UserDocument>> {
  const client = await getMongoClient();
  const collection = client.db().collection<UserDocument>(USERS_COLLECTION);

  await ensureUserIndexes(collection);

  return collection;
}

export async function connectToDatabase(): Promise<void> {
  await getUsersCollection();
}
