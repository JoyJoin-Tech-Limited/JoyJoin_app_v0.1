import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { QuipBattleHeroView } from '../phases/QuipBattleHeroView'
import { UndercoverWordHeroView } from '../phases/UndercoverWordHeroView'
import { LieDetectiveHeroView } from '../phases/LieDetectiveHeroView'
import { WarmupPresenceStrip } from '../components/WarmupPresenceStrip'

/**
 * E9 UGC 举报闭环 (sprint e9-ugc-report, contract AC-07) — mount contract.
 *
 * The FOUR locked long-press mounts (verifier R1 reduction — six candidates
 * down to four; groupMirrorReason / miniscriptVoteNote stay server-ready
 * only because the client never renders other members' entries there):
 *   1. quip vote-preview rows + reveal answer rows (QuipBattleHeroView)
 *   2. undercover description list (UndercoverWordHeroView)
 *   3. lie-detective statement cards (LieDetectiveHeroView)
 *   4. roster strip nicknames (WarmupPresenceStrip, wired by WarmupPhaseView)
 *
 * jsdom/React has no longpress event — the View mock below maps Taro's
 * `onLongPress` onto the DOM `contextmenu` event so fireEvent can drive it.
 */

const h = vi.hoisted(() => ({
  presentReport: vi.fn((_target: unknown) => Promise.resolve()),
  shouldSkipClick: vi.fn(() => false),
}))

vi.mock('../hooks/useUgcReport', () => ({
  useUgcReport: () => ({
    presentReport: h.presentReport,
    shouldSkipClick: h.shouldSkipClick,
    isReporting: false,
  }),
  // Copy constants ride the real module for copy assertions elsewhere.
  UGC_REPORT_ACTION_LABEL: '举报这条内容',
}))

// onLongPress → onContextMenu bridge (see file header).
vi.mock('@tarojs/components', () => ({
  Image: (props: Record<string, unknown>) => <img {...props} />,
  Text: (props: Record<string, unknown>) => <span {...props} />,
  View: (props: Record<string, unknown> & { onLongPress?: (e: unknown) => void }) => {
    const { onLongPress, ...rest } = props
    return <div {...rest} onContextMenu={onLongPress as never} />
  },
  Input: (props: {
    value?: string
    placeholder?: string
    className?: string
    maxlength?: number
    onInput?: (e: { detail: { value: string } }) => void
  }) => (
    <input
      value={props.value ?? ''}
      placeholder={props.placeholder}
      className={props.className}
      maxLength={props.maxlength}
      onChange={(e) => props.onInput?.({ detail: { value: e.target.value } })}
    />
  ),
  Textarea: (props: Record<string, unknown>) => <textarea {...props} />,
  ScrollView: (props: Record<string, unknown>) => <div {...props} />,
}))

