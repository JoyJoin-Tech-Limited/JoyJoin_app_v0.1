import { describe, expect, it } from 'vitest'
import {
  CATCH_UP_CHIP_PHASES,
  REJOIN_CATCH_UP_CHIP_MS,
  deriveAwayMemberNames,
  deriveRejoinDuty,
  formatAwayWaitSuffix,
  formatRejoinCatchUpChip,
  resolveRejoinCatchUpText,
} from '../viewModels/rejoinCatchUpModel'

/**
 * Rejoin catch-up model (sprint icebreaker-polish-p1, contract AC-02).
 * Locks the pure `(phase, 我的义务) → 一句话` derivation behind the ≤4s
 * chip, plus the 补5 away-name suffix gating (flag off → nothing renders).
 */
describe('deriveRejoinDuty', () => {
  it('undercover: undescribed user owes a description with the round number', () => {
    expect(
      deriveRejoinDuty(
        {
          phase: 'undercover_word',
          undercoverWordPair: { civilianWord: '火锅', undercoverWord: '麻辣烫', category: '美食' },
          undercoverWordRounds: [{ descriptions: [{ userId: 'u2' }] }],
          undercoverWordCurrentRound: 1,
          undercoverWordRevealed: false,
        },
        'u1',
      ),
    ).toEqual({ context: '第 2 轮描述中', duty: '你还没描述' })
  })

  it('undercover: described user owes nothing before the vote opens', () => {
    expect(
      deriveRejoinDuty(
        {
          phase: 'undercover_word',
          undercoverWordPair: { civilianWord: '火锅', undercoverWord: '麻辣烫', category: '美食' },
          undercoverWordRounds: [{ descriptions: [{ userId: 'u1' }] }],
          undercoverWordCurrentRound: 0,
          undercoverWordRevealed: false,
          undercoverWordVotedUserIds: [],
        },
        'u1',
      ),
    ).toBeNull()
  })

  it('undercover: unvoted user owes a vote once voting is open (round >= 1, all described)', () => {
    expect(
      deriveRejoinDuty(
        {
          phase: 'undercover_word',
          playerCount: 2,
          undercoverWordPair: { civilianWord: '火锅', undercoverWord: '麻辣烫', category: '美食' },
          undercoverWordRounds: [
            { descriptions: [{ userId: 'u1' }] },
            { descriptions: [{ userId: 'u1' }, { userId: 'u2' }] },
          ],
          undercoverWordCurrentRound: 1,
          undercoverWordRevealed: false,
          undercoverWordVotedUserIds: ['u2'],
        },
        'u1',
      ),
    ).toEqual({ context: '卧底投票中', duty: '你还没投票' })
  })

  it('undercover: no vote duty while the table is still describing (not behind, just waiting)', () => {
    expect(
      deriveRejoinDuty(
        {
          phase: 'undercover_word',
          playerCount: 3,
          undercoverWordPair: { civilianWord: '火锅', undercoverWord: '麻辣烫', category: '美食' },
          undercoverWordRounds: [
            { descriptions: [{ userId: 'u1' }] },
            { descriptions: [{ userId: 'u1' }] },
          ],
          undercoverWordCurrentRound: 1,
          undercoverWordRevealed: false,
          undercoverWordVotedUserIds: [],
        },
        'u1',
      ),
    ).toBeNull()
  })

  it('undercover: opt-out/silent members count toward the describe gate (W3 union)', () => {
    expect(
      deriveRejoinDuty(
        {
          phase: 'undercover_word',
          playerCount: 2,
          undercoverWordPair: { civilianWord: '火锅', undercoverWord: '麻辣烫', category: '美食' },
          undercoverWordRounds: [
            { descriptions: [{ userId: 'u1' }] },
            { descriptions: [{ userId: 'u1' }] },
          ],
          undercoverWordCurrentRound: 1,
          undercoverWordRevealed: false,
          undercoverWordVotedUserIds: [],
          phaseOptOutUserIds: ['u2'],
        },
        'u1',
      ),
    ).toEqual({ context: '卧底投票中', duty: '你还没投票' })
  })

  it('undercover: revealed phase carries no duty', () => {
    expect(
      deriveRejoinDuty(
        { phase: 'undercover_word', undercoverWordPair: {}, undercoverWordRevealed: true },
        'u1',
      ),
    ).toBeNull()
  })

  it('group_mirror: unsubmitted user owes a submission', () => {
    expect(
      deriveRejoinDuty(
        {
          phase: 'group_mirror',
          groupMirrorQuestions: [{ id: 'q1' }],
          groupMirrorSubmittedUserIds: ['u2'],
          groupMirrorRevealed: false,
        },
        'u1',
      ),
    ).toEqual({ context: '群像镜像投票中', duty: '你还没提交' })
  })

  it('quip_battle: submit duty first, vote duty only once everyone submitted', () => {
    const base = {
      phase: 'quip_battle',
      playerCount: 2,
      quipBattlePrompts: [{ id: 'p1' }],
      quipBattleRevealed: false,
      quipBattleSubmittedUserIds: ['u2'],
      quipBattleVotedUserIds: ['u2'],
    }
    expect(deriveRejoinDuty(base, 'u1')).toEqual({
      context: '机智对决作答中',
      duty: '你还没提交答案',
    })
    expect(
      deriveRejoinDuty({ ...base, playerCount: 3, quipBattleSubmittedUserIds: ['u2', 'u1'] }, 'u1'),
    ).toBeNull() // table still submitting — u1 is waiting, not behind
    expect(
      deriveRejoinDuty({ ...base, quipBattleSubmittedUserIds: ['u2', 'u1'] }, 'u1'),
    ).toEqual({ context: '机智对决投票中', duty: '你还没投票' })
    expect(
      deriveRejoinDuty(
        { ...base, quipBattleSubmittedUserIds: ['u2', 'u1'], quipBattleVotedUserIds: ['u2', 'u1'] },
        'u1',
      ),
    ).toBeNull()
  })

  it('lie_detective: statement-less player owes statements; voter owes a vote', () => {
    expect(
      deriveRejoinDuty(
        {
          phase: 'lie_detective',
          lieDetectivePlayers: [
            { userId: 'u1', statements: [] },
            { userId: 'u2', statements: ['a', 'b', 'c'] },
          ],
          currentLieDetectivePlayerIndex: 1,
        },
        'u1',
      ),
    ).toEqual({ context: '陈述准备中', duty: '你还没写好陈述' })

    expect(
      deriveRejoinDuty(
        {
          phase: 'lie_detective',
          lieDetectivePlayers: [
            { userId: 'u1', statements: ['a', 'b', 'c'] },
            { userId: 'u2', statements: ['a', 'b', 'c'] },
          ],
          currentLieDetectivePlayerIndex: 1,
          currentLieDetectiveReveal: null,
          votes: [],
        },
        'u1',
      ),
    ).toEqual({ context: '侦探投票中', duty: '你还没投票' })
  })

  it('micro_challenge: incomplete user owes completion', () => {
    expect(
      deriveRejoinDuty(
        { phase: 'micro_challenge', currentChallenge: { id: 'c1' }, challengeCompletedBy: [] },
        'u1',
      ),
    ).toEqual({ context: '挑战进行中', duty: '你还没完成' })
    expect(
      deriveRejoinDuty(
        { phase: 'micro_challenge', currentChallenge: { id: 'c1' }, challengeCompletedBy: ['u1'] },
        'u1',
      ),
    ).toBeNull()
  })

  it('mini_script: assigned-not-ready owes ready; vote-open owes vote', () => {
    expect(
      deriveRejoinDuty(
        { phase: 'mini_script', miniScriptRoleAssignments: { u1: 0 }, miniScriptPlayerReady: {} },
        'u1',
      ),
    ).toEqual({ context: '剧本准备中', duty: '你还没点「准备好了」' })
    expect(
      deriveRejoinDuty(
        {
          phase: 'mini_script',
          miniScriptRoleAssignments: { u1: 0 },
          miniScriptPlayerReady: { u1: true },
          miniScriptVoteOpenedAt: Date.now(),
          miniScriptSolutionRevealed: false,
          miniScriptVotes: [],
        },
        'u1',
      ),
    ).toEqual({ context: '剧本投票中', duty: '你还没投票' })
  })

  it('returns null for meta/terminal phases and unknown users', () => {
    expect(deriveRejoinDuty({ phase: 'waiting' }, 'u1')).toBeNull()
    expect(deriveRejoinDuty({ phase: 'recap' }, 'u1')).toBeNull()
    expect(deriveRejoinDuty({ phase: 'warmup' }, 'u1')).toBeNull()
    expect(deriveRejoinDuty(null, 'u1')).toBeNull()
    expect(deriveRejoinDuty({ phase: 'micro_challenge', currentChallenge: {} }, '')).toBeNull()
  })
})

