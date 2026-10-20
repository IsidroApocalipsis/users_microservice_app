import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Request, Response } from 'express';
import { correlationId } from '../middlewares/correlation-id.js';
import {
  currentCorrelationId,
  resolveCorrelationId,
} from './request-context.js';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('correlation id', () => {
  it('keeps a valid UUID', () => {
    const id = '8B6C1C2E-3F4A-4D5E-9A7B-1C2D3E4F5A6B';

    assert.equal(resolveCorrelationId(id), id);
    assert.equal(resolveCorrelationId(`  ${id}  `), id);
  });

  it('replaces an empty or unexpected value', () => {
    for (const header of [undefined, '', '   ', 'not-a-uuid', '8b6c1c2e-3f4a-4d5e-9a7b']) {
      const id = resolveCorrelationId(header);
      assert.match(id, UUID_PATTERN);
      assert.notEqual(id, header?.trim());
    }
  });

  it('echoes the id on the response and stores it for the request', () => {
    const incoming = '8b6c1c2e-3f4a-4d5e-9a7b-1c2d3e4f5a6b';
    const headers = new Map<string, string>();
    let seen: string | undefined;

    correlationId(
      { header: () => incoming } as unknown as Request,
      {
        setHeader(name: string, value: string | number | readonly string[]) {
          headers.set(name, String(value));
        },
      } as Response,
      () => {
        seen = currentCorrelationId();
      },
    );

    assert.equal(seen, incoming);
    assert.equal(headers.get('x-request-id'), incoming);
  });

  it('echoes a generated id when the header is not a UUID', () => {
    const headers = new Map<string, string>();
    let seen: string | undefined;

    correlationId(
      { header: () => 'pedido-1' } as unknown as Request,
      {
        setHeader(name: string, value: string | number | readonly string[]) {
          headers.set(name, String(value));
        },
      } as Response,
      () => {
        seen = currentCorrelationId();
      },
    );

    assert.match(seen ?? '', UUID_PATTERN);
    assert.equal(headers.get('x-request-id'), seen);
  });
});