vi.mock('../../../lib/analytics/socialIcebreakerAnalytics', () => ({
  socialIcebreakerAnalytics: { track: vi.fn() },
}))
vi.mock('../../../lib/utils/haptics', () => ({ haptics: vi.fn() }))
vi.mock('../../../lib/api/api', () => ({ apiRequest: vi.fn() }))
vi.mock('../icebreakerSessionModel', () => ({ buildSocialPath: () => '/mock/path' }))
vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { features: {} } }),
}))
vi.mock('../../../lib/utils/cdnAssets', () => ({
  localAsset: (p: string) => p,
  cdnAsset: (p: string) => p,
}))
vi.mock('../../../components/ui/JoyJoinIcon', () => ({ default: () => null }))
vi.mock('../../../components/ui/Button', () => ({
  default: ({ children, onClick, disabled }: {
    children?: React.ReactNode
    onClick?: () => void
    disabled?: boolean
  }) => <button onClick={onClick} disabled={disabled}>{children}</button>,
}))
vi.mock('../../../components/gesture', () => ({
  SwipeCard: ({ children, onSwipeRight, onSwipeLeft }: {
    children?: React.ReactNode
    onSwipeRight?: () => void
    onSwipeLeft?: () => void
  }) => (
    <div>
      {children}
      <button type='button' data-testid='swipe-right' onClick={onSwipeRight} />
      <button type='button' data-testid='swipe-left' onClick={onSwipeLeft} />
    </div>
  ),
  TapReaction: () => <div data-testid='tap-reaction' />,
}))
vi.mock('../../../components/reveal', () => ({
  ParticleBurst: () => null,
  CardFlip: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  IdentityReveal: () => null,
}))
vi.mock('../overlays/CelebrationOverlay', () => ({ CelebrationOverlay: () => null }))
vi.mock('../components/PhaseHeroCard', () => ({
  PhaseHeroCard: ({ children, actions }: { children?: React.ReactNode; actions?: React.ReactNode }) => (
    <div data-testid='phase-hero-card'>
      {children}
      <div data-testid='phase-hero-actions'>{actions}</div>
    </div>
  ),
}))
vi.mock('../components/WaitingBeat', () => ({ default: () => null }))
vi.mock('../components/PhaseAigcRow', () => ({ PhaseAigcRow: () => null }))
vi.mock('../components/QuipInspirationChips', () => ({ default: () => null }))
vi.mock('../../../components/mascot/ArchetypeHead', () => ({ default: () => null }))
vi.mock('../../../components/mascot/MissingArchetypePlaceholder', () => ({ default: () => null }))
vi.mock('../../../hooks/useMiniRevealMotion', () => ({
  useMiniRevealMotion: () => ({ shouldReduceMotion: true }),
}))
vi.mock('../hooks/useGeneratingLiveCopy', () => ({ useGeneratingLiveCopy: () => null }))
vi.mock('../hooks/useIcebreakerDraft', () => ({
  useIcebreakerDraft: () => ({
    readDraft: () => null,
    writeDraftDebounced: vi.fn(),
    clearDraft: vi.fn(),
  }),
}))

const QUIP_PROMPT = { id: 'p1', promptText: '题目一', category: '脑洞' }
const QUIP_ANSWERS = [
  { userId: 'u-target', displayName: '小鹿', answerText: '回答一', promptId: 'p1' },
  { userId: 'u-self', displayName: '我自己', answerText: '回答二', promptId: 'p1' },
]

const quipBaseProps = {
  socialSessionId: 'social-1',
  isHost: false,
  prompts: [QUIP_PROMPT],
  answers: QUIP_ANSWERS,
  userId: 'u-self',
  playerCount: 2,
  onGenerate: vi.fn(async () => ({})),
  onSubmit: vi.fn(async () => ({})),
  onVote: vi.fn(async () => ({})),
}

beforeEach(() => {
  vi.clearAllMocks()
  h.presentReport.mockClear()
  h.shouldSkipClick.mockReturnValue(false)
})

