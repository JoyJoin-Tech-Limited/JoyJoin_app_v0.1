import { describe, expect, it } from 'vitest'
import type { MiniScriptPresentedEvidence, MiniScriptVote } from '@shared/socialIcebreaker'
import type { MiniScriptStoryFrameworkPublic } from '@shared/miniscriptStoryFramework'
import {
  buildClueDrawerGroups,
  buildPresentedComboSet,
  countClueDrawerItems,
  countMyPresentsInAct,
  frameworkHasAnyEvidence,
  isReactionRevealed,
  pendingReactionEntries,
  presentedComboKey,
  resolveEvidenceIconEmoji,
  resolveHasMotiveRound,
  resolveRevealedEvidence,
  roundOneVotes,
  roundTwoVotes,
} from '../phases/miniScriptV2Model'

function makeFramework(acts: Array<{ actNumber: number; evidenceCount: number }>): MiniScriptStoryFrameworkPublic {
  return {
    schemaVersion: 2,
    style: 'modern_urban',
    genres: ['light_reasoning'],
    premise: '测试故事',
    characters: [
      { slotIndex: 0, roleLabel: '阿杰', sinHook: '', alibi: '' },
      { slotIndex: 1, roleLabel: '小敏', sinHook: '', alibi: '' },
      { slotIndex: 2, roleLabel: '老周', sinHook: '', alibi: '' },
      { slotIndex: 3, roleLabel: '阿紫', sinHook: '', alibi: '' },
    ],
    act_flow: acts.map(({ actNumber, evidenceCount }) => ({
      actNumber,
      title: `第${actNumber}幕`,
      beats: ['beat'],
      ...(evidenceCount > 0
        ? {
            evidence: Array.from({ length: evidenceCount }, (_, i) => ({
              id: `e${actNumber}_${i}`,
              name: `证物${actNumber}-${i}`,
              description: '描述',
              iconKey: '信封',
            })),
          }
        : {}),
    })),
    ending: { resolutionSummary: '结局', confessionMechanic: '认领' },
    motiveOptions: ['为了省钱', '为了保护朋友', '一时冲动'],
  } as MiniScriptStoryFrameworkPublic
}

describe('miniScriptV2Model · evidence visibility (AC-08)', () => {
  const framework = makeFramework([
    { actNumber: 1, evidenceCount: 2 },
    { actNumber: 2, evidenceCount: 1 },
    { actNumber: 3, evidenceCount: 1 },
  ])

  it('shows only evidence from acts 1..currentAct (future acts never render)', () => {
    expect(resolveRevealedEvidence(framework, 1).map((i) => i.evidence.id)).toEqual(['e1_0', 'e1_1'])
    expect(resolveRevealedEvidence(framework, 2)).toHaveLength(3)
    expect(resolveRevealedEvidence(framework, 99)).toHaveLength(4)
    expect(resolveRevealedEvidence(framework, 0)).toEqual([])
  })

  it('detects frameworks with no evidence at all (tray hides entirely)', () => {
    expect(frameworkHasAnyEvidence(framework)).toBe(true)
    expect(
      frameworkHasAnyEvidence(makeFramework([{ actNumber: 1, evidenceCount: 0 }])),
    ).toBe(false)
    expect(frameworkHasAnyEvidence(undefined)).toBe(false)
  })

  it('builds the presented-combo set and per-act budget count', () => {
    const entries: MiniScriptPresentedEvidence[] = [
      { evidenceId: 'e1_0', targetRoleSlot: 2, presentedBy: 'u1', actNo: 1, presentedAt: 1, reactionText: '…' },
      { evidenceId: 'e1_0', targetRoleSlot: 2, presentedBy: 'u2', actNo: 1, presentedAt: 2, reactionText: '…' },
      { evidenceId: 'e1_1', targetRoleSlot: 1, presentedBy: 'u1', actNo: 2, presentedAt: 3, reactionText: '…' },
    ]
    const set = buildPresentedComboSet(entries)
    expect(set.has(presentedComboKey('e1_0', 2))).toBe(true)
    expect(set.has(presentedComboKey('e1_0', 3))).toBe(false)
    expect(countMyPresentsInAct(entries, 'u1', 1)).toBe(1)
    expect(countMyPresentsInAct(entries, 'u1', 2)).toBe(1)
    expect(countMyPresentsInAct(entries, 'u1', 3)).toBe(0)
  })

  it('gates reaction visibility on the server contract: reactionText presence only', () => {
    // V2 P3: sanitizeStateForClient OMITS reactionText for non-presenters
    // until the server-side 8s window elapses OR readConfirmedAt lands. The
    // field's presence is the only reveal signal — clients never compare
    // presentedAt against a device clock (2026-08-13 clock-skew canon).
    const gated: MiniScriptPresentedEvidence = {
      evidenceId: 'e1_0',
      targetRoleSlot: 1,
      presentedBy: 'u1',
      actNo: 1,
      presentedAt: 1_000_000,
      // reactionText omitted — still behind the server gate
    }
    const released: MiniScriptPresentedEvidence = {
      ...gated,
      reactionText: '我没拿！',
      readConfirmedAt: 1_004_000,
    }
    const releasedByTimer: MiniScriptPresentedEvidence = {
      ...gated,
      reactionText: '真的不是我',
    }
    expect(isReactionRevealed(gated)).toBe(false)
    expect(isReactionRevealed(released)).toBe(true)
    expect(isReactionRevealed(releasedByTimer)).toBe(true)
    expect(pendingReactionEntries([gated, released, releasedByTimer]).map((e) => e.reactionText)).toEqual([
      undefined,
    ])
    expect(pendingReactionEntries([released, releasedByTimer])).toEqual([])
  })
})

