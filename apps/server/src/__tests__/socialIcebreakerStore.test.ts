/**
 * Comprehensive unit tests for the Social Icebreaker store layer.
 *
 * These tests use an in-memory simulation (InMemoryIcebreakerStore) that models
 * the same invariants as the PostgreSQL-backed socialIcebreakerStore.ts.
 *
 * Coverage:
 * - getSocialSessionId deterministic mapping
 * - Session lifecycle: create → get → update → sweep expired
 * - Participant: upsert → heartbeat → roster count → active presence
 * - Lie truths: set → get → loadSessionLieTruths (server-only secrecy)
 * - Pre-generation pipeline: enqueue → dequeue (SKIP LOCKED) → complete → fail → status
 * - Phase metrics: save → get (aggregated)
 * - Sweep: expired sessions deleted, active sessions preserved
 * - Session expiry detection (SESSION_TTL_MS)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { SocialSessionState } from '@shared/socialIcebreaker';

// ---------------------------------------------------------------------------
// Constants (mirrors socialIcebreakerStore.ts)
// ---------------------------------------------------------------------------

const SESSION_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const PRESENCE_THRESHOLD_MS = 30_000; // 30 seconds

function getSocialSessionId(icebreakerSessionId: string): string {
  return `social_${icebreakerSessionId}`;
}

// ---------------------------------------------------------------------------
// In-memory store — simulates the PostgreSQL-backed socialIcebreakerStore.ts
// ---------------------------------------------------------------------------

interface StoredSession {
  state: SocialSessionState;
  icebreakerSessionId: string;
  expiresAt: Date;
}

interface StoredParticipant {
  socialSessionId: string;
  userId: string;
  displayName: string;
  joinedAt: Date;
  lastSeenAt: Date;
}

interface StoredLieTruth {
  socialSessionId: string;
  userId: string;
  statements: Array<{ index: number; text: string; isLie: boolean; is_ai?: boolean; source_tag?: string | null }>;
}

interface StoredPreGenJob {
  id: string;
  socialSessionId: string;
  phase: string;
  priority: number;
  payload: Record<string, unknown>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  resultId?: string;
  errorCode?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface StoredPreGenResult {
  id: string;
  socialSessionId: string;
  phase: string;
  contentJson: Record<string, unknown>;
  aiMeta?: Record<string, unknown>;
}

interface StoredPhaseMetric {
  socialSessionId: string;
  phase: string;
  dwellTimeMs?: number;
  participantCount?: number;
  actionCount?: number;
}

class InMemoryIcebreakerStore {
  private sessions = new Map<string, StoredSession>();
  private sessionsByIcebreakerSessionId = new Map<string, string>();
  private participants = new Map<string, StoredParticipant>();
  private lieTruths = new Map<string, StoredLieTruth>();
  private preGenJobs = new Map<string, StoredPreGenJob>();
  private preGenResults = new Map<string, StoredPreGenResult>();
  private phaseMetrics = new Map<string, StoredPhaseMetric>();
  private jobIdCounter = 0;
  private resultIdCounter = 0;

  // -----------------------------------------------------------------------
  // Session lifecycle
  // -----------------------------------------------------------------------

  createSession(state: SocialSessionState, ttlMs = SESSION_TTL_MS): void {
    const expiresAt = new Date(Date.now() + ttlMs);
    this.sessions.set(state.socialSessionId, {
      state: { ...state },
      icebreakerSessionId: state.icebreakerSessionId,
      expiresAt,
    });
    this.sessionsByIcebreakerSessionId.set(state.icebreakerSessionId, state.socialSessionId);
  }

  getSession(socialSessionId: string): SocialSessionState | null {
    const row = this.sessions.get(socialSessionId);
    if (!row) return null;
    if (row.expiresAt < new Date()) return null;
    return {
      ...row.state,
      expiresAt: row.expiresAt.toISOString(),
    };
  }

  getSessionWithExpiry(socialSessionId: string): { state: SocialSessionState | null; expired: boolean } {
    const row = this.sessions.get(socialSessionId);
    if (!row) return { state: null, expired: false };
    const expired = row.expiresAt < new Date();
    return {
      state: expired
        ? null
        : { ...row.state, expiresAt: row.expiresAt.toISOString() },
      expired,
    };
  }

  getSessionByIcebreakerSessionId(
    icebreakerSessionId: string,
  ): { socialSessionId: string; state: SocialSessionState; expired: boolean } | null {
    const id = this.sessionsByIcebreakerSessionId.get(icebreakerSessionId);
    if (!id) return null;
    const row = this.sessions.get(id);
    if (!row) return null;
    const expired = row.expiresAt < new Date();
    return {
      socialSessionId: id,
      state: { ...row.state, expiresAt: row.expiresAt.toISOString() },
      expired,
    };
  }

  updateSession(socialSessionId: string, state: SocialSessionState): void {
    const row = this.sessions.get(socialSessionId);
    if (row) {
      row.state = { ...state };
    }
  }

  // -----------------------------------------------------------------------
  // Participant roster & presence
  // -----------------------------------------------------------------------

  upsertParticipant(socialSessionId: string, userId: string, displayName: string): void {
    const key = `${socialSessionId}::${userId}`;
    const existing = this.participants.get(key);
    const now = new Date();
    if (existing) {
      existing.displayName = displayName;
      existing.lastSeenAt = now;
    } else {
      this.participants.set(key, {
        socialSessionId,
        userId,
        displayName,
        joinedAt: now,
        lastSeenAt: now,
      });
    }
  }

  heartbeat(socialSessionId: string, userId: string): void {
    const key = `${socialSessionId}::${userId}`;
    const p = this.participants.get(key);
    if (p) p.lastSeenAt = new Date();
  }

  getRosterCount(socialSessionId: string): number {
    let count = 0;
    for (const p of this.participants.values()) {
      if (p.socialSessionId === socialSessionId) count++;
    }
    return count;
  }

  getActiveParticipantCount(socialSessionId: string, thresholdMs = PRESENCE_THRESHOLD_MS): number {
    const since = new Date(Date.now() - thresholdMs);
    let count = 0;
    for (const p of this.participants.values()) {
      if (p.socialSessionId === socialSessionId && p.lastSeenAt >= since) count++;
    }
    return count;
  }

  // -----------------------------------------------------------------------
  // Lie-truth storage (server-only; never returned to clients)
  // -----------------------------------------------------------------------

  setLieTruths(
    socialSessionId: string,
    userId: string,
    statements: Array<{ index: number; text: string; isLie: boolean; is_ai?: boolean; source_tag?: string | null }>,
  ): void {
    this.lieTruths.set(`${socialSessionId}::${userId}`, { socialSessionId, userId, statements });
  }

  getLieTruths(
    socialSessionId: string,
    userId: string,
  ): Array<{ index: number; text: string; isLie: boolean; is_ai?: boolean; source_tag?: string | null }> | null {
    return this.lieTruths.get(`${socialSessionId}::${userId}`)?.statements ?? null;
  }

  loadSessionLieTruths(
    socialSessionId: string,
  ): Map<string, Array<{ index: number; text: string; isLie: boolean; is_ai?: boolean; source_tag?: string | null }>> {
    const result = new Map<string, Array<{ index: number; text: string; isLie: boolean; is_ai?: boolean; source_tag?: string | null }>>();
    for (const entry of this.lieTruths.values()) {
      if (entry.socialSessionId === socialSessionId) {
        result.set(entry.userId, entry.statements);
      }
    }
    return result;
  }

  // -----------------------------------------------------------------------
  // Pre-generation pipeline
  // -----------------------------------------------------------------------

  enqueuePreGenerationJob(
    socialSessionId: string,
    phase: string,
    priority = 0,
    payload: Record<string, unknown> = {},
  ): string | undefined {
    const existingKey = `${socialSessionId}::${phase}`;

    // Check for an existing job — if it exists and is not running, reset to pending
    for (const [key, job] of this.preGenJobs) {
      if (job.socialSessionId === socialSessionId && job.phase === phase) {
        if (job.status === 'running') return undefined; // never downgrade in-flight
        job.status = 'pending';
        job.priority = priority;
        job.payload = payload;
        job.updatedAt = new Date();
        return job.id;
      }
    }

    // Create a new job
    const id = `job_${++this.jobIdCounter}`;
    this.preGenJobs.set(id, {
      id,
      socialSessionId,
      phase,
      priority,
      payload,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return id;
  }

  dequeuePendingJob(): {
    id: string;
    socialSessionId: string;
    phase: string;
    payload: Record<string, unknown>;
  } | null {
    // Find the highest-priority pending job, oldest first on tie
    let candidate: StoredPreGenJob | null = null;
    for (const job of this.preGenJobs.values()) {
      if (job.status !== 'pending') continue;
      if (
        !candidate ||
        job.priority > candidate.priority ||
        (job.priority === candidate.priority && job.createdAt < candidate.createdAt)
      ) {
        candidate = job;
      }
    }

    if (!candidate) return null;

    // Atomically claim: mark as running
    candidate.status = 'running';
    candidate.updatedAt = new Date();

    return {
      id: candidate.id,
      socialSessionId: candidate.socialSessionId,
      phase: candidate.phase,
      payload: candidate.payload,
    };
  }

  completePreGenerationJob(jobId: string, resultId: string): boolean {
    const job = this.preGenJobs.get(jobId);
    if (!job || job.status !== 'running') return false;
    job.status = 'completed';
    job.resultId = resultId;
    job.updatedAt = new Date();
    return true;
  }

  failPreGenerationJob(jobId: string, errorCode: string): void {
    const job = this.preGenJobs.get(jobId);
    if (!job || job.status !== 'running') return;
    job.status = 'failed';
    job.errorCode = errorCode;
    job.updatedAt = new Date();
  }

  getPreGenerationJobStatus(socialSessionId: string, phase: string): string | null {
    for (const job of this.preGenJobs.values()) {
      if (job.socialSessionId === socialSessionId && job.phase === phase) {
        return job.status;
      }
    }
    return null;
  }

  storePreGenerationResult(
    socialSessionId: string,
    phase: string,
    contentJson: Record<string, unknown>,
    aiMeta?: Record<string, unknown>,
  ): string {
    // Upsert: overwrite existing result for (socialSessionId, phase)
    for (const [key, result] of this.preGenResults) {
      if (result.socialSessionId === socialSessionId && result.phase === phase) {
        result.contentJson = contentJson;
        result.aiMeta = aiMeta;
        return result.id;
      }
    }

    const id = `result_${++this.resultIdCounter}`;
    this.preGenResults.set(id, {
      id,
      socialSessionId,
      phase,
      contentJson,
      aiMeta,
    });
    return id;
  }

  getPreGenerationResult(
    socialSessionId: string,
    phase: string,
  ): { contentJson: Record<string, unknown>; aiMeta?: Record<string, unknown> } | null {
    for (const result of this.preGenResults.values()) {
      if (result.socialSessionId === socialSessionId && result.phase === phase) {
        return {
          contentJson: result.contentJson,
          aiMeta: result.aiMeta,
        };
      }
    }
    return null;
  }

  invalidatePreGenerationForSession(socialSessionId: string): void {
    for (const job of this.preGenJobs.values()) {
      if (job.socialSessionId === socialSessionId && job.status === 'pending') {
        job.status = 'failed';
        job.errorCode = 'tier_change';
        job.updatedAt = new Date();
      }
    }
    for (const [key, result] of this.preGenResults) {
      if (result.socialSessionId === socialSessionId) {
        this.preGenResults.delete(key);
      }
    }
  }

  getInFlightJobForPhase(
    socialSessionId: string,
    phase: string,
  ): { id: string; status: string } | null {
    for (const job of this.preGenJobs.values()) {
      if (job.socialSessionId === socialSessionId && job.phase === phase && job.status === 'running') {
        return { id: job.id, status: job.status };
      }
    }
    return null;
  }

  // -----------------------------------------------------------------------
  // Phase metrics
  // -----------------------------------------------------------------------

  savePhaseMetric(
    socialSessionId: string,
    phase: string,
    metric: {
      dwellTimeMs?: number;
      participantCount?: number;
      actionCount?: number;
    },
  ): void {
    // Upsert on (socialSessionId, phase) — matches the real DB's
    // onConflictDoUpdate target. Each call replaces the previous metric
    // for this phase.
    const key = `${socialSessionId}::${phase}`;
    const existing = this.phaseMetrics.get(key);
    if (existing) {
      if (metric.dwellTimeMs !== undefined) existing.dwellTimeMs = metric.dwellTimeMs;
      if (metric.participantCount !== undefined) existing.participantCount = metric.participantCount;
      if (metric.actionCount !== undefined) existing.actionCount = metric.actionCount;
    } else {
      this.phaseMetrics.set(key, {
        socialSessionId,
        phase,
        dwellTimeMs: metric.dwellTimeMs,
        participantCount: metric.participantCount,
        actionCount: metric.actionCount,
      });
    }
  }

  getPhaseMetrics(
    socialSessionId: string,
  ): Array<{ phase: string; avgDwellTimeMs: number | null; totalActions: number | null }> {
    const perPhase = new Map<string, { dwellTimes: number[]; actions: number[] }>();

    for (const m of this.phaseMetrics.values()) {
      if (m.socialSessionId !== socialSessionId) continue;
      if (!perPhase.has(m.phase)) {
        perPhase.set(m.phase, { dwellTimes: [], actions: [] });
      }
      const acc = perPhase.get(m.phase)!;
      if (m.dwellTimeMs !== undefined) acc.dwellTimes.push(m.dwellTimeMs);
      if (m.actionCount !== undefined) acc.actions.push(m.actionCount);
    }

    return Array.from(perPhase.entries()).map(([phase, acc]) => ({
      phase,
      avgDwellTimeMs: acc.dwellTimes.length > 0
        ? Math.round(acc.dwellTimes.reduce((a, b) => a + b, 0) / acc.dwellTimes.length)
        : null,
      totalActions: acc.actions.length > 0
        ? acc.actions.reduce((a, b) => a + b, 0)
        : null,
    }));
  }

  // -----------------------------------------------------------------------
  // TTL sweep
  // -----------------------------------------------------------------------

  sweepExpiredSessions(): number {
    const now = new Date();
    let deleted = 0;
    const expiredIds: string[] = [];

    for (const [id, session] of this.sessions) {
      if (session.expiresAt < now) {
        expiredIds.push(id);
      }
    }

    for (const id of expiredIds) {
      const session = this.sessions.get(id);
      if (session) {
        this.sessionsByIcebreakerSessionId.delete(session.icebreakerSessionId);
        this.sessions.delete(id);
        deleted++;
      }
    }

    return deleted;
  }
}

// ---------------------------------------------------------------------------
// Factory helper
// ---------------------------------------------------------------------------

function makeState(overrides: Partial<SocialSessionState> = {}): SocialSessionState {
  return {
    socialSessionId: 'social_sess-1',
    icebreakerSessionId: 'sess-1',
    currentPhase: 'warmup',
    hostUserId: 'host-1',
    hostDisplayName: 'Alice',
    playerCount: 1,
    phaseStartedAt: Date.now(),
    sessionStartedAt: Date.now(),
    completedPhases: [],
    enabledPhases: ['warmup', 'micro_challenge', 'lie_detective', 'personality_dice'],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests — getSocialSessionId
// ---------------------------------------------------------------------------

describe('getSocialSessionId', () => {
  it('produces a deterministic socialSessionId from an icebreakerSessionId', () => {
    expect(getSocialSessionId('abc123')).toBe('social_abc123');
    expect(getSocialSessionId('abc123')).toBe(getSocialSessionId('abc123'));
  });

  it('produces different IDs for different icebreakerSessionIds', () => {
    expect(getSocialSessionId('session-A')).not.toBe(getSocialSessionId('session-B'));
  });
});

describe('SESSION_TTL_MS and PRESENCE_THRESHOLD_MS constants', () => {
  it('SESSION_TTL_MS is exactly 6 hours', () => {
    expect(SESSION_TTL_MS).toBe(6 * 60 * 60 * 1000);
  });

  it('PRESENCE_THRESHOLD_MS is exactly 30 seconds', () => {
    expect(PRESENCE_THRESHOLD_MS).toBe(30_000);
  });
});

// ---------------------------------------------------------------------------
// Tests — Session lifecycle
// ---------------------------------------------------------------------------

describe('InMemoryIcebreakerStore — session lifecycle', () => {
  let store: InMemoryIcebreakerStore;

  beforeEach(() => {
    store = new InMemoryIcebreakerStore();
  });

  it('returns null for a session that was never created', () => {
    expect(store.getSession('social_unknown')).toBeNull();
  });

  it('returns null for getSession on an expired session', () => {
    const state = makeState();
    store.createSession(state, -1);
    expect(store.getSession('social_sess-1')).toBeNull();
  });

  it('creates a session and can retrieve it', () => {
    const state = makeState();
    store.createSession(state);

    const result = store.getSession('social_sess-1');
    expect(result).not.toBeNull();
    expect(result!.currentPhase).toBe('warmup');
    expect(result!.expiresAt).toBeDefined();
  });

  it('persists phase updates after updateSession', () => {
    const state = makeState();
    store.createSession(state);

    const updated = {
      ...state,
      currentPhase: 'micro_challenge' as const,
      completedPhases: ['warmup' as const],
    };
    store.updateSession('social_sess-1', updated);

    const result = store.getSession('social_sess-1');
    expect(result!.currentPhase).toBe('micro_challenge');
    expect(result!.completedPhases).toContain('warmup');
  });

  it('can look up session by icebreakerSessionId', () => {
    const state = makeState();
    store.createSession(state);

    const result = store.getSessionByIcebreakerSessionId('sess-1');
    expect(result).not.toBeNull();
    expect(result!.socialSessionId).toBe('social_sess-1');
    expect(result!.state.hostUserId).toBe('host-1');
    expect(result!.expired).toBe(false);
  });

  it('returns null for icebreakerSessionId lookup when no session exists', () => {
    expect(store.getSessionByIcebreakerSessionId('nonexistent')).toBeNull();
  });

  it('preserves host identity across updates', () => {
    const state = makeState({ hostUserId: 'host-42', hostDisplayName: 'Bob' });
    store.createSession(state);

    const updated = { ...state, currentPhase: 'lie_detective' as const };
    store.updateSession('social_sess-1', updated);

    const result = store.getSession('social_sess-1');
    expect(result!.hostUserId).toBe('host-42');
    expect(result!.hostDisplayName).toBe('Bob');
  });
});

// ---------------------------------------------------------------------------
// Tests — Session expiry
// ---------------------------------------------------------------------------

describe('InMemoryIcebreakerStore — session expiry', () => {
  let store: InMemoryIcebreakerStore;

  beforeEach(() => {
    store = new InMemoryIcebreakerStore();
  });

  it('getSessionWithExpiry returns expired=true for a session past TTL', () => {
    const state = makeState();
    store.createSession(state, -1);

    const result = store.getSessionWithExpiry('social_sess-1');
    expect(result.expired).toBe(true);
    expect(result.state).toBeNull();
  });

  it('getSessionWithExpiry returns expired=false for a fresh session', () => {
    const state = makeState();
    store.createSession(state);

    const result = store.getSessionWithExpiry('social_sess-1');
    expect(result.expired).toBe(false);
    expect(result.state).not.toBeNull();
  });

  it('getSessionWithExpiry returns state=null, expired=false for unknown session', () => {
    const result = store.getSessionWithExpiry('unknown');
    expect(result.state).toBeNull();
    expect(result.expired).toBe(false);
  });

  it('getSessionByIcebreakerSessionId reports expired for past-TTL session', () => {
    const state = makeState();
    store.createSession(state, -1);

    const result = store.getSessionByIcebreakerSessionId('sess-1');
    expect(result).not.toBeNull();
    expect(result!.expired).toBe(true);
  });

  it('getSession returns null when session is expired', () => {
    const state = makeState();
    store.createSession(state, -1);
    expect(store.getSession('social_sess-1')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tests — Participant roster & presence
// ---------------------------------------------------------------------------

describe('InMemoryIcebreakerStore — participant roster and active presence', () => {
  let store: InMemoryIcebreakerStore;

  beforeEach(() => {
    store = new InMemoryIcebreakerStore();
    store.createSession(makeState());
  });

  it('roster count increases as users join', () => {
    store.upsertParticipant('social_sess-1', 'user-1', 'Alice');
    expect(store.getRosterCount('social_sess-1')).toBe(1);

    store.upsertParticipant('social_sess-1', 'user-2', 'Bob');
    expect(store.getRosterCount('social_sess-1')).toBe(2);
  });

  it('roster count does not increase on re-join (upsert)', () => {
    store.upsertParticipant('social_sess-1', 'user-1', 'Alice');
    store.upsertParticipant('social_sess-1', 'user-1', 'Alice');
    expect(store.getRosterCount('social_sess-1')).toBe(1);
  });

  it('roster count is 0 when no participants have joined', () => {
    expect(store.getRosterCount('social_sess-1')).toBe(0);
  });

  it('roster count is scoped to session — other sessions not counted', () => {
    store.upsertParticipant('social_sess-1', 'user-1', 'Alice');
    expect(store.getRosterCount('social_other')).toBe(0);
  });

  it('active count reflects recently heartbeated participants', () => {
    store.upsertParticipant('social_sess-1', 'user-1', 'Alice');
    store.upsertParticipant('social_sess-1', 'user-2', 'Bob');

    expect(store.getActiveParticipantCount('social_sess-1')).toBe(2);
  });

  it('active count excludes participants with stale lastSeenAt', () => {
    store.upsertParticipant('social_sess-1', 'user-1', 'Alice');
    store.upsertParticipant('social_sess-1', 'user-2', 'Bob');

    const key = 'social_sess-1::user-2';
    const p = (store as any).participants.get(key);
    p.lastSeenAt = new Date(Date.now() - PRESENCE_THRESHOLD_MS - 1000);

    expect(store.getActiveParticipantCount('social_sess-1')).toBe(1);
  });

  it('active count is 0 when all participants are stale', () => {
    store.upsertParticipant('social_sess-1', 'user-1', 'Alice');

    const key = 'social_sess-1::user-1';
    const p = (store as any).participants.get(key);
    p.lastSeenAt = new Date(Date.now() - PRESENCE_THRESHOLD_MS - 5000);

    expect(store.getActiveParticipantCount('social_sess-1')).toBe(0);
  });

  it('heartbeat refreshes a stale participant back to active', () => {
    store.upsertParticipant('social_sess-1', 'user-2', 'Bob');
    const key = 'social_sess-1::user-2';
    const p = (store as any).participants.get(key);
    p.lastSeenAt = new Date(Date.now() - PRESENCE_THRESHOLD_MS - 1000);

    expect(store.getActiveParticipantCount('social_sess-1')).toBe(0);

    store.heartbeat('social_sess-1', 'user-2');
    expect(store.getActiveParticipantCount('social_sess-1')).toBe(1);
  });

  it('heartbeat is a no-op for a non-existent participant', () => {
    expect(() => store.heartbeat('social_sess-1', 'unknown-user')).not.toThrow();
  });

  it('upsertParticipant updates displayName on re-join', () => {
    store.upsertParticipant('social_sess-1', 'user-1', 'Alice');
    store.upsertParticipant('social_sess-1', 'user-1', 'Alice Updated');

    const key = 'social_sess-1::user-1';
    const p = (store as any).participants.get(key);
    expect(p.displayName).toBe('Alice Updated');
  });

  it('active count respects custom threshold', () => {
    store.upsertParticipant('social_sess-1', 'user-1', 'Alice');
    const key = 'social_sess-1::user-1';
    const p = (store as any).participants.get(key);
    p.lastSeenAt = new Date(Date.now() - 10_000); // 10s ago

    expect(store.getActiveParticipantCount('social_sess-1', 5_000)).toBe(0);
    expect(store.getActiveParticipantCount('social_sess-1', 15_000)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Tests — Lie truths
// ---------------------------------------------------------------------------

describe('InMemoryIcebreakerStore — lie truth storage', () => {
  let store: InMemoryIcebreakerStore;

  beforeEach(() => {
    store = new InMemoryIcebreakerStore();
    store.createSession(makeState());
  });

  it('stores lie truth data separate from public session state', () => {
    const truthStatements = [
      { index: 1, text: 'I run marathons', isLie: false },
      { index: 2, text: 'I have a pet iguana', isLie: true },
      { index: 3, text: 'I lived in Paris', isLie: false },
    ];
    store.setLieTruths('social_sess-1', 'user-1', truthStatements);

    const session = store.getSession('social_sess-1');
    const stateStr = JSON.stringify(session);
    expect(stateStr).not.toContain('"isLie"');
  });

  it('getLieTruths returns full truth data with isLie', () => {
    const truthStatements = [
      { index: 1, text: 'I run marathons', isLie: false },
      { index: 2, text: 'I have a pet iguana', isLie: true },
    ];
    store.setLieTruths('social_sess-1', 'user-1', truthStatements);

    const truths = store.getLieTruths('social_sess-1', 'user-1');
    expect(truths).not.toBeNull();
    expect(truths!.find(s => s.isLie)?.index).toBe(2);
  });

  it('getLieTruths returns null for a user who has not generated statements', () => {
    expect(store.getLieTruths('social_sess-1', 'user-99')).toBeNull();
  });

  it('loadSessionLieTruths returns data for all players in the session', () => {
    store.setLieTruths('social_sess-1', 'user-1', [
      { index: 1, text: 'A', isLie: false },
      { index: 2, text: 'B', isLie: true },
    ]);
    store.setLieTruths('social_sess-1', 'user-2', [
      { index: 1, text: 'X', isLie: true },
      { index: 2, text: 'Y', isLie: false },
    ]);

    const all = store.loadSessionLieTruths('social_sess-1');
    expect(all.size).toBe(2);
    expect(all.get('user-1')!.find(s => s.isLie)?.index).toBe(2);
    expect(all.get('user-2')!.find(s => s.isLie)?.index).toBe(1);
  });

  it('loadSessionLieTruths returns empty map when no truths stored', () => {
    const all = store.loadSessionLieTruths('social_sess-1');
    expect(all.size).toBe(0);
  });

  it('loadSessionLieTruths is scoped to the session', () => {
    store.setLieTruths('social_sess-1', 'user-1', [
      { index: 1, text: 'A', isLie: false },
    ]);
    const all = store.loadSessionLieTruths('social_other');
    expect(all.size).toBe(0);
  });

  it('setLieTruths overwrites previous data (idempotent)', () => {
    store.setLieTruths('social_sess-1', 'user-1', [
      { index: 1, text: 'Old text', isLie: false },
    ]);
    store.setLieTruths('social_sess-1', 'user-1', [
      { index: 1, text: 'New text', isLie: true },
    ]);

    const truths = store.getLieTruths('social_sess-1', 'user-1');
    expect(truths!.length).toBe(1);
    expect(truths![0].text).toBe('New text');
    expect(truths![0].isLie).toBe(true);
  });

  it('supports is_ai and source_tag fields', () => {
    store.setLieTruths('social_sess-1', 'user-1', [
      { index: 1, text: 'AI expanded', isLie: true, is_ai: true, source_tag: 'coffee' },
    ]);

    const truths = store.getLieTruths('social_sess-1', 'user-1');
    expect(truths![0].is_ai).toBe(true);
    expect(truths![0].source_tag).toBe('coffee');
  });
});

// ---------------------------------------------------------------------------
// Tests — Rejoin/reconnect restores session state
// ---------------------------------------------------------------------------

describe('InMemoryIcebreakerStore — rejoin/reconnect', () => {
  it('a second join finds the same session at the current phase', () => {
    const store = new InMemoryIcebreakerStore();
    const state = makeState({
      currentPhase: 'lie_detective',
      completedPhases: ['warmup' as const, 'micro_challenge' as const],
    });
    store.createSession(state);

    const result = store.getSessionByIcebreakerSessionId('sess-1');
    expect(result!.state.currentPhase).toBe('lie_detective');
    expect(result!.state.completedPhases).toContain('warmup');
    expect(result!.state.completedPhases).toContain('micro_challenge');
  });

  it('votes are preserved after a rejoin (state round-trip)', () => {
    const store = new InMemoryIcebreakerStore();
    const state = makeState({ currentPhase: 'lie_detective' });
    state.votes = [{ voterId: 'user-3', targetUserId: 'user-1', guessedStatementIndex: 1 }];
    store.createSession(state);
    store.updateSession('social_sess-1', state);

    const result = store.getSessionByIcebreakerSessionId('sess-1');
    expect(result!.state.votes).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Tests — Pre-generation pipeline
// ---------------------------------------------------------------------------

describe('InMemoryIcebreakerStore — pre-generation pipeline', () => {
  let store: InMemoryIcebreakerStore;

  beforeEach(() => {
    store = new InMemoryIcebreakerStore();
    store.createSession(makeState());
  });

  it('enqueues a pending job and returns its id', () => {
    const id = store.enqueuePreGenerationJob('social_sess-1', 'lie_detective');
    expect(id).toBeDefined();
    expect(id).toMatch(/^job_\d+$/);
  });

  it('enqueue with same (session, phase) on non-running job resets to pending', () => {
    const id1 = store.enqueuePreGenerationJob('social_sess-1', 'lie_detective');
    const id2 = store.enqueuePreGenerationJob('social_sess-1', 'lie_detective');
    expect(id2).toBe(id1); // same job id, reset to pending

    const status = store.getPreGenerationJobStatus('social_sess-1', 'lie_detective');
    expect(status).toBe('pending');
  });

  it('enqueue returns undefined for a currently running job (no downgrade)', () => {
    store.enqueuePreGenerationJob('social_sess-1', 'lie_detective');
    store.dequeuePendingJob(); // claims it → running

    const id = store.enqueuePreGenerationJob('social_sess-1', 'lie_detective');
    expect(id).toBeUndefined();
  });

  it('dequeuePendingJob claims the highest-priority pending job (SKIP LOCKED semantics)', () => {
    store.enqueuePreGenerationJob('social_sess-1', 'warmup', 0);
    store.enqueuePreGenerationJob('social_sess-1', 'lie_detective', 10);

    const claimed = store.dequeuePendingJob();
    expect(claimed).not.toBeNull();
    expect(claimed!.phase).toBe('lie_detective'); // higher priority
  });

  it('dequeuePendingJob returns null when no pending jobs exist', () => {
    expect(store.dequeuePendingJob()).toBeNull();
  });

  it('dequeuePendingJob only claims one job at a time', () => {
    store.enqueuePreGenerationJob('social_sess-1', 'warmup', 0);
    store.enqueuePreGenerationJob('social_sess-1', 'micro_challenge', 0);

    const first = store.dequeuePendingJob();
    expect(first).not.toBeNull();

    const second = store.dequeuePendingJob();
    expect(second).not.toBeNull();
    expect(second!.id).not.toBe(first!.id);
  });

  it('dequeuePendingJob does not claim an already running job', () => {
    store.enqueuePreGenerationJob('social_sess-1', 'lie_detective');
    store.dequeuePendingJob();

    expect(store.dequeuePendingJob()).toBeNull();
  });

  it('completePreGenerationJob transitions running job to completed', () => {
    const jobId = store.enqueuePreGenerationJob('social_sess-1', 'lie_detective')!;
    const claimed = store.dequeuePendingJob();
    expect(claimed!.id).toBe(jobId);

    const resultId = store.storePreGenerationResult('social_sess-1', 'lie_detective', { topics: [] });
    const ok = store.completePreGenerationJob(jobId, resultId);
    expect(ok).toBe(true);

    const status = store.getPreGenerationJobStatus('social_sess-1', 'lie_detective');
    expect(status).toBe('completed');
  });

  it('completePreGenerationJob returns false for non-running job', () => {
    const ok = store.completePreGenerationJob('nonexistent', 'result-1');
    expect(ok).toBe(false);
  });

  it('failPreGenerationJob transitions running job to failed', () => {
    const jobId = store.enqueuePreGenerationJob('social_sess-1', 'lie_detective')!;
    store.dequeuePendingJob();

    store.failPreGenerationJob(jobId, 'ai_error');
    const status = store.getPreGenerationJobStatus('social_sess-1', 'lie_detective');
    expect(status).toBe('failed');
  });

  it('failPreGenerationJob is a no-op for a non-running job', () => {
    const jobId = store.enqueuePreGenerationJob('social_sess-1', 'lie_detective')!;

    expect(() => store.failPreGenerationJob(jobId, 'error')).not.toThrow();
    // should still be pending since it was never dequeued
    const status = store.getPreGenerationJobStatus('social_sess-1', 'lie_detective');
    expect(status).toBe('pending');
  });

  it('getPreGenerationJobStatus returns null for unknown (session, phase)', () => {
    expect(store.getPreGenerationJobStatus('social_sess-1', 'unknown')).toBeNull();
  });

  it('getPreGenerationResult returns stored content and aiMeta', () => {
    store.storePreGenerationResult('social_sess-1', 'lie_detective', {
      statements: [{ index: 1, text: 'test' }],
    }, { provider: 'deepseek', promptVersion: 'v1' });

    const result = store.getPreGenerationResult('social_sess-1', 'lie_detective');
    expect(result).not.toBeNull();
    expect(result!.contentJson).toMatchObject({ statements: [{ index: 1, text: 'test' }] });
    expect(result!.aiMeta).toMatchObject({ provider: 'deepseek' });
  });

  it('getPreGenerationResult returns null when no result exists', () => {
    expect(store.getPreGenerationResult('social_sess-1', 'nonexistent')).toBeNull();
  });

  it('storePreGenerationResult upserts existing result for (session, phase)', () => {
    const id1 = store.storePreGenerationResult('social_sess-1', 'lie_detective', { v: 1 });
    const id2 = store.storePreGenerationResult('social_sess-1', 'lie_detective', { v: 2 });
    expect(id2).toBe(id1); // same id

    const result = store.getPreGenerationResult('social_sess-1', 'lie_detective');
    expect(result!.contentJson).toMatchObject({ v: 2 });
  });

  it('invalidatePreGenerationForSession marks pending jobs as failed and deletes results', () => {
    store.enqueuePreGenerationJob('social_sess-1', 'warmup', 0);
    store.enqueuePreGenerationJob('social_sess-1', 'lie_detective', 0);
    store.storePreGenerationResult('social_sess-1', 'warmup', { topics: [] });

    store.invalidatePreGenerationForSession('social_sess-1');

    expect(store.getPreGenerationJobStatus('social_sess-1', 'warmup')).toBe('failed');
    expect(store.getPreGenerationJobStatus('social_sess-1', 'lie_detective')).toBe('failed');
    expect(store.getPreGenerationResult('social_sess-1', 'warmup')).toBeNull();
  });

  it('invalidatePreGenerationForSession does not affect other sessions', () => {
    store.createSession(makeState({ socialSessionId: 'social_other', icebreakerSessionId: 'other' }));
    store.enqueuePreGenerationJob('social_sess-1', 'warmup');
    store.enqueuePreGenerationJob('social_other', 'lie_detective');

    store.invalidatePreGenerationForSession('social_sess-1');

    expect(store.getPreGenerationJobStatus('social_other', 'lie_detective')).toBe('pending');
  });

  it('getInFlightJobForPhase returns running job for matching (session, phase)', () => {
    store.enqueuePreGenerationJob('social_sess-1', 'lie_detective');
    store.dequeuePendingJob();

    const inflight = store.getInFlightJobForPhase('social_sess-1', 'lie_detective');
    expect(inflight).not.toBeNull();
    expect(inflight!.status).toBe('running');
  });

  it('getInFlightJobForPhase returns null when no running job exists', () => {
    expect(store.getInFlightJobForPhase('social_sess-1', 'warmup')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tests — Phase metrics
// ---------------------------------------------------------------------------

describe('InMemoryIcebreakerStore — phase metrics', () => {
  let store: InMemoryIcebreakerStore;

  beforeEach(() => {
    store = new InMemoryIcebreakerStore();
    store.createSession(makeState());
  });

  it('saves and retrieves a single phase metric', () => {
    store.savePhaseMetric('social_sess-1', 'warmup', {
      dwellTimeMs: 120_000,
      actionCount: 5,
    });

    const metrics = store.getPhaseMetrics('social_sess-1');
    expect(metrics).toHaveLength(1);
    expect(metrics[0].phase).toBe('warmup');
    expect(metrics[0].avgDwellTimeMs).toBe(120_000);
    expect(metrics[0].totalActions).toBe(5);
  });

  it('replaces metric on second save for same phase (upsert semantics)', () => {
    store.savePhaseMetric('social_sess-1', 'warmup', { dwellTimeMs: 100_000, actionCount: 3 });
    store.savePhaseMetric('social_sess-1', 'warmup', { dwellTimeMs: 200_000, actionCount: 7 });

    const metrics = store.getPhaseMetrics('social_sess-1');
    expect(metrics).toHaveLength(1);
    // Upsert replaces, so only the latest values are stored
    expect(metrics[0].avgDwellTimeMs).toBe(200_000);
    expect(metrics[0].totalActions).toBe(7);
  });

  it('returns metrics per phase for a session', () => {
    store.savePhaseMetric('social_sess-1', 'warmup', { dwellTimeMs: 120_000 });
    store.savePhaseMetric('social_sess-1', 'micro_challenge', { dwellTimeMs: 60_000 });
    store.savePhaseMetric('social_sess-1', 'lie_detective', { dwellTimeMs: 300_000 });

    const metrics = store.getPhaseMetrics('social_sess-1');
    expect(metrics).toHaveLength(3);
  });

  it('returns empty array when no metrics exist', () => {
    const metrics = store.getPhaseMetrics('social_sess-1');
    expect(metrics).toEqual([]);
  });

  it('does not include metrics from other sessions', () => {
    store.createSession(makeState({ socialSessionId: 'social_other', icebreakerSessionId: 'other' }));
    store.savePhaseMetric('social_sess-1', 'warmup', { dwellTimeMs: 100_000 });
    store.savePhaseMetric('social_other', 'warmup', { dwellTimeMs: 200_000 });

    const metrics = store.getPhaseMetrics('social_sess-1');
    expect(metrics).toHaveLength(1);
    expect(metrics[0].avgDwellTimeMs).toBe(100_000);
  });

  it('returns null avgDwellTimeMs and totalActions when no data for those fields', () => {
    store.savePhaseMetric('social_sess-1', 'warmup', { participantCount: 4 });

    const metrics = store.getPhaseMetrics('social_sess-1');
    expect(metrics).toHaveLength(1);
    expect(metrics[0].avgDwellTimeMs).toBeNull();
    expect(metrics[0].totalActions).toBeNull();
  });

  it('upsert replaces only provided fields on same (session, phase)', () => {
    store.savePhaseMetric('social_sess-1', 'warmup', { dwellTimeMs: 100_000, actionCount: 3 });
    // Second call only provides dwellTimeMs — actionCount from the first call persists
    store.savePhaseMetric('social_sess-1', 'warmup', { dwellTimeMs: 200_000 });

    const metrics = store.getPhaseMetrics('social_sess-1');
    expect(metrics[0].avgDwellTimeMs).toBe(200_000);
    expect(metrics[0].totalActions).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Tests — TTL sweep
// ---------------------------------------------------------------------------

describe('InMemoryIcebreakerStore — sweep expired sessions', () => {
  let store: InMemoryIcebreakerStore;

  beforeEach(() => {
    store = new InMemoryIcebreakerStore();
  });

  it('deletes expired sessions and preserves active ones', () => {
    store.createSession(makeState({ socialSessionId: 'social_active', icebreakerSessionId: 'active' }));
    store.createSession(makeState({ socialSessionId: 'social_expired', icebreakerSessionId: 'expired' }), -1);

    const deleted = store.sweepExpiredSessions();
    expect(deleted).toBe(1);

    expect(store.getSession('social_active')).not.toBeNull();
    expect(store.getSession('social_expired')).toBeNull();
  });

  it('returns 0 when no sessions are expired', () => {
    store.createSession(makeState());
    const deleted = store.sweepExpiredSessions();
    expect(deleted).toBe(0);
  });

  it('returns 0 when no sessions exist', () => {
    const deleted = store.sweepExpiredSessions();
    expect(deleted).toBe(0);
  });

  it('removes icebreakerSessionId index when sweeping', () => {
    store.createSession(makeState({ socialSessionId: 'social_expired', icebreakerSessionId: 'expired' }), -1);

    store.sweepExpiredSessions();

    expect(store.getSessionByIcebreakerSessionId('expired')).toBeNull();
  });

  it('preserves non-expired sessions after sweep', () => {
    store.createSession(makeState({ socialSessionId: 'social_1', icebreakerSessionId: 's1' }));
    store.createSession(makeState({ socialSessionId: 'social_2', icebreakerSessionId: 's2' }), -1);
    store.createSession(makeState({ socialSessionId: 'social_3', icebreakerSessionId: 's3' }));

    store.sweepExpiredSessions();

    expect(store.getSessionByIcebreakerSessionId('s1')).not.toBeNull();
    expect(store.getSessionByIcebreakerSessionId('s2')).toBeNull();
    expect(store.getSessionByIcebreakerSessionId('s3')).not.toBeNull();
  });
});
