import { describe, expect, it } from 'vitest'
import type { SocialSessionState } from '@shared/socialIcebreaker'
import { countPendingSubmissionsForAdvance } from '../viewModels/advanceGuardModel'

// P0 E2 (2026-10-20): host advance confirm — only submission-type phases
// with outstanding players prompt; everything else is zero-disturbance.
function makeSession(patch: Partial<SocialSessionState>): SocialSessionState {
  return {
    socialSessionId: 's1',
    icebreakerSessionId: 'ib1',
    currentPhase: 'warmup',
    hostUserId: 'host',
    hostDisplayName: '主持人',
    playerCount: 6,
    phaseStartedAt: 0,
    sessionStartedAt: 0,
    completedPhases: [],
    ...patch,
  } as SocialSessionState
}

describe('countPendingSubmissionsForAdvance (P0 E2)', () => {
  it('host-paced phases never prompt (speed_friending / warmup / mini_script)', () => {
    expect(countPendingSubmissionsForAdvance(makeSession({ currentPhase: 'speed_friending' }), 6)).toBe(0)
    expect(countPendingSubmissionsForAdvance(makeSession({ currentPhase: 'warmup' }), 6)).toBe(0)
    expect(countPendingSubmissionsForAdvance(makeSession({ currentPhase: 'mini_script' }), 6)).toBe(0)
    expect(countPendingSubmissionsForAdvance(makeSession({ currentPhase: 'recap' }), 6)).toBe(0)
  })

  it('group_mirror counts only the unsubmitted; revealed or question-less states stay quiet', () => {
    expect(countPendingSubmissionsForAdvance(makeSession({
      currentPhase: 'group_mirror',
      groupMirrorQuestions: [{ questionId: 'q1', questionText: '谁最可能', emoji: '🔥' } as never],
      groupMirrorSubmittedUserIds: ['a', 'b', 'c', 'd'],
    }), 6)).toBe(2)

    expect(countPendingSubmissionsForAdvance(makeSession({
      currentPhase: 'group_mirror',
      groupMirrorQuestions: [{ questionId: 'q1', questionText: '谁最可能', emoji: '🔥' } as never],
      groupMirrorSubmittedUserIds: ['a', 'b', 'c', 'd', 'e', 'f'],
    }), 6)).toBe(0)

    expect(countPendingSubmissionsForAdvance(makeSession({
      currentPhase: 'group_mirror',
      groupMirrorQuestions: [{ questionId: 'q1', questionText: '谁最可能', emoji: '🔥' } as never],
      groupMirrorSubmittedUserIds: ['a'],
      groupMirrorRevealed: true,
    }), 6)).toBe(0)

    expect(countPendingSubmissionsForAdvance(makeSession({
      currentPhase: 'group_mirror',
    }), 6)).toBe(0)
  })

  it('undercover_word reads the CURRENT round descriptions; revealed or pair-less stays quiet', () => {
    expect(countPendingSubmissionsForAdvance(makeSession({
      currentPhase: 'undercover_word',
      undercoverWordPair: { civilianWord: '苹果', undercoverWord: '梨', category: '水果' },
      undercoverWordCurrentRound: 0,
      undercoverWordRounds: [{
        roundNumber: 1,
        descriptions: [
          { userId: 'a', displayName: 'A', text: '圆的' },
          { userId: 'b', displayName: 'B', text: '甜的' },
        ],
      }],
    }), 6)).toBe(4)

    expect(countPendingSubmissionsForAdvance(makeSession({
      currentPhase: 'undercover_word',
      undercoverWordPair: { civilianWord: '苹果', undercoverWord: '梨', category: '水果' },
      undercoverWordCurrentRound: 0,
      undercoverWordRounds: [{
        roundNumber: 1,
        descriptions: [{ userId: 'a', displayName: 'A', text: '圆的' }],
      }],
      undercoverWordRevealed: true,
    }), 6)).toBe(0)

    expect(countPendingSubmissionsForAdvance(makeSession({
      currentPhase: 'undercover_word',
    }), 6)).toBe(0)
  })

  it('quip_battle unions submitted ∪ voted; revealed or prompt-less stays quiet', () => {
    expect(countPendingSubmissionsForAdvance(makeSession({
      currentPhase: 'quip_battle',
      quipBattlePrompts: [{ id: 'p1', promptText: '半句', category: '生活' }],
      quipBattleSubmittedUserIds: ['a', 'b'],
      quipBattleVotedUserIds: ['c'],
    }), 6)).toBe(3)

    expect(countPendingSubmissionsForAdvance(makeSession({
      currentPhase: 'quip_battle',
      quipBattlePrompts: [{ id: 'p1', promptText: '半句', category: '生活' }],
      quipBattleSubmittedUserIds: ['a'],
      quipBattleRevealed: true,
    }), 6)).toBe(0)

    expect(countPendingSubmissionsForAdvance(makeSession({
      currentPhase: 'quip_battle',
    }), 6)).toBe(0)
  })

  it('opt-out and silent-completed players count as done (W3 honest opt-out)', () => {
    expect(countPendingSubmissionsForAdvance(makeSession({
      currentPhase: 'quip_battle',
      quipBattlePrompts: [{ id: 'p1', promptText: '半句', category: '生活' }],
      quipBattleSubmittedUserIds: ['a', 'b', 'c', 'd'],
      phaseOptOutUserIds: ['e'],
      phaseSilentCompletedUserIds: ['f'],
    }), 6)).toBe(0)

    expect(countPendingSubmissionsForAdvance(makeSession({
      currentPhase: 'undercover_word',
      undercoverWordPair: { civilianWord: '苹果', undercoverWord: '梨', category: '水果' },
      undercoverWordCurrentRound: 0,
      undercoverWordRounds: [{
        roundNumber: 1,
        descriptions: [{ userId: 'a', displayName: 'A', text: '圆的' }],
      }],
      phaseOptOutUserIds: ['e', 'f'],
    }), 6)).toBe(3)
  })

  it('never goes negative when the submitted set exceeds the roster', () => {
    expect(countPendingSubmissionsForAdvance(makeSession({
      currentPhase: 'quip_battle',
      quipBattlePrompts: [{ id: 'p1', promptText: '半句', category: '生活' }],
      quipBattleSubmittedUserIds: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'],
    }), 6)).toBe(0)
  })
})