describe('E9 mount 1 — quip 投票预览 + 揭晓列表 (QuipBattleHeroView)', () => {
  it('vote-preview rows long-press reports the answer author (echo tap never flips a vote)', async () => {
    const { container, getAllByTestId, getByText } = render(
      <QuipBattleHeroView
        {...quipBaseProps}
        submittedUserIds={['u-self', 'u-target']}
        votedUserIds={[]}
      />,
    )

    // Drive the forward-only stack to the 汇总步: right = vote, left = skip.
    fireEvent.click(getAllByTestId('swipe-right')[0])
    fireEvent.click(getAllByTestId('swipe-left')[0])
    fireEvent.click(getByText('点查看'))

    const rows = container.querySelectorAll('.quip-battle-hero__vote-preview-item')
    expect(rows).toHaveLength(2)

    // Long-press the target's row → report flow fires with the locator only.
    fireEvent.contextMenu(rows[0])
    expect(h.presentReport).toHaveBeenCalledTimes(1)
    expect(h.presentReport).toHaveBeenCalledWith({
      phase: 'quip_battle',
      targetUserId: 'u-target',
      contentRef: { kind: 'quipAnswer', promptId: 'p1' },
    })

    // Baseline: right-swipe voted the target's card, left-swipe skipped mine.
    expect(screen.getAllByText('已投')).toHaveLength(1)
    expect(screen.getAllByText('未投')).toHaveLength(1)

    // WeChat fires tap after longpress — while the suppression window is
    // open, the row's vote-toggle click must be swallowed (未投 stays 未投).
    h.shouldSkipClick.mockReturnValue(true)
    fireEvent.click(container.querySelectorAll('.quip-battle-hero__vote-preview-item')[1])
    expect(screen.getAllByText('未投')).toHaveLength(1)

    // Window closed → the same click toggles the vote again.
    h.shouldSkipClick.mockReturnValue(false)
    fireEvent.click(container.querySelectorAll('.quip-battle-hero__vote-preview-item')[1])
    expect(screen.getAllByText('已投')).toHaveLength(2)
  })

  it('reveal answer rows long-press reports the answer author', () => {
    const { container } = render(
      <QuipBattleHeroView
        {...quipBaseProps}
        revealed
        submittedUserIds={['u-self', 'u-target']}
        votedUserIds={['u-self', 'u-target']}
        results={[
          {
            promptId: 'p1',
            promptText: '题目一',
            answers: QUIP_ANSWERS,
            winnerUserId: 'u-target',
            winnerDisplayName: '小鹿',
            voteCount: 1,
          },
        ]}
      />,
    )

    const rows = container.querySelectorAll('.quip-battle-hero__answer')
    expect(rows.length).toBeGreaterThanOrEqual(2)
    fireEvent.contextMenu(rows[0])
    expect(h.presentReport).toHaveBeenCalledWith({
      phase: 'quip_battle',
      targetUserId: 'u-target',
      contentRef: { kind: 'quipAnswer', promptId: 'p1' },
    })
  })
})

describe('E9 mount 2 — 卧底描述列表 (UndercoverWordHeroView)', () => {
  const undercoverProps = {
    socialSessionId: 'social-1',
    isHost: false,
    userId: 'u-self',
    pair: { civilianWord: '苹果', undercoverWord: '梨', category: '水果' },
    rounds: [
      {
        roundNumber: 1,
        descriptions: [{ userId: 'u-target', displayName: '小鹿', text: '很圆' }],
      },
    ],
    currentRound: 0,
    playerCount: 3,
    onGenerate: vi.fn(async () => ({})),
    onDescribe: vi.fn(async () => ({})),
    onVote: vi.fn(async () => ({})),
    onReveal: vi.fn(async () => ({})),
  }

  it('description rows long-press reports the describer with the domain roundNumber', () => {
    const { container } = render(<UndercoverWordHeroView {...undercoverProps} />)

    const rows = container.querySelectorAll('.undercover-hero__desc-item')
    expect(rows).toHaveLength(1)
    fireEvent.contextMenu(rows[0])
    expect(h.presentReport).toHaveBeenCalledWith({
      phase: 'undercover_word',
      targetUserId: 'u-target',
      contentRef: { kind: 'undercoverDescription', round: 1 },
    })
  })
})