describe('formatRejoinCatchUpChip + resolveRejoinCatchUpText', () => {
  it('formats the one-line chip copy (现在：context · duty)', () => {
    expect(formatRejoinCatchUpChip({ context: '第 2 轮描述中', duty: '你还没描述' })).toBe(
      '现在：第 2 轮描述中 · 你还没描述',
    )
  })

  it('resolves the full chip text for a rejoining undercover player', () => {
    expect(
      resolveRejoinCatchUpText(
        {
          phase: 'undercover_word',
          undercoverWordPair: { civilianWord: '火锅', undercoverWord: '麻辣烫', category: '美食' },
          undercoverWordRounds: [{ descriptions: [] }],
          undercoverWordCurrentRound: 1,
          undercoverWordRevealed: false,
        },
        'u1',
      ),
    ).toBe('现在：第 2 轮描述中 · 你还没描述')
  })

  it('returns null when the phase is not chip-eligible or no duty exists', () => {
    expect(resolveRejoinCatchUpText({ phase: 'waiting' }, 'u1')).toBeNull()
    expect(resolveRejoinCatchUpText({ phase: 'micro_challenge', currentChallenge: null }, 'u1')).toBeNull()
    expect(CATCH_UP_CHIP_PHASES.has('waiting')).toBe(false)
    expect(CATCH_UP_CHIP_PHASES.has('recap')).toBe(false)
  })

  it('chip auto-dismiss window honours the ≤4s contract', () => {
    expect(REJOIN_CATCH_UP_CHIP_MS).toBeLessThanOrEqual(4000)
  })
})

