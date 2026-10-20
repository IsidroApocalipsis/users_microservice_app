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

const DURATION_PATTERN = /^(\d+)([smhd])$/;

const DURATION_MS = {
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
} as const;

function readRefreshExpiresIn(value: string | undefined): string {
  const duration = value || '7d';

  if (!DURATION_PATTERN.test(duration)) {
    throw new Error('JWT_REFRESH_EXPIRES_IN must be a duration like 15m, 1h, or 7d');
  }

  return duration;
}

export function refreshTokenTtlMs(duration: string): number {
  const match = DURATION_PATTERN.exec(duration);

  if (!match) {
    throw new Error('JWT_REFRESH_EXPIRES_IN must be a duration like 15m, 1h, or 7d');
  }

  const amount = Number(match[1]);
  const unit = match[2] as keyof typeof DURATION_MS;

  return amount * DURATION_MS[unit];
}

export const env = {
  port: readPort(process.env.PORT),
  nodeEnv: readNodeEnv(process.env.NODE_ENV),
  dataEncryptionKey: readDataEncryptionKey(process.env.DATA_ENCRYPTION_KEY),
  mongodbUri: readRequired('MONGODB_URI', process.env.MONGODB_URI),
  jwtSecret: readJwtSecret(process.env.JWT_SECRET),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
  jwtRefreshExpiresIn: readRefreshExpiresIn(process.env.JWT_REFRESH_EXPIRES_IN),
};
