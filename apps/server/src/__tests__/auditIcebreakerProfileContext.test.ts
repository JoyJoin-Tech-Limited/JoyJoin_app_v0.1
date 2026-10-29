/**
 * FU-05 — the read-only profile-context audit must report the SAME anchor
 * threshold the live prompt is built from.
 *
 * Before this fix the audit hardcoded `minMembers: 2`, while `deriveTablePersona`
 * requires 3 members behind an anchor once a table reaches
 * `TABLE_PERSONA_LARGE_ROSTER` (6). The audit therefore overstated "potential
 * anchors" for exactly the tables the live pipeline is strictest about.
 */
import { describe, expect, it } from 'vitest';
import { resolveAuditAnchorMinMembers } from '../scripts/audit-icebreaker-profile-context';
import { buildSharedInterestAnchors } from '../lib/icebreakerRosterSignals';
import {
  TABLE_PERSONA_ANCHOR_LIMIT,
  TABLE_PERSONA_LARGE_ROSTER,
  deriveTablePersona,
} from '../lib/tablePersona';

/** Interests that no other fixture member shares, so they never become anchors. */
const UNIQUE_INTERESTS = ['观鸟', '陶艺', '潜水', '园艺', '滑板', '胶片'] as const;
const SHARED_INTEREST = '剧本杀';

function rosterOfSize(size: number, sharedBy: number): Array<{ interests: string[] }> {
  return Array.from({ length: size }, (_, index) => ({
    interests: index < sharedBy
      ? [SHARED_INTEREST]
      : [UNIQUE_INTERESTS[index % UNIQUE_INTERESTS.length]!],
  }));
}

/** Mirrors what `auditSession` passes to `buildSharedInterestAnchors`. */
function auditAnchors(roster: Array<{ interests: string[] }>) {
  return buildSharedInterestAnchors(roster, {
    minMembers: resolveAuditAnchorMinMembers(roster.length),
    limit: TABLE_PERSONA_ANCHOR_LIMIT,
  });
}

describe('FU-05 — audit anchor threshold matches the live pipeline', () => {
  it('uses 2 below the large-roster threshold and 3 at or above it', () => {
    for (let size = 1; size < TABLE_PERSONA_LARGE_ROSTER; size += 1) {
      expect(resolveAuditAnchorMinMembers(size)).toBe(2);
    }
    for (const size of [TABLE_PERSONA_LARGE_ROSTER, TABLE_PERSONA_LARGE_ROSTER + 1, 12]) {
      expect(resolveAuditAnchorMinMembers(size)).toBe(3);
    }
  });

  it('agrees with deriveTablePersona across roster sizes and sharer counts', () => {
    for (const size of [4, 5, 6, 7]) {
      for (const sharedBy of [2, 3]) {
        const roster = rosterOfSize(size, sharedBy);
        const live = deriveTablePersona({ roster }).anchors.map((anchor) => anchor.label);
        const audit = auditAnchors(roster).map((anchor) => anchor.label);
        expect(audit, `roster=${size} sharedBy=${sharedBy}`).toEqual(live);
      }
    }
  });

  it('reports no anchor for a 6-member table with only 2 sharers (was 1)', () => {
    const roster = rosterOfSize(6, 2);

    // Regression lock: the old hardcoded threshold produced an anchor the live
    // prompt would never receive.
    const legacy = buildSharedInterestAnchors(roster, { minMembers: 2, limit: 3 });
    expect(legacy).toHaveLength(1);
    expect(legacy[0]).toMatchObject({ label: SHARED_INTEREST, coverage: 2 });

    expect(auditAnchors(roster)).toHaveLength(0);
  });

  it('still reports the anchor for a 6-member table with 3 sharers', () => {
    const anchors = auditAnchors(rosterOfSize(6, 3));
    expect(anchors).toHaveLength(1);
    expect(anchors[0]).toMatchObject({ label: SHARED_INTEREST, coverage: 3 });
  });

  it('keeps the audit slot count on the shared limit constant (output shape unchanged)', () => {
    // The audit reports anchor slots, not the 2 the prompt surfaces; the value
    // must stay 3 so existing report numbers do not shift.
    expect(TABLE_PERSONA_ANCHOR_LIMIT).toBe(3);
  });
});
