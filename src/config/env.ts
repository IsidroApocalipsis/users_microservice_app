import 'dotenv/config';

export type NodeEnv = 'development' | 'test' | 'production';

function readNodeEnv(value: string | undefined): NodeEnv {
  if (value === 'production' || value === 'test') {
    return value;
  }

  return 'development';
}

function readPort(value: string | undefined): number {
  const port = Number(value ?? '3000');

  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid PORT: ${value}`);
  }

  return port;
}

function readDataEncryptionKey(value: string | undefined): Buffer {
  if (!value) {
    throw new Error('DATA_ENCRYPTION_KEY is required');
  }

  const key = Buffer.from(value, 'base64');

  if (key.length !== 32) {
    throw new Error('DATA_ENCRYPTION_KEY must decode to 32 bytes');
  }

  return key;
}

function readRequired(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

function readJwtSecret(value: string | undefined): string {
  const secret = readRequired('JWT_SECRET', value);

  if (secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters');
  }

  return secret;
}

export const env = {
  port: readPort(process.env.PORT),
  nodeEnv: readNodeEnv(process.env.NODE_ENV),
  dataEncryptionKey: readDataEncryptionKey(process.env.DATA_ENCRYPTION_KEY),
  mongodbUri: readRequired('MONGODB_URI', process.env.MONGODB_URI),
  jwtSecret: readJwtSecret(process.env.JWT_SECRET),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
};
