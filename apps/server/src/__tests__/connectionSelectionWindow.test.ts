import { describe, expect, it } from 'vitest';
import {
  MAX_CONNECTION_SELECTIONS,
  SELECTION_OPEN_OFFSET_MS,
  buildConnectionSelectionSummary,
  computeConnectionSelectionWindow,
  connectionSelectionStateAt,
  nextBusinessRevealInstant,
} from '../lib/connectionSelectionWindow';

/**
 * G0 (2026-11-10) — connection selection window helper.
 *
 * Anchors (plan §3.2):
 *   opensAt  = eventStart + 3h
 *   revealAt = next 21:00 Asia/Shanghai at-or-after eventStart + 24h
 *   closesAt = revealAt
 *
 * Every expected value is a hard-coded UTC ISO string, which is the real
 * guarantee: the helper uses UTC getters only, so the host `TZ` cannot change
 * the answer.
 */

const HOUR_MS = 60 * 60 * 1000;

/** Start 19:00 Asia/Shanghai (11:00Z) — the common table slot. */
const EVENING_START = new Date('2026-11-10T11:00:00.000Z');

describe('computeConnectionSelectionWindow', () => {
  it('opens at event start + 3h', () => {
    const window = computeConnectionSelectionWindow(EVENING_START, new Date('2026-11-10T12:00:00.000Z'));

    expect(window?.opensAt.toISOString()).toBe('2026-11-10T14:00:00.000Z');
    expect(SELECTION_OPEN_OFFSET_MS).toBe(3 * HOUR_MS);
  });

  it('reveals at the next 21:00 Asia/Shanghai after start + 24h', () => {
    const window = computeConnectionSelectionWindow(EVENING_START, new Date('2026-11-10T12:00:00.000Z'));

    // start + 24h = 2026-11-11T11:00Z (19:00 local) → next 21:00 local = 13:00Z.
    expect(window?.revealAt.toISOString()).toBe('2026-11-11T13:00:00.000Z');
  });

  it('keeps closesAt === revealAt (one deadline, not two)', () => {
    const window = computeConnectionSelectionWindow(EVENING_START, new Date('2026-11-10T12:00:00.000Z'));

    expect(window?.closesAt.getTime()).toBe(window?.revealAt.getTime());
  });

  it('never reveals earlier than start + 24h nor later than start + 48h', () => {
    const starts = [
      '2026-11-10T00:30:00.000Z',
      '2026-11-10T02:00:00.000Z',
      '2026-11-10T11:00:00.000Z',
      '2026-11-10T13:00:00.000Z',
      '2026-11-10T15:59:00.000Z',
    ];

    for (const iso of starts) {
      const start = new Date(iso);
      const window = computeConnectionSelectionWindow(start, start);
      const reveal = window?.revealAt.getTime() ?? 0;

      expect(reveal).toBeGreaterThanOrEqual(start.getTime() + 24 * HOUR_MS);
      expect(reveal).toBeLessThan(start.getTime() + 48 * HOUR_MS);
      // Always exactly 21:00 Asia/Shanghai.
      expect(new Date(reveal + 8 * HOUR_MS).getUTCHours()).toBe(21);
      expect(new Date(reveal + 8 * HOUR_MS).getUTCMinutes()).toBe(0);
    }
  });

  it('rolls to the following evening when the +24h anchor lands after 21:00 local', () => {
    // 22:00 local (14:00Z) → anchor is 22:00 local the next day.
    const window = computeConnectionSelectionWindow(
      new Date('2026-11-10T14:00:00.000Z'),
      new Date('2026-11-10T14:00:00.000Z'),
    );

    expect(window?.revealAt.toISOString()).toBe('2026-11-12T13:00:00.000Z');
  });

  it('does not add a day when the +24h anchor already lands exactly on 21:00 local', () => {
    // 21:00 local (13:00Z) → anchor 21:00 local the next day; at-or-after keeps it.
    const window = computeConnectionSelectionWindow(
      new Date('2026-11-10T13:00:00.000Z'),
      new Date('2026-11-10T13:00:00.000Z'),
    );

    expect(window?.revealAt.toISOString()).toBe('2026-11-11T13:00:00.000Z');
  });

  it('reaches the same evening when the anchor lands before 21:00 local', () => {
    // 09:00 local (01:00Z) → anchor 09:00 local next day → 21:00 the same local day.
    const window = computeConnectionSelectionWindow(
      new Date('2026-11-10T01:00:00.000Z'),
      new Date('2026-11-10T01:00:00.000Z'),
    );

    expect(window?.revealAt.toISOString()).toBe('2026-11-11T13:00:00.000Z');
  });

  describe('state', () => {
    const window = computeConnectionSelectionWindow(EVENING_START, new Date('2026-11-10T12:00:00.000Z'));

    it('is not_open before opensAt', () => {
      expect(
        computeConnectionSelectionWindow(EVENING_START, new Date('2026-11-10T13:59:59.000Z'))?.state,
      ).toBe('not_open');
    });

    it('is open from opensAt until revealAt', () => {
      expect(
        computeConnectionSelectionWindow(EVENING_START, new Date('2026-11-10T14:00:00.000Z'))?.state,
      ).toBe('open');
      expect(
        computeConnectionSelectionWindow(EVENING_START, new Date('2026-11-11T12:59:59.000Z'))?.state,
      ).toBe('open');
    });

    it('is closed at revealAt and after', () => {
      expect(
        computeConnectionSelectionWindow(EVENING_START, new Date('2026-11-11T13:00:00.000Z'))?.state,
      ).toBe('closed');
      expect(
        computeConnectionSelectionWindow(EVENING_START, new Date('2026-12-01T00:00:00.000Z'))?.state,
      ).toBe('closed');
    });

    it('exposes the same instants regardless of `now`', () => {
      const later = computeConnectionSelectionWindow(EVENING_START, new Date('2026-11-20T00:00:00.000Z'));
      expect(later?.opensAt.toISOString()).toBe(window?.opensAt.toISOString());
      expect(later?.revealAt.toISOString()).toBe(window?.revealAt.toISOString());
    });
  });

  describe('missing / invalid event start', () => {
    it.each([
      ['undefined', undefined],
      ['null', null],
      ['invalid Date', new Date('nope')],
      ['garbage string', 'not-a-date'],
    ])('returns null for %s (no client fallback)', (_label, value) => {
      expect(computeConnectionSelectionWindow(value as never, new Date())).toBeNull();
    });

    it('returns null for an invalid `now`', () => {
      expect(computeConnectionSelectionWindow(EVENING_START, new Date('nope'))).toBeNull();
    });

    it('accepts an ISO string event start (driver-agnostic)', () => {
      expect(computeConnectionSelectionWindow(EVENING_START.toISOString(), EVENING_START)?.revealAt.toISOString())
        .toBe('2026-11-11T13:00:00.000Z');
    });
  });
});

