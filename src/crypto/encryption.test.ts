import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { describe, it } from 'node:test';

process.env.DATA_ENCRYPTION_KEY ??= randomBytes(32).toString('base64');
process.env.MONGODB_URI ??=
  'mongodb://127.0.0.1:27017/users?retryWrites=false';
process.env.JWT_SECRET ??= randomBytes(32).toString('hex');

const { decryptField, encryptField, hashEmail } = await import('./encryption.js');

describe('field encryption', () => {
  it('decrypts back to the original text', () => {
    const encrypted = encryptField('ana@example.com');

    assert.equal(decryptField(encrypted), 'ana@example.com');
  });

  it('produces different ciphertext for the same text', () => {
    const first = encryptField('ana@example.com');
    const second = encryptField('ana@example.com');

    assert.notEqual(first.ciphertext, second.ciphertext);
    assert.notEqual(first.iv, second.iv);
  });

  it('rejects a tampered auth tag', () => {
    const encrypted = encryptField('ana@example.com');
    const tag = Buffer.from(encrypted.tag, 'base64');
    tag[0] = tag[0] ^ 0xff;

    assert.throws(() =>
      decryptField({
        ...encrypted,
        tag: tag.toString('base64'),
      }),
    );
  });
});

describe('email lookup hash', () => {
  it('returns the same hash for the same email', () => {
    assert.equal(hashEmail('ana@example.com'), hashEmail('ana@example.com'));
  });

  it('returns a different hash for a different email', () => {
    assert.notEqual(hashEmail('ana@example.com'), hashEmail('ana@other.com'));
  });
});
