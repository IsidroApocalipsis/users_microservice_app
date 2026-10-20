import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RequestContext = {
  correlationId: string;
};

const storage = new AsyncLocalStorage<RequestContext>();

export function resolveCorrelationId(header: string | undefined): string {
  const value = header?.trim() ?? '';

  if (UUID_PATTERN.test(value)) {
    return value;
  }

  return randomUUID();
}

export function runWithCorrelationId<T>(correlationId: string, fn: () => T): T {
  return storage.run({ correlationId }, fn);
}

export function currentCorrelationId(): string | undefined {
  return storage.getStore()?.correlationId;
}
