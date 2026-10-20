import type { IndexDescription, ObjectId } from 'mongodb';

export const USER_ROLES = ['ADMIN', 'USER'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ['ACTIVO', 'INACTIVO'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export type EncryptedField = {
  iv: string;
  tag: string;
  ciphertext: string;
};

export type UserDocument = {
  _id: ObjectId;
  nombre: string;
  email: EncryptedField;
  /** HMAC-SHA256 of the normalized email. Login and uniqueness use this field. */
  emailHash: string;
  telefono: EncryptedField | null;
  curp: EncryptedField | null;
  passwordHash: string;
  rol: UserRole;
  estatus: UserStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type PublicUser = {
  id: string;
  nombre: string;
  email: string;
  telefono: string | null;
  curp: string | null;
  rol: UserRole;
  estatus: UserStatus;
  createdAt: Date;
  updatedAt: Date;
};

export const userEmailHashIndex: IndexDescription = {
  key: { emailHash: 1 },
  unique: true,
  name: 'users_emailHash_unique',
};

export const userStatusIndex: IndexDescription = {
  key: { estatus: 1 },
  name: 'users_estatus',
};
