import { decryptField, encryptField, hashEmail, hashPassword } from '../crypto/encryption.js';
import type { PublicUser, UserDocument, UserUpdate } from './user.model.js';
import type { CreateUserInput, UpdateUserInput } from './user.schema.js';

type NewUserDocument = Omit<UserDocument, '_id'>;

export async function toUserDocument(
  input: CreateUserInput,
  now = new Date(),
): Promise<NewUserDocument> {
  return {
    nombre: input.nombre,
    email: encryptField(input.email),
    emailHash: hashEmail(input.email),
    telefono: input.telefono ? encryptField(input.telefono) : null,
    curp: input.curp ? encryptField(input.curp) : null,
    passwordHash: await hashPassword(input.password),
    rol: input.rol ?? 'USER',
    estatus: 'ACTIVO',
    createdAt: now,
    updatedAt: now,
  };
}

export async function toUserChanges(
  input: UpdateUserInput,
  now = new Date(),
): Promise<UserUpdate> {
  const changes: UserUpdate = { updatedAt: now };

  if (input.nombre !== undefined) {
    changes.nombre = input.nombre;
  }

  if (input.email !== undefined) {
    changes.email = encryptField(input.email);
    changes.emailHash = hashEmail(input.email);
  }

  if (input.telefono !== undefined) {
    changes.telefono = input.telefono ? encryptField(input.telefono) : null;
  }

  if (input.curp !== undefined) {
    changes.curp = input.curp ? encryptField(input.curp) : null;
  }

  if (input.password !== undefined) {
    changes.passwordHash = await hashPassword(input.password);
  }

  if (input.rol !== undefined) {
    changes.rol = input.rol;
  }

  if (input.estatus !== undefined) {
    changes.estatus = input.estatus;
  }

  return changes;
}

export function toPublicUser(document: UserDocument): PublicUser {
  return {
    id: document._id.toHexString(),
    nombre: document.nombre,
    email: decryptField(document.email),
    telefono: document.telefono ? decryptField(document.telefono) : null,
    curp: document.curp ? decryptField(document.curp) : null,
    rol: document.rol,
    estatus: document.estatus,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}
