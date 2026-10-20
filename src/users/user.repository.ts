import { getUsersCollection } from '../db/client.js';
import type { UserDocument } from './user.model.js';

export async function findByEmailHash(
  emailHash: string,
): Promise<UserDocument | null> {
  const collection = await getUsersCollection();

  return collection.findOne({ emailHash });
}