describe('补5 away-member names', () => {
  const roster = [
    { userId: 'u1', displayName: '阿澈' },
    { userId: 'u2', displayName: '桃桃' },
    { userId: 'u3', displayName: '老周' },
  ]

  it('maps leftUserIds to roster displayNames in roster order', () => {
    expect(deriveAwayMemberNames({ leftUserIds: ['u2', 'u1'] }, roster)).toEqual(['阿澈', '桃桃'])
  })

  it('flag off / field absent → empty list (nothing renders)', () => {
    expect(deriveAwayMemberNames(undefined, roster)).toEqual([])
    expect(deriveAwayMemberNames(null, roster)).toEqual([])
    expect(deriveAwayMemberNames({}, roster)).toEqual([])
    expect(deriveAwayMemberNames({ leftUserIds: [] }, roster)).toEqual([])
  })

  it('drops unknown ids and missing displayNames (no fabrication)', () => {
    expect(deriveAwayMemberNames({ leftUserIds: ['uX', 'u3'] }, roster)).toEqual(['老周'])
    expect(deriveAwayMemberNames({ leftUserIds: ['u1'] }, [{ userId: 'u1' }])).toEqual([])
  })

  it('formatAwayWaitSuffix renders the 计数旁 suffix only with names', () => {
    expect(formatAwayWaitSuffix([])).toBe('')
    expect(formatAwayWaitSuffix(['阿澈'])).toBe(' · 等阿澈（暂离）')
    expect(formatAwayWaitSuffix(['阿澈', '桃桃'])).toBe(' · 等阿澈、桃桃（暂离）')
  })
})
