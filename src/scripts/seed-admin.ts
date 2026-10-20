import { ObjectId } from 'mongodb';
import type { ZodError } from 'zod';
import { getMongoClient, getUsersCollection } from '../db/client.js';
import { hashEmail } from '../crypto/encryption.js';
import { toUserDocument } from '../users/user.mapper.js';
import { findByEmailHash } from '../users/user.repository.js';
import { createUserSchema } from '../users/user.schema.js';

let connectionOpened = false;

function validationMessage(error: ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join('.') || 'input'}: ${issue.message}`)
    .join('; ');
}

async function seedAdmin(): Promise<void> {
  const parsed = createUserSchema.safeParse({
    nombre: process.env.SEED_ADMIN_NOMBRE,
    email: process.env.SEED_ADMIN_EMAIL,
    password: process.env.SEED_ADMIN_PASSWORD,
    rol: 'ADMIN',
  });

  if (!parsed.success) {
    throw new Error(validationMessage(parsed.error));
  }

  await getMongoClient();
  connectionOpened = true;

  const input = parsed.data;
  const existing = await findByEmailHash(hashEmail(input.email));

  if (existing) {
    console.log(`Admin seed skipped for ${input.email}`);
    return;
  }

  const collection = await getUsersCollection();
  await collection.insertOne({
    _id: new ObjectId(),
    ...(await toUserDocument(input)),
  });
  console.log(`Admin seed created for ${input.email}`);
}

async function closeConnection(): Promise<void> {
  if (!connectionOpened) {
    return;
  }

  const client = await getMongoClient();
  await client.close();
}

seedAdmin()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Admin seed failed';
    console.error(message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeConnection();
    process.exit(process.exitCode ?? 0);
  });
