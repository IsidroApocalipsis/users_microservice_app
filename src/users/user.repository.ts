import { MongoServerError, ObjectId } from 'mongodb';
import { getUsersCollection } from '../db/client.js';
import type { UserDocument, UserStatus, UserUpdate } from './user.model.js';

export type UserListQuery = {
  estatus?: UserStatus;
  skip: number;
  limit: number;
};

export type UserPage = {
  users: UserDocument[];
  total: number;
};

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

export async function updateUser(
  id: string,
  changes: UserUpdate,
): Promise<UserDocument | null> {
  const collection = await getUsersCollection();

  try {
    return await collection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: changes },
      { returnDocument: 'after' },
    );
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000) {
      throw new DuplicateEmailError();
    }

    throw error;
  }
}

function statusFilter(estatus?: UserStatus): { estatus?: UserStatus } {
  return estatus ? { estatus } : {};
}

export async function listUsers(query: UserListQuery): Promise<UserPage> {
  const collection = await getUsersCollection();
  const filter = statusFilter(query.estatus);
  const [users, total] = await Promise.all([
    collection
      .find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(query.skip)
      .limit(query.limit)
      .toArray(),
    collection.countDocuments(filter),
  ]);

  return { users, total };
}
