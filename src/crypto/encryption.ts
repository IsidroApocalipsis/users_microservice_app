import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
  randomBytes,
} from 'node:crypto';
import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';
import type { EncryptedField } from '../users/user.model.js';

const AES_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const KEY_LENGTH = 32;
const EMAIL_LOOKUP_INFO = 'email-lookup';
const PASSWORD_ROUNDS = 12;

function emailLookupKey(): Buffer {
  return Buffer.from(
    hkdfSync(
      'sha256',
      env.dataEncryptionKey,
      Buffer.alloc(0),
      EMAIL_LOOKUP_INFO,
      KEY_LENGTH,
    ),
  );
}

export function encryptField(plaintext: string): EncryptedField {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(AES_ALGORITHM, env.dataEncryptionKey, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  return {
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  };
}

export function decryptField(value: EncryptedField): string {
  const decipher = createDecipheriv(
    AES_ALGORITHM,
    env.dataEncryptionKey,
    Buffer.from(value.iv, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(value.tag, 'base64'));

  return Buffer.concat([
    decipher.update(Buffer.from(value.ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

export function hashEmail(normalizedEmail: string): string {
  return createHmac('sha256', emailLookupKey())
    .update(normalizedEmail)
    .digest('hex');
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, PASSWORD_ROUNDS);
}

export function comparePassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}
