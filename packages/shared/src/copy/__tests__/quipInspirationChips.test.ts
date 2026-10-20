import { describe, expect, it } from 'vitest';
import {
  QUIP_INSPIRATION_CHIPS,
  QUIP_CHIP_ROW_LABEL,
  QUIP_CHIP_REPLACE_CONFIRM_TEXT,
  pickQuipInspirationChips,
  type QuipChipFamily,
} from '../quipInspirationChips';
import { findBannedWord, findReviewBlockedVocab } from '../terms';
import { QUIP_BATTLE_FALLBACK_PROMPTS } from '../../quipBattle';

// Spec: docs/deliberations/2026-10-20-recap-share-and-quip-chips-spec.md 规格二.
// 池治理（🔴 常跑锁定）：27 条 = 9 族 × 3；每条 ≤16 字、零 emoji、零禁用词、
// 零审核敏感词；九族齐全且覆盖 quip fallback 题库全部 15 个 category。

const EMOJI_PATTERN =
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/u;

const ALL_FALLBACK_CATEGORIES = [
  ...new Set(QUIP_BATTLE_FALLBACK_PROMPTS.map((p) => p.category)),
];

describe('quip inspiration chips pool governance', () => {
  it('holds exactly 27 chips with unique stable ids', () => {
    expect(QUIP_INSPIRATION_CHIPS).toHaveLength(27);
    const ids = QUIP_INSPIRATION_CHIPS.map((c) => c.id);
    expect(new Set(ids).size).toBe(27);
    for (const id of ids) {
      expect(id).toMatch(/^quip_chip_(0[1-9]|1[0-9]|2[0-7])$/);
    }
  });

  it('ships all nine families with exactly three chips each', () => {
    const families: QuipChipFamily[] = [
      'dish',
      'self_deprecating',
      'suspense',
      'hyperbole',
      'confession',
      'daily',
      'interactive',
      'hypothetical',
      'metaphor',
    ];
    for (const family of families) {
      const members = QUIP_INSPIRATION_CHIPS.filter((c) => c.family === family);
      expect(members, `family ${family} must hold 3 chips`).toHaveLength(3);
    }
  });

  it('keeps every chip ≤16 chars, emoji-free, and non-empty', () => {
    for (const chip of QUIP_INSPIRATION_CHIPS) {
      expect(chip.text.length, `${chip.id} over 16 chars`).toBeLessThanOrEqual(16);
      expect(chip.text.trim().length).toBeGreaterThan(0);
      expect(EMOJI_PATTERN.test(chip.text), `${chip.id} carries emoji`).toBe(false);
    }
  });

  it('passes brand-copy 🔴 scans: zero banned words, zero review-blocked vocab', () => {
    for (const chip of QUIP_INSPIRATION_CHIPS) {
      expect(findBannedWord(chip.text), `${chip.id} banned word`).toBeNull();
      expect(findReviewBlockedVocab(chip.text), `${chip.id} review-blocked`).toBeNull();
    }
    // Row chrome copy rides the same gate.
    expect(findBannedWord(QUIP_CHIP_ROW_LABEL)).toBeNull();
    expect(findReviewBlockedVocab(QUIP_CHIP_ROW_LABEL)).toBeNull();
    expect(findBannedWord(QUIP_CHIP_REPLACE_CONFIRM_TEXT)).toBeNull();
    expect(findReviewBlockedVocab(QUIP_CHIP_REPLACE_CONFIRM_TEXT)).toBeNull();
  });

  it('covers every fallback-question-bank category via the family mapping', () => {
    expect(ALL_FALLBACK_CATEGORIES).toHaveLength(15);
    const covered = new Set(
      QUIP_INSPIRATION_CHIPS.flatMap((chip) => chip.categories),
    );
    for (const category of ALL_FALLBACK_CATEGORIES) {
      expect(covered.has(category), `category ${category} uncovered`).toBe(true);
    }
  });
});

describe('pickQuipInspirationChips', () => {
  it('is deterministic: same seed triple yields the identical ordered subset', () => {
    const a = pickQuipInspirationChips('sess-1', 'prompt-1', 'user-1');
    const b = pickQuipInspirationChips('sess-1', 'prompt-1', 'user-1');
    expect(a.map((c) => c.id)).toEqual(b.map((c) => c.id));
  });

  it('returns exactly 3 unique chips by default and honours count', () => {
    const picked = pickQuipInspirationChips('sess-1', 'prompt-1', 'user-1');
    expect(picked).toHaveLength(3);
    expect(new Set(picked.map((c) => c.id)).size).toBe(3);
    expect(pickQuipInspirationChips('sess-1', 'prompt-1', 'user-1', 1)).toHaveLength(1);
    expect(pickQuipInspirationChips('sess-1', 'prompt-1', 'user-1', 99)).toHaveLength(27);
    expect(pickQuipInspirationChips('sess-1', 'prompt-1', 'user-1', 0)).toHaveLength(0);
  });

  it('varies the subset across table-mates on the same prompt (collision < 2%)', () => {
    let identical = 0;
    let pairs = 0;
    const picks: string[][] = [];
    for (let i = 0; i < 100; i++) {
      picks.push(
        pickQuipInspirationChips('sess-table', 'prompt-x', `user-${i}`).map((c) => c.id),
      );
    }
    for (let i = 0; i < picks.length; i++) {
      for (let j = i + 1; j < picks.length; j++) {
        pairs++;
        if (picks[i].join(',') === picks[j].join(',')) identical++;
      }
    }
    expect(identical / pairs).toBeLessThan(0.02);
  });

  it('varies the subset across prompts for the same user and across sessions', () => {
    const byPrompt = new Set(
      ['prompt-a', 'prompt-b', 'prompt-c', 'prompt-d', 'prompt-e'].map((promptId) =>
        pickQuipInspirationChips('sess-1', promptId, 'user-1')
          .map((c) => c.id)
          .join(','),
      ),
    );
    expect(byPrompt.size).toBeGreaterThan(1);
    const bySession = new Set(
      ['sess-a', 'sess-b', 'sess-c'].map((sessionId) =>
        pickQuipInspirationChips(sessionId, 'prompt-a', 'user-1')
          .map((c) => c.id)
          .join(','),
      ),
    );
    expect(bySession.size).toBeGreaterThan(1);
  });
});
