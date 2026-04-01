/**
 * State Transition Guards
 * 状态迁移校验模块
 *
 * Defines valid state transition graphs for the highest-risk domain objects
 * (event pools and payments) and provides a helper to validate a proposed
 * transition before it is committed to the database.
 *
 * Design:
 *   - Each domain has a `VALID_TRANSITIONS` map: fromState → Set<allowedToStates>.
 *   - `assertValidTransition` throws a structured `InvalidTransitionError` on
 *     invalid transitions so route handlers can return a clean 409 response.
 *   - Transitions to the *same* state are idempotent no-ops and are allowed.
 *   - Null/undefined/empty-string `from` states are treated as "not yet set"
 *     and are always allowed (covers INSERT paths where the row doesn't exist
 *     yet). Unknown non-empty string `from` states are rejected (fail closed).
 *
 * Usage:
 *   import { assertValidTransition, InvalidTransitionError } from '../lib/stateTransitions';
 *
 *   // In a route handler:
 *   try {
 *     assertValidTransition('event_pool', currentPool.status, req.body.status);
 *   } catch (err) {
 *     if (err instanceof InvalidTransitionError) {
 *       return res.status(409).json({ message: err.message, code: 'INVALID_TRANSITION' });
 *     }
 *     throw err;
 *   }
 */

// ── Event pool statuses ────────────────────────────────────────────────────
// Schema: active | matching | matched | completed | cancelled
export type EventPoolStatus =
  | 'active'
  | 'matching'
  | 'matched'
  | 'completed'
  | 'cancelled';

/**
 * Valid forward transitions for an event pool.
 *
 * Key design decisions:
 *   - `active` → `matching` (admin triggers matching run)
 *   - `matching` → `matched` (matching completed successfully)
 *   - `matching` → `active` (matching failed / retry — roll back to open)
 *   - `matched` → `completed` (event happened)
 *   - `matched` → `cancelled` (event cancelled after matching)
 *   - `active` → `cancelled` (event cancelled before matching)
 *   - `completed` and `cancelled` are terminal: no further transitions allowed.
 */
export const EVENT_POOL_VALID_TRANSITIONS: Record<EventPoolStatus, ReadonlySet<EventPoolStatus>> = {
  active:     new Set<EventPoolStatus>(['active', 'matching', 'cancelled']),
  matching:   new Set<EventPoolStatus>(['matching', 'matched', 'active']),
  matched:    new Set<EventPoolStatus>(['matched', 'completed', 'cancelled']),
  completed:  new Set<EventPoolStatus>(['completed']),  // terminal
  cancelled:  new Set<EventPoolStatus>(['cancelled']),  // terminal
};

// ── Payment statuses ──────────────────────────────────────────────────────
// Schema: pending | completed | failed | refunded
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';

/**
 * Valid forward transitions for a payment record.
 *
 *   - `pending` → `completed` (webhook confirms success)
 *   - `pending` → `failed` (webhook reports failure)
 *   - `completed` → `refunded` (refund initiated)
 *   - `failed` is terminal (must create a new payment to retry)
 *   - `refunded` is terminal
 */
export const PAYMENT_VALID_TRANSITIONS: Record<PaymentStatus, ReadonlySet<PaymentStatus>> = {
  pending:   new Set<PaymentStatus>(['pending', 'completed', 'failed']),
  completed: new Set<PaymentStatus>(['completed', 'refunded']),
  failed:    new Set<PaymentStatus>(['failed']),   // terminal
  refunded:  new Set<PaymentStatus>(['refunded']), // terminal
};

// ── Generic types ─────────────────────────────────────────────────────────

export type TransitionDomain = 'event_pool' | 'payment';

const DOMAIN_TRANSITIONS: Record<
  TransitionDomain,
  Record<string, ReadonlySet<string>>
> = {
  event_pool: EVENT_POOL_VALID_TRANSITIONS as Record<string, ReadonlySet<string>>,
  payment:    PAYMENT_VALID_TRANSITIONS    as Record<string, ReadonlySet<string>>,
};

// ── Error type ────────────────────────────────────────────────────────────

export class InvalidTransitionError extends Error {
  constructor(
    public readonly domain: TransitionDomain,
    public readonly fromState: string,
    public readonly toState: string,
  ) {
    super(
      `Invalid state transition for ${domain}: '${fromState}' → '${toState}' is not allowed.`,
    );
    this.name = 'InvalidTransitionError';
  }
}

// ── Guard function ────────────────────────────────────────────────────────

/**
 * Assert that transitioning `domain` from `fromState` to `toState` is valid.
 *
 * - If `fromState` is `null` or `undefined` (new entity), the transition is
 *   always allowed.
 * - Throws `InvalidTransitionError` if the transition is forbidden.
 */
export function assertValidTransition(
  domain: TransitionDomain,
  fromState: string | null | undefined,
  toState: string,
): void {
  // No current state (new entity) — always valid.
  if (fromState == null || fromState === '') {
    return;
  }

  // Same state — idempotent, always valid.
  if (fromState === toState) {
    return;
  }

  const transitions = DOMAIN_TRANSITIONS[domain];
  const allowed = transitions[fromState];

  // Unknown from-state in the graph — fail closed to prevent silent bugs.
  if (!allowed) {
    throw new InvalidTransitionError(domain, fromState, toState);
  }

  if (!allowed.has(toState)) {
    throw new InvalidTransitionError(domain, fromState, toState);
  }
}

/**
 * Returns `true` if the transition is valid, `false` otherwise.
 * Use `assertValidTransition` for throwing behaviour in route handlers.
 */
export function isValidTransition(
  domain: TransitionDomain,
  fromState: string | null | undefined,
  toState: string,
): boolean {
  try {
    assertValidTransition(domain, fromState, toState);
    return true;
  } catch {
    return false;
  }
}
