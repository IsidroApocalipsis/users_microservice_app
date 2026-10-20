import { decryptField, encryptField, hashEmail, hashPassword } from '../crypto/encryption.js';
import type { CreateUserInput } from './user.schema.js';
import type { PublicUser, UserDocument } from './user.model.js';

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
