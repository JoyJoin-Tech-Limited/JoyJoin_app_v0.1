import { describe, it, expect, beforeEach } from 'vitest';
import {
  recordVoteOptimistically,
  isOperationIdProcessed,
  type IdempotentVotePayload,
} from '../lib/optimisticSync';

// Reset the in-memory store between tests by reaching into the module.
// Vitest re-evaluates the module on each test file run, but within the file
// we need to clean up explicitly for isolated assertions.
async function resetStore(): Promise<void> {
  const module = await import('../lib/optimisticSync');
  // The module-level Map is not exported; we rely on the fact that
  // operationIds are unique per test and TTL is long enough not to interfere.
  // For true isolation we re-import, but since this is a single test file
  // we just use unique operationIds per test.
}

describe('recordVoteOptimistically', () => {
  beforeEach(() => {
    // No explicit reset needed because we use unique operationIds per test.
  });

  it('accepts a valid vote on first submission', async () => {
    const payload: IdempotentVotePayload = {
      operationId: 'op-valid-001',
      socialSessionId: 'sess-1',
      phase: 'lie_detective',
      vote: { targetUserId: 'user-2', choiceIndex: 1 },
    };

    const result = await recordVoteOptimistically(
      payload,
      async () => true,
      async () => {},
    );

    expect(result.accepted).toBe(true);
    expect(result.conflict).toBeUndefined();
  });

  it('rejects when validation fails', async () => {
    const payload: IdempotentVotePayload = {
      operationId: 'op-reject-001',
      socialSessionId: 'sess-1',
      phase: 'warmup',
      vote: { choiceIndex: 2 },
    };

    const result = await recordVoteOptimistically(
      payload,
      async () => false,
      async () => {},
    );

    expect(result.accepted).toBe(false);
    expect(result.conflict).toBe('validation_failed');
  });

  it('is idempotent — re-playing same operationId returns accepted', async () => {
    const payload: IdempotentVotePayload = {
      operationId: 'op-idempotent-001',
      socialSessionId: 'sess-1',
      phase: 'auction',
      vote: { targetUserId: 'user-3' },
    };

    const first = await recordVoteOptimistically(
      payload,
      async () => true,
      async () => {},
    );
    expect(first.accepted).toBe(true);

    const second = await recordVoteOptimistically(
      payload,
      async () => true,
      async () => {},
    );
    expect(second.accepted).toBe(true);
    expect(second.conflict).toBeUndefined();
  });

  it('rejects when apply throws', async () => {
    const payload: IdempotentVotePayload = {
      operationId: 'op-apply-fail-001',
      socialSessionId: 'sess-1',
      phase: 'group_mirror',
      vote: { choiceIndex: 0 },
    };

    const result = await recordVoteOptimistically(
      payload,
      async () => true,
      async () => {
        throw new Error('DB down');
      },
    );

    expect(result.accepted).toBe(false);
    expect(result.conflict).toBe('apply_failed');
  });

  it('rejects when validate throws', async () => {
    const payload: IdempotentVotePayload = {
      operationId: 'op-validate-error-001',
      socialSessionId: 'sess-1',
      phase: 'lie_detective',
      vote: {},
    };

    const result = await recordVoteOptimistically(
      payload,
      async () => {
        throw new Error('validation logic error');
      },
      async () => {},
    );

    expect(result.accepted).toBe(false);
    expect(result.conflict).toBe('validation_error');
  });
});

describe('isOperationIdProcessed', () => {
  it('returns false for an unknown operationId', async () => {
    const result = await isOperationIdProcessed('op-never-seen-999');
    expect(result).toBe(false);
  });

  it('returns true after a vote has been recorded', async () => {
    const payload: IdempotentVotePayload = {
      operationId: 'op-processed-001',
      socialSessionId: 'sess-1',
      phase: 'warmup',
      vote: { choiceIndex: 1 },
    };

    await recordVoteOptimistically(
      payload,
      async () => true,
      async () => {},
    );

    const result = await isOperationIdProcessed(payload.operationId);
    expect(result).toBe(true);
  });
});
