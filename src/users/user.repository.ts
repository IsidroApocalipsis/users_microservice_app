import { MongoServerError, ObjectId } from 'mongodb';
import { getUsersCollection } from '../db/client.js';
import type { UserDocument } from './user.model.js';

export class DuplicateEmailError extends Error {
  constructor() {
    super('Email already exists');
    this.name = 'DuplicateEmailError';
  }
}

export async function findById(id: string): Promise<UserDocument | null> {
  const collection = await getUsersCollection();

  return collection.findOne({ _id: new ObjectId(id) });
}

export async function findByEmailHash(
  emailHash: string,
): Promise<UserDocument | null> {
  const collection = await getUsersCollection();

  return collection.findOne({ emailHash });
}

export async function insertUser(
  document: Omit<UserDocument, '_id'>,
): Promise<UserDocument> {
  const collection = await getUsersCollection();
  const user: UserDocument = {
    ...document,
    _id: new ObjectId(),
  };

  try {
    await collection.insertOne(user);
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000) {
      throw new DuplicateEmailError();
    }

    throw error;
  }

  return user;
}
