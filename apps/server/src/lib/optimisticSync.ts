/**
 * Optimistic Sync — Server-side helpers
 *
 * The client applies mutations locally, then calls these idempotent endpoints.
 * Server deduplicates by client-generated operationId.
 *
 * Current implementation: in-memory Map with 5-minute TTL.
 * Future work: migrate to Redis for horizontal scaling.
 */

export interface IdempotentVotePayload {
  /** UUIDv4, client-generated, used for deduplication */
  operationId: string;
  socialSessionId: string;
  phase: string;
  vote: {
    targetUserId?: string;
    choiceIndex?: number;
    // Phase-specific vote shape can be extended here
    [key: string]: unknown;
  };
}

interface ProcessedEntry {
  processedAt: number;
}

const PROCESSED_TTL_MS = 5 * 60 * 1000; // 5 minutes

/** In-memory store for processed operationIds. */
const processedOps = new Map<string, ProcessedEntry>();

/** Clean up expired entries periodically (simple sweep on write). */
function sweepExpired(): void {
  const cutoff = Date.now() - PROCESSED_TTL_MS;
  for (const [key, entry] of processedOps) {
    if (entry.processedAt < cutoff) {
      processedOps.delete(key);
    }
  }
}

/**
 * Check whether an operationId has already been processed.
 */
export async function isOperationIdProcessed(operationId: string): Promise<boolean> {
  sweepExpired();
  const entry = processedOps.get(operationId);
  if (!entry) return false;
  return entry.processedAt > Date.now() - PROCESSED_TTL_MS;
}

/**
 * Record a vote optimistically with idempotent deduplication.
 *
 * Flow:
 * 1. Check if operationId already processed → return { accepted: true }
 * 2. Run validate(payload) → if false, return { accepted: false, conflict: 'validation_failed' }
 * 3. Run apply(payload) → on error, return { accepted: false, conflict: 'apply_failed' }
 * 4. Mark operationId as processed → return { accepted: true }
 */
export async function recordVoteOptimistically(
  payload: IdempotentVotePayload,
  validate: (vote: IdempotentVotePayload) => Promise<boolean>,
  apply: (vote: IdempotentVotePayload) => Promise<void>,
): Promise<{ accepted: boolean; conflict?: string }> {
  sweepExpired();

  // Deduplication
  if (await isOperationIdProcessed(payload.operationId)) {
    return { accepted: true };
  }

  // Validation
  try {
    const valid = await validate(payload);
    if (!valid) {
      return { accepted: false, conflict: 'validation_failed' };
    }
  } catch {
    return { accepted: false, conflict: 'validation_error' };
  }

  // Apply
  try {
    await apply(payload);
  } catch {
    return { accepted: false, conflict: 'apply_failed' };
  }

  // Mark processed
  processedOps.set(payload.operationId, { processedAt: Date.now() });
  return { accepted: true };
}
