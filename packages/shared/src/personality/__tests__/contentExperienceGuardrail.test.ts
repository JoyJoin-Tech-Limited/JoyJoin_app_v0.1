/**
 * Content Experience Guardrail (P0, PR1 2026-10-14).
 *
 * Locks the content-diversity contract for the V4 question bank:
 *  - tagging completeness, bidirectional (bank→map AND map→bank);
 *  - guaranteed-spine domain coverage ratchet (anchors ≥ 8, spine ≥ 10 — a
 *    regression toward the old single-domain spine must fail);
 *  - no motif appears more than once in the guaranteed spine;
 *  - bank-wide per-motif counts may never exceed the recorded baseline
 *    (ratchet — same pattern as class-coverage-baseline.json; PR2 tightens);
 *  - every motif is a member of the closed allowlist.
 *
 * Source of truth for the taxonomy: docs/design/2026-10-14-personality-test-content-refresh-pr1.md §5.
 * This file measures CONTENT only — it never touches engine scoring.
 */
import { describe, expect, it } from 'vitest';
import { questionsV4, ANCHOR_QUESTION_IDS } from '../questionsV4';
import { CALIBRATION_QUESTION_IDS, UNIVERSAL_CLOSING_QUESTION_IDS } from '../adaptiveEngine';
import {
  CONTENT_DOMAINS,
  CONTENT_MOTIFS,
  CONTENT_EXPERIENCE_MAP,
  type ContentMotif,
} from '../contentExperienceMap';

/** The 15 ids every default-flag session is guaranteed to see (order-independent). */
export const GUARANTEED_SPINE_IDS: readonly string[] = [
  ...ANCHOR_QUESTION_IDS,
  ...CALIBRATION_QUESTION_IDS,
  ...UNIVERSAL_CLOSING_QUESTION_IDS,
];

/**
 * Recorded ratchets (measured 2026-10-14 with the PR1 map).
 * Anchor set: 8 distinct domains. Guaranteed spine: 10 distinct domains.
 * May only be raised by a reviewed change — never lowered.
 */
const ANCHOR_DOMAIN_BASELINE = 8;
const SPINE_DOMAIN_BASELINE = 10;

/**
 * Bank-wide motif counts recorded at PR1 (2026-10-14). Every motif in the
 * allowlist has an entry; a count above its cap — or a motif absent from this
 * table — fails. PR2 (tail re-dress) will lower the invite-family caps.
 */
const BANK_MOTIF_CAPS: Record<ContentMotif, number> = {
  support_giving: 14,
  positivity_outlook: 11,
  mood_resilience: 11,
  self_reflection: 9,
  creative_generation: 9,
  group_activity_choice: 8,
  opinion_disagreement: 8,
  social_energy_recovery: 8,
  joy_celebration: 8,
  novelty_exploration: 7,
  commitment_planning: 7,
  spontaneous_invite_join: 6,
  plan_disruption_response: 6,
  group_inclusion: 6,
  spotlight_response: 5,
  group_game_learning: 4,
  practical_help: 4,
  friction_forgiveness: 4,
  knowledge_pursuit: 4,
  awkward_moment_response: 3,
  work_collaboration: 3,
  learning_style: 3,
  problem_solving: 3,
  optimization_disclosure: 2,
  relationship_maintenance: 2,
  money_splitting: 2,
  group_chat_dynamics: 2,
  cultural_taste: 2,
  initiating_contact: 2,
  plan_vs_social_invite: 1,
  group_photo_role: 1,
  gift_choice: 1,
  competition_response: 1,
  new_group_entry: 1,
  content_sharing: 1,
  secret_handling: 1,
  stranger_approach_response: 1,
  social_media_moment: 1,
  travel_mishap_recovery: 1,
  attention_check: 1,
  energy_dial: 1,
  conflict_instinct: 1,
  self_view_calibration: 1,
};

