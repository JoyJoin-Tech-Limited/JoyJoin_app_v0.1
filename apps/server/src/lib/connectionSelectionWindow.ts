/**
 * Connection selection window (G0, 2026-11-10 — 24h 互选闭环).
 *
 * Canonical, timezone-independent derivation of a table's selection timings.
 * Every consumer (POST /feedback cap+gate, PUT /connection-selection,
 * GET /feedback-state, the shell's `pendingReveal`, the reveal sweep) reads
 * the window from here — the client only renders the ISO instants this
 * module produces. No device clock, no ambient `TZ`, no `Intl`/ICU.
 *
 * Anchors (docs/strategy/2026-11-10-icebreaker-commercial-execution-plan.md
 * §3.2, v1.1):
 *
 *   opensAt  = eventStart + 3h          (same instant feedback opens:
 *                                        POOL_COMPLETION_BUFFER_MS)
 *   revealAt = the next 21:00 Asia/Shanghai at-or-after eventStart + 24h
 *   closesAt = revealAt                 (one deadline, not two)
 *
 * "At-or-after": an event that starts exactly at 21:00 Asia/Shanghai would
 * otherwise jump a whole extra day (its +24h anchor already lands on 21:00),
 * which delays every such table's reveal for no product reason. The reveal is
 * therefore never earlier than `eventStart + 24h`, and never later than
 * `eventStart + 48h`.
 *
 * Both instants are true UTC `Date` objects. `events.date_time` /
 * `event_pools.date_time` are `timestamp without time zone` holding a UTC
 * wall clock (see `lib/eventDateTime.ts`), so plain epoch arithmetic is exact.
 * `Asia/Shanghai` has been fixed at UTC+8 with no DST since 1991, which is why
 * a constant offset is used instead of a tz database lookup.
 */

import { BUSINESS_TIMEZONE_OFFSET_MINUTES } from "./eventDateTime";

const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;

const BUSINESS_TZ_OFFSET_MS = BUSINESS_TIMEZONE_OFFSET_MINUTES * MS_PER_MINUTE;

/** Feedback / selection open: event start + 3h (matches the feedback gate). */
export const SELECTION_OPEN_OFFSET_MS = 3 * MS_PER_HOUR;

/** Earliest possible reveal: event start + 24h (rounded up to 21:00 local). */
export const SELECTION_REVEAL_ANCHOR_OFFSET_MS = 24 * MS_PER_HOUR;

/** Business-local reveal hour — 21:00 Asia/Shanghai. */
export const SELECTION_REVEAL_LOCAL_HOUR = 21;

/**
 * Server-side selection cap. A six-seat table has five peers, so the cap can
 * never reject a legitimate table; it exists so a malformed/hostile payload
 * cannot fan out N connection rows.
 */
export const MAX_CONNECTION_SELECTIONS = 5;

export type ConnectionSelectionWindowState = "not_open" | "open" | "closed";

export interface ConnectionSelectionWindow {
  /** Selection + feedback open instant (UTC). */
  opensAt: Date;
  /** Selection deadline == reveal instant (UTC). */
  closesAt: Date;
  /** Table-wide reveal instant (UTC). */
  revealAt: Date;
  state: ConnectionSelectionWindowState;
}

/**
 * Round a UTC instant up to the next 21:00 Asia/Shanghai at-or-after it.
 * Pure integer arithmetic: shift into the business wall clock, snap to the
 * local day boundary, then shift back.
 */
export function nextBusinessRevealInstant(anchor: Date): Date {
  const anchorLocalMs = anchor.getTime() + BUSINESS_TZ_OFFSET_MS;
  const localMidnightMs = Math.floor(anchorLocalMs / MS_PER_DAY) * MS_PER_DAY;
  let revealLocalMs = localMidnightMs + SELECTION_REVEAL_LOCAL_HOUR * MS_PER_HOUR;
  while (revealLocalMs < anchorLocalMs) {
    revealLocalMs += MS_PER_DAY;
  }
  return new Date(revealLocalMs - BUSINESS_TZ_OFFSET_MS);
}

