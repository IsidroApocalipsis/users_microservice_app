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

export const env = {
  port: readPort(process.env.PORT),
  nodeEnv: readNodeEnv(process.env.NODE_ENV),
  dataEncryptionKey: readDataEncryptionKey(process.env.DATA_ENCRYPTION_KEY),
};