describe('nextBusinessRevealInstant', () => {
  it('returns the instant itself when already exactly 21:00 local', () => {
    const at2100 = new Date('2026-11-11T13:00:00.000Z');
    expect(nextBusinessRevealInstant(at2100).toISOString()).toBe(at2100.toISOString());
  });

  it('rounds up by a day past 21:00 local', () => {
    expect(nextBusinessRevealInstant(new Date('2026-11-11T13:00:01.000Z')).toISOString())
      .toBe('2026-11-12T13:00:00.000Z');
  });
});

describe('connectionSelectionStateAt', () => {
  it('mirrors the derived window boundaries for the ops-override path', () => {
    const opensAt = new Date('2026-11-10T14:00:00.000Z');
    const closesAt = new Date('2026-11-11T13:00:00.000Z');

    expect(connectionSelectionStateAt(opensAt, closesAt, new Date('2026-11-10T13:00:00.000Z'))).toBe('not_open');
    expect(connectionSelectionStateAt(opensAt, closesAt, new Date('2026-11-11T00:00:00.000Z'))).toBe('open');
    expect(connectionSelectionStateAt(opensAt, closesAt, new Date('2026-11-11T13:00:00.000Z'))).toBe('closed');
  });

  it('fails closed to closed on malformed instants (never throws on the write path)', () => {
    const valid = new Date('2026-11-10T14:00:00.000Z');
    expect(connectionSelectionStateAt(undefined as never, valid, valid)).toBe('closed');
    expect(connectionSelectionStateAt(valid, 'nope' as never, valid)).toBe('closed');
  });
});

describe('buildConnectionSelectionSummary', () => {
  it('projects ISO instants + the server-owned cap and the OWN selected ids', () => {
    const window = computeConnectionSelectionWindow(EVENING_START, new Date('2026-11-10T15:00:00.000Z'));
    const summary = buildConnectionSelectionSummary(window!, ['peer-1', 'peer-2', 'peer-3']);

    expect(summary).toEqual({
      state: 'open',
      revealed: false,
      opensAt: '2026-11-10T14:00:00.000Z',
      closesAt: '2026-11-11T13:00:00.000Z',
      revealAt: '2026-11-11T13:00:00.000Z',
      maxSelections: MAX_CONNECTION_SELECTIONS,
      selectedCount: 3,
      selectedUserIds: ['peer-1', 'peer-2', 'peer-3'],
    });
    expect(MAX_CONNECTION_SELECTIONS).toBe(5);
  });

  it('derives selectedCount from the ids so the two can never disagree', () => {
    const window = computeConnectionSelectionWindow(EVENING_START, new Date('2026-11-10T15:00:00.000Z'));

    const summary = buildConnectionSelectionSummary(window!, ['peer-1', 'peer-1', '']);

    expect(summary.selectedUserIds).toEqual(['peer-1']);
    expect(summary.selectedCount).toBe(1);
  });

  it('marks closed windows as revealed', () => {
    const window = computeConnectionSelectionWindow(EVENING_START, new Date('2026-11-12T00:00:00.000Z'));
    expect(buildConnectionSelectionSummary(window!, []).revealed).toBe(true);
  });
});