function toValidDate(value: Date | string | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  const ms = parsed.getTime();
  if (!Number.isFinite(ms)) return null;
  return parsed;
}

function isValidDate(value: unknown): value is Date {
  return value instanceof Date && Number.isFinite(value.getTime());
}

/**
 * Derive one event's selection window.
 *
 * Returns `null` when the event start is missing or unparseable — the plan
 * forbids a client-visible fallback ("缺少 eventStart 时仅允许运营后台覆盖，
 * 不给客户端 fallback"). Callers map that to a coded error, never to a
 * guessed window. `now` is injectable so tests are clock-free.
 */
export function computeConnectionSelectionWindow(
  eventStart: Date | string | null | undefined,
  now: Date = new Date(),
): ConnectionSelectionWindow | null {
  const start = toValidDate(eventStart);
  const referenceNow = toValidDate(now);
  if (!start || !referenceNow) return null;

  const opensAt = new Date(start.getTime() + SELECTION_OPEN_OFFSET_MS);
  const revealAt = nextBusinessRevealInstant(
    new Date(start.getTime() + SELECTION_REVEAL_ANCHOR_OFFSET_MS),
  );

  return {
    opensAt,
    closesAt: revealAt,
    revealAt,
    state: connectionSelectionStateAt(opensAt, revealAt, referenceNow),
  };
}

/**
 * State for an explicit window (the ops-override path reads its instants from
 * `connection_selection_windows`, so it cannot go through the derivation).
 *
 * Fail-closed: a non-Date input (a partial row, a driver returning strings)
 * resolves to `closed` rather than throwing — the window lookup sits on the
 * feedback write path, and a thrown TypeError there would 500 a submission
 * that has nothing to do with selection.
 */
export function connectionSelectionStateAt(
  opensAt: Date,
  closesAt: Date,
  now: Date,
): ConnectionSelectionWindowState {
  if (!isValidDate(opensAt) || !isValidDate(closesAt) || !isValidDate(now)) {
    return "closed";
  }
  if (now.getTime() < opensAt.getTime()) return "not_open";
  if (now.getTime() < closesAt.getTime()) return "open";
  return "closed";
}

/**
 * Client-facing projection of one viewer's selection state inside a window.
 * `closesAt === revealAt` by construction, so `revealed` is simply the closed
 * state expressed explicitly for the client's 已揭晓 branch.
 *
 * `selectedUserIds` is the caller's OWN outgoing selection (the set they may
 * prefill an edit from). It is never the peer-facing list: a row whose
 * initiator is somebody else and which never became mutual is absent, so the
 * field cannot reveal "who picked me". No WeChat id, name or archetype rides
 * along — ids only, exactly the values the PUT/POST selection payload accepts.
 * `selectedCount` is derived from it so the two can never disagree.
 */
export interface ConnectionSelectionSummary {
  state: ConnectionSelectionWindowState;
  revealed: boolean;
  opensAt: string;
  closesAt: string;
  revealAt: string;
  maxSelections: number;
  selectedCount: number;
  selectedUserIds: string[];
}

export function buildConnectionSelectionSummary(
  window: ConnectionSelectionWindow,
  /** The caller's own selected peer ids (0–5). Count is derived, never passed. */
  ownSelectedPeerIds: readonly string[] = [],
): ConnectionSelectionSummary {
  const selectedUserIds = [...new Set(ownSelectedPeerIds.filter((id) => typeof id === 'string' && id.length > 0))];
  return {
    state: window.state,
    revealed: window.state === "closed",
    opensAt: window.opensAt.toISOString(),
    closesAt: window.closesAt.toISOString(),
    revealAt: window.revealAt.toISOString(),
    maxSelections: MAX_CONNECTION_SELECTIONS,
    selectedCount: selectedUserIds.length,
    selectedUserIds,
  };
}