describe('E9 mount 3 — 侦探陈述揭晓列表 (LieDetectiveHeroView)', () => {
  const lieProps = {
    players: [
      {
        userId: 'u-target',
        displayName: '小鹿',
        statements: [
          { index: 1, text: '我养过三只猫' },
          { index: 2, text: '我去过南极' },
          { index: 3, text: '我会弹吉他' },
        ],
      },
      {
        userId: 'u-self',
        displayName: '我自己',
        statements: [
          { index: 1, text: '甲' },
          { index: 2, text: '乙' },
          { index: 3, text: '丙' },
        ],
      },
    ],
    playerCount: 2,
    currentPlayerIndex: 0,
    votes: [],
    reveal: null,
    currentUserId: 'u-self',
    myVoteIndex: null,
    onVote: vi.fn(),
    isVoting: false,
    hasGeneratedStatements: true,
    onGenerateStatements: vi.fn(),
    isGeneratingStatements: false,
    isHost: false,
    canMoveToNextPlayer: false,
    onNextPlayer: vi.fn(),
    isMovingNextPlayer: false,
    onAdvance: vi.fn(),
    isAdvancing: false,
    onGenerateFromTag: vi.fn(async () => null),
    isGeneratingFromTag: false,
    socialSessionId: 'social-1',
  }

  it('statement cards long-press reports the current player by statement index (isLie never leaves the client)', () => {
    const { container } = render(<LieDetectiveHeroView {...lieProps} />)

    const cards = container.querySelectorAll('.lie-detective-hero__statement')
    expect(cards).toHaveLength(3)
    fireEvent.contextMenu(cards[1])
    expect(h.presentReport).toHaveBeenCalledWith({
      phase: 'lie_detective',
      targetUserId: 'u-target',
      contentRef: { kind: 'lieStatement', index: 2 },
    })
    // SEC-02: the locator carries the index only — no text, no isLie.
    const call = h.presentReport.mock.calls[0][0]
    expect(JSON.stringify(call)).not.toContain('我去过南极')
    expect(JSON.stringify(call)).not.toContain('isLie')
  })

  it('echo-tap suppression keeps the vote gesture intact', () => {
    const onVote = vi.fn()
    const { container } = render(<LieDetectiveHeroView {...lieProps} onVote={onVote} />)
    const cards = container.querySelectorAll('.lie-detective-hero__statement')

    h.shouldSkipClick.mockReturnValue(true)
    fireEvent.click(cards[0])
    expect(onVote).not.toHaveBeenCalled()

    h.shouldSkipClick.mockReturnValue(false)
    fireEvent.click(cards[0])
    expect(onVote).toHaveBeenCalledWith(1)
  })
})

describe('E9 mount 4 — 名册条昵称 (WarmupPresenceStrip ← WarmupPhaseView)', () => {
  const stripParticipants = [
    { userId: 'u-self', displayName: '我自己', isActive: true },
    { userId: 'u-target', displayName: '小鹿', isActive: true },
  ]

  it('roster items fire the injected long-press callback with the participant', () => {
    const onLongPressParticipant = vi.fn()
    const { container } = render(
      <WarmupPresenceStrip
        participants={stripParticipants}
        readyUserIds={[]}
        currentUserId='u-self'
        readyCount={0}
        totalCount={2}
        onLongPressParticipant={onLongPressParticipant}
      />,
    )

    const items = container.querySelectorAll('.warmup-presence__item')
    expect(items).toHaveLength(2)
    fireEvent.contextMenu(items[1])
    expect(onLongPressParticipant).toHaveBeenCalledTimes(1)
    expect(onLongPressParticipant).toHaveBeenCalledWith(stripParticipants[1])
  })

  it('without the callback prop no long-press handler is attached (standalone renders unchanged)', () => {
    const { container } = render(
      <WarmupPresenceStrip
        participants={stripParticipants}
        readyUserIds={[]}
        currentUserId='u-self'
        readyCount={0}
        totalCount={2}
      />,
    )
    const items = container.querySelectorAll('.warmup-presence__item')
    fireEvent.contextMenu(items[1])
    expect(h.presentReport).not.toHaveBeenCalled()
  })

  it('WarmupPhaseView wiring: the strip receives the displayName report callback at both render sites', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/pages/icebreaker-session/phases/WarmupPhaseView.tsx'),
      'utf8',
    )
    // Hook instance + callback built from the page-supplied socialSessionId.
    expect(source).toContain('useUgcReport({ socialSessionId })')
    expect(source).toContain("contentRef: { kind: 'displayName' }")
    // Both strip render sites (glance peek + default) receive the callback.
    const passes = source.match(/onLongPressParticipant=\{handleParticipantLongPress\}/g) ?? []
    expect(passes).toHaveLength(2)
  })
})