describe('miniScriptV2Model · two-round vote filters (AC-13 client half)', () => {
  const votes: MiniScriptVote[] = [
    { userId: 'u1', suspectRoleSlot: 2, votedAt: 1 },
    { userId: 'u2', suspectRoleSlot: 2, voteRound: 1, votedAt: 2 },
    { userId: 'u1', voteRound: 2, motiveChoice: 0, votedAt: 3 },
    { userId: 'u3', voteRound: 2, motiveChoice: 1, votedAt: 4 },
  ]

  it('splits ballots by round with legacy ballots defaulting to round 1', () => {
    expect(roundOneVotes(votes).map((v) => v.userId)).toEqual(['u1', 'u2'])
    expect(roundTwoVotes(votes).map((v) => v.userId)).toEqual(['u1', 'u3'])
    expect(roundOneVotes(undefined)).toEqual([])
    expect(roundTwoVotes(undefined)).toEqual([])
  })

  it('only enables the motive round when the flag snapshot is on AND options exist', () => {
    expect(resolveHasMotiveRound(true, ['a', 'b', 'c'])).toBe(true)
    expect(resolveHasMotiveRound(false, ['a', 'b', 'c'])).toBe(false)
    expect(resolveHasMotiveRound(true, undefined)).toBe(false)
    expect(resolveHasMotiveRound(true, [])).toBe(false)
  })
})

describe('miniScriptV2Model · clue drawer grouping (AC-09)', () => {
  const framework = makeFramework([
    { actNumber: 1, evidenceCount: 1 },
    { actNumber: 2, evidenceCount: 1 },
    { actNumber: 3, evidenceCount: 1 },
  ])

  it('groups revealed clues and public evidence by act, hiding unrevealed acts', () => {
    const groups = buildClueDrawerGroups({
      framework,
      currentAct: 2,
      revealedClues: [
        { clueId: 'c1', text: '线索一', revealedInAct: 1 },
        { clueId: 'c2', text: '线索二', revealedInAct: 2 },
      ],
    })
    expect(groups.map((g) => g.actNumber)).toEqual([1, 2])
    expect(groups[0].clues.map((c) => c.clueId)).toEqual(['c1'])
    expect(groups[0].evidence.map((e) => e.id)).toEqual(['e1_0'])
    expect(groups[1].clues.map((c) => c.clueId)).toEqual(['c2'])
    expect(groups[1].evidence.map((e) => e.id)).toEqual(['e2_0'])
    expect(countClueDrawerItems(groups)).toBe(4)
  })

  it('never shows clues from future acts even if a payload claims them', () => {
    const groups = buildClueDrawerGroups({
      framework,
      currentAct: 1,
      revealedClues: [
        { clueId: 'c1', text: '线索一', revealedInAct: 1 },
        { clueId: 'cX', text: '未来幕线索', revealedInAct: 3 },
      ],
    })
    expect(groups).toHaveLength(1)
    expect(groups[0].clues.map((c) => c.clueId)).toEqual(['c1'])
  })

  it('buckets pre-P2 clues (no revealedInAct) under the current act instead of dropping them', () => {
    const groups = buildClueDrawerGroups({
      framework,
      currentAct: 2,
      revealedClues: [{ clueId: 'c1', text: '旧线索' }],
    })
    expect(groups.find((g) => g.actNumber === 2)?.clues.map((c) => c.clueId)).toEqual(['c1'])
  })

  it('returns nothing before the first act or without a framework', () => {
    expect(buildClueDrawerGroups({ framework, currentAct: 0, revealedClues: [] })).toEqual([])
    expect(buildClueDrawerGroups({ framework: undefined, currentAct: 2, revealedClues: [] })).toEqual([])
  })
})

describe('miniScriptV2Model · evidence icon mapping (MAI-02)', () => {
  it('maps catalog icon keys and falls back to the search icon', () => {
    expect(resolveEvidenceIconEmoji('信封')).toBe('✉️')
    expect(resolveEvidenceIconEmoji('碎裂的茶杯')).toBe('☕')
    expect(resolveEvidenceIconEmoji('未知物品')).toBe('🔍')
  })
})