describe('content experience guardrail', () => {
  it('taxonomy is closed and internally consistent', () => {
    expect(new Set(CONTENT_DOMAINS).size).toBe(CONTENT_DOMAINS.length);
    expect(new Set(CONTENT_MOTIFS).size).toBe(CONTENT_MOTIFS.length);
    // Every declared motif has a recorded bank cap (no unratcheted tags).
    for (const motif of CONTENT_MOTIFS) {
      expect(BANK_MOTIF_CAPS[motif], `missing bank cap for motif ${motif}`).toBeTypeOf('number');
    }
  });

  it('every bank question is tagged, and every tag maps to a bank question (bidirectional)', () => {
    const bankIds = questionsV4.map((q) => q.id);
    const mapIds = Object.keys(CONTENT_EXPERIENCE_MAP);

    const untagged = bankIds.filter((id) => !(id in CONTENT_EXPERIENCE_MAP));
    const stale = mapIds.filter((id) => !bankIds.includes(id));

    expect(untagged, `bank items missing content tags: ${untagged.join(', ')}`).toEqual([]);
    expect(stale, `content tags without a bank item: ${stale.join(', ')}`).toEqual([]);
  });

  it('every entry carries exactly one valid domain and at least one allowed motif', () => {
    for (const [id, entry] of Object.entries(CONTENT_EXPERIENCE_MAP)) {
      expect(CONTENT_DOMAINS.includes(entry.domain), `${id}: bad domain ${entry.domain}`).toBe(true);
      expect(entry.motifs.length, `${id}: needs ≥1 motif`).toBeGreaterThanOrEqual(1);
      for (const motif of entry.motifs) {
        expect(CONTENT_MOTIFS.includes(motif), `${id}: motif ${motif} outside allowlist`).toBe(true);
      }
    }
  });

  it('anchor set keeps ≥ 8 distinct domains (ratchet)', () => {
    const anchorDomains = new Set(
      ANCHOR_QUESTION_IDS.map((id) => CONTENT_EXPERIENCE_MAP[id]?.domain)
    );
    expect(anchorDomains.size).toBeGreaterThanOrEqual(ANCHOR_DOMAIN_BASELINE);
  });

  it('guaranteed spine keeps ≥ 10 distinct domains (ratchet)', () => {
    const spineDomains = new Set(
      GUARANTEED_SPINE_IDS.map((id) => CONTENT_EXPERIENCE_MAP[id]?.domain)
    );
    expect(spineDomains.size).toBeGreaterThanOrEqual(SPINE_DOMAIN_BASELINE);
  });

  it('no motif appears more than once in the guaranteed spine', () => {
    const seen = new Map<string, string[]>();
    for (const id of GUARANTEED_SPINE_IDS) {
      for (const motif of CONTENT_EXPERIENCE_MAP[id]?.motifs ?? []) {
        seen.set(motif, [...(seen.get(motif) ?? []), id]);
      }
    }
    const duplicated = [...seen.entries()].filter(([, ids]) => ids.length > 1);
    expect(
      duplicated,
      `motif(s) repeated in spine: ${duplicated.map(([m, ids]) => `${m} (${ids.join('/')})`).join('; ')}`
    ).toEqual([]);
  });

  it('bank-wide motif counts never exceed the recorded ratchet', () => {
    const counts = new Map<string, number>();
    for (const entry of Object.values(CONTENT_EXPERIENCE_MAP)) {
      for (const motif of entry.motifs) {
        counts.set(motif, (counts.get(motif) ?? 0) + 1);
      }
    }
    const breaches: string[] = [];
    for (const [motif, count] of counts) {
      const cap = BANK_MOTIF_CAPS[motif as ContentMotif];
      if (cap === undefined) breaches.push(`${motif}: no recorded cap (add via reviewed change)`);
      else if (count > cap) breaches.push(`${motif}: ${count} > cap ${cap}`);
    }
    expect(breaches, `motif ratchet breached: ${breaches.join('; ')}`).toEqual([]);
  });
});
