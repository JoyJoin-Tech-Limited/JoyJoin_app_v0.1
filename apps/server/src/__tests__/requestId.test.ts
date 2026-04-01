/**
 * Unit tests for the requestId middleware
 *
 * Verifies that:
 *   1. A UUID v4 is generated and attached when no header is present.
 *   2. The X-Request-Id response header is set.
 *   3. An existing X-Request-Id header value is propagated.
 *   4. Malformed / array header values are ignored and a fresh ID is generated.
 */

import { describe, it, expect } from 'vitest';
import { requestIdMiddleware } from '../middleware/requestId';
import type { Request, Response } from 'express';

// ---------------------------------------------------------------------------
// Lightweight fakes
// ---------------------------------------------------------------------------

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    ...overrides,
  } as unknown as Request;
}

function makeRes(): { res: Response; headers: Record<string, string> } {
  const headers: Record<string, string> = {};
  const res = {
    setHeader(name: string, value: string) {
      headers[name.toLowerCase()] = value;
    },
    getHeader(name: string) {
      return headers[name.toLowerCase()];
    },
  } as unknown as Response;
  return { res, headers };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('requestIdMiddleware', () => {
  it('generates a UUID when X-Request-Id header is absent', () => {
    const req = makeReq();
    const { res, headers } = makeRes();
    let nextCalled = false;

    requestIdMiddleware(req, res, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
    expect(UUID_RE.test(req.requestId)).toBe(true);
    expect(UUID_RE.test(headers['x-request-id'])).toBe(true);
    expect(req.requestId).toBe(headers['x-request-id']);
  });

  it('propagates a valid X-Request-Id header from upstream', () => {
    const incoming = 'upstream-trace-abc-123';
    const req = makeReq({ headers: { 'x-request-id': incoming } });
    const { res, headers } = makeRes();

    requestIdMiddleware(req, res, () => {});

    expect(req.requestId).toBe(incoming);
    expect(headers['x-request-id']).toBe(incoming);
  });

  it('ignores an array header value and generates a fresh UUID', () => {
    const req = makeReq({
      headers: { 'x-request-id': ['id-1', 'id-2'] as unknown as string },
    });
    const { res, headers } = makeRes();

    requestIdMiddleware(req, res, () => {});

    // Array values should be rejected; a fresh UUID must be generated
    expect(UUID_RE.test(req.requestId)).toBe(true);
    expect(headers['x-request-id']).toBe(req.requestId);
  });

  it('ignores an empty string header and generates a fresh UUID', () => {
    const req = makeReq({ headers: { 'x-request-id': '' } });
    const { res, headers } = makeRes();

    requestIdMiddleware(req, res, () => {});

    expect(UUID_RE.test(req.requestId)).toBe(true);
    expect(headers['x-request-id']).toBe(req.requestId);
  });

  it('calls next()', () => {
    const req = makeReq();
    const { res } = makeRes();
    let nextCalled = false;

    requestIdMiddleware(req, res, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
  });
});
