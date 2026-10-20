import { currentCorrelationId } from './request-context.js';

type LogLevel = 'info' | 'warn' | 'error';

type LogValue = string | number | boolean | null;

export function log(
  level: LogLevel,
  message: string,
  fields: Record<string, LogValue | undefined> = {},
): void {
  const entry: Record<string, LogValue> = {
    time: new Date().toISOString(),
    level,
    message,
  };
  const correlationId = currentCorrelationId();

  if (correlationId) {
    entry.correlationId = correlationId;
  }

  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) {
      entry[key] = value;
    }
  }

  const line = JSON.stringify(entry);

  if (level === 'info') {
    console.log(line);
    return;
  }

  console.error(line);
}
