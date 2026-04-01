/**
 * Unit tests for stateTransitions.ts
 */

import { describe, it, expect } from 'vitest';
import {
  assertValidTransition,
  isValidTransition,
  InvalidTransitionError,
  EVENT_POOL_VALID_TRANSITIONS,
  PAYMENT_VALID_TRANSITIONS,
} from '../lib/stateTransitions';

describe('assertValidTransition — event_pool', () => {
  it('allows active → matching', () => {
    expect(() => assertValidTransition('event_pool', 'active', 'matching')).not.toThrow();
  });

  it('allows active → cancelled', () => {
    expect(() => assertValidTransition('event_pool', 'active', 'cancelled')).not.toThrow();
  });

  it('allows matching → matched', () => {
    expect(() => assertValidTransition('event_pool', 'matching', 'matched')).not.toThrow();
  });

  it('allows matching → active (retry)', () => {
    expect(() => assertValidTransition('event_pool', 'matching', 'active')).not.toThrow();
  });

  it('allows matched → completed', () => {
    expect(() => assertValidTransition('event_pool', 'matched', 'completed')).not.toThrow();
  });

  it('allows matched → cancelled', () => {
    expect(() => assertValidTransition('event_pool', 'matched', 'cancelled')).not.toThrow();
  });

  it('rejects completed → active (terminal state)', () => {
    expect(() => assertValidTransition('event_pool', 'completed', 'active')).toThrow(
      InvalidTransitionError,
    );
  });

  it('rejects completed → cancelled (terminal state)', () => {
    expect(() => assertValidTransition('event_pool', 'completed', 'cancelled')).toThrow(
      InvalidTransitionError,
    );
  });

  it('rejects cancelled → active (terminal state)', () => {
    expect(() => assertValidTransition('event_pool', 'cancelled', 'active')).toThrow(
      InvalidTransitionError,
    );
  });

  it('rejects active → completed (skipping states)', () => {
    expect(() => assertValidTransition('event_pool', 'active', 'completed')).toThrow(
      InvalidTransitionError,
    );
  });

  it('allows same-state (idempotent)', () => {
    expect(() => assertValidTransition('event_pool', 'active', 'active')).not.toThrow();
    expect(() => assertValidTransition('event_pool', 'completed', 'completed')).not.toThrow();
  });

  it('allows null fromState (new entity)', () => {
    expect(() => assertValidTransition('event_pool', null, 'active')).not.toThrow();
  });

  it('allows undefined fromState (new entity)', () => {
    expect(() => assertValidTransition('event_pool', undefined, 'active')).not.toThrow();
  });

  it('rejects unknown fromState', () => {
    expect(() => assertValidTransition('event_pool', 'unknown_state', 'active')).toThrow(
      InvalidTransitionError,
    );
  });

  it('InvalidTransitionError carries correct fields', () => {
    let caught: InvalidTransitionError | undefined;
    try {
      assertValidTransition('event_pool', 'completed', 'active');
    } catch (err) {
      caught = err as InvalidTransitionError;
    }
    expect(caught).toBeInstanceOf(InvalidTransitionError);
    expect(caught?.domain).toBe('event_pool');
    expect(caught?.fromState).toBe('completed');
    expect(caught?.toState).toBe('active');
    expect(caught?.message).toContain('event_pool');
    expect(caught?.message).toContain('completed');
    expect(caught?.message).toContain('active');
  });
});

describe('assertValidTransition — payment', () => {
  it('allows pending → completed', () => {
    expect(() => assertValidTransition('payment', 'pending', 'completed')).not.toThrow();
  });

  it('allows pending → failed', () => {
    expect(() => assertValidTransition('payment', 'pending', 'failed')).not.toThrow();
  });

  it('allows completed → refunded', () => {
    expect(() => assertValidTransition('payment', 'completed', 'refunded')).not.toThrow();
  });

  it('rejects failed → completed (terminal)', () => {
    expect(() => assertValidTransition('payment', 'failed', 'completed')).toThrow(
      InvalidTransitionError,
    );
  });

  it('rejects refunded → pending (terminal)', () => {
    expect(() => assertValidTransition('payment', 'refunded', 'pending')).toThrow(
      InvalidTransitionError,
    );
  });

  it('rejects pending → refunded (must go via completed)', () => {
    expect(() => assertValidTransition('payment', 'pending', 'refunded')).toThrow(
      InvalidTransitionError,
    );
  });
});

describe('isValidTransition', () => {
  it('returns true for valid transitions', () => {
    expect(isValidTransition('event_pool', 'active', 'matching')).toBe(true);
    expect(isValidTransition('payment', 'completed', 'refunded')).toBe(true);
  });

  it('returns false for invalid transitions', () => {
    expect(isValidTransition('event_pool', 'completed', 'active')).toBe(false);
    expect(isValidTransition('payment', 'failed', 'completed')).toBe(false);
  });

  it('returns true for null fromState', () => {
    expect(isValidTransition('event_pool', null, 'active')).toBe(true);
  });
});

describe('EVENT_POOL_VALID_TRANSITIONS completeness', () => {
  it('every status has an entry in the map', () => {
    const statuses = ['active', 'matching', 'matched', 'completed', 'cancelled'] as const;
    for (const s of statuses) {
      expect(EVENT_POOL_VALID_TRANSITIONS[s]).toBeDefined();
    }
  });
});

describe('PAYMENT_VALID_TRANSITIONS completeness', () => {
  it('every status has an entry in the map', () => {
    const statuses = ['pending', 'completed', 'failed', 'refunded'] as const;
    for (const s of statuses) {
      expect(PAYMENT_VALID_TRANSITIONS[s]).toBeDefined();
    }
  });
});
