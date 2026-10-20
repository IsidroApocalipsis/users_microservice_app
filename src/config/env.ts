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

export const env = {
  port: readPort(process.env.PORT),
  nodeEnv: readNodeEnv(process.env.NODE_ENV),
};
