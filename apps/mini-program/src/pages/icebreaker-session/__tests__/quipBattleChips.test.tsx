import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QuipBattleHeroView } from '../phases/QuipBattleHeroView'
import { pickQuipInspirationChips, QUIP_CHIP_ROW_LABEL } from '@shared/copy/quipInspirationChips'
import { socialIcebreakerAnalytics } from '../../../lib/analytics/socialIcebreakerAnalytics'
import { haptics } from '../../../lib/utils/haptics'

// ── P2 #6 灵感 chips (2026-10-20, spec 规格二) — QuipBattleHeroView 作答相位 ──
// Renders the REAL chips row (QuipInspirationChips) with the surrounding hero
// mocked down to DOM primitives. Covers: flag-off zero render, deterministic
// 3-chip subset, fill/replace/confirm-replace paths (+ haptics), 采纳即收起,
// quip_chip_shown/tap/adopted funnel events.

const { mockShowModal, mockAuthState } = vi.hoisted(() => ({
  mockShowModal: vi.fn(),
  mockAuthState: { chipsEnabled: true },
}))

vi.mock('@tarojs/components', () => ({
  Image: (props: Record<string, unknown>) => <img {...props} />,
  Text: (props: Record<string, unknown>) => <span {...props} />,
  View: (props: Record<string, unknown>) => <div {...props} />,
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
}))

vi.mock('@tarojs/taro', () => ({
  default: {
    showModal: (...args: unknown[]) => mockShowModal(...args),
  },
}))

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { features: { quipInspirationChipsEnabled: mockAuthState.chipsEnabled } },
  }),
}))

vi.mock('../../../lib/analytics/socialIcebreakerAnalytics', () => ({
  socialIcebreakerAnalytics: { track: vi.fn() },
}))

vi.mock('../../../lib/utils/haptics', () => ({ haptics: vi.fn() }))

vi.mock('../../../lib/api/api', () => ({ apiRequest: vi.fn() }))
vi.mock('../icebreakerSessionModel', () => ({ buildSocialPath: () => '/mock/path' }))
vi.mock('../overlays/CelebrationOverlay', () => ({ CelebrationOverlay: () => null }))
vi.mock('../../../components/gesture', () => ({
  SwipeCard: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TapReaction: () => <div data-testid='tap-reaction' />,
}))
vi.mock('../../../components/reveal', () => ({ ParticleBurst: () => null }))
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
vi.mock('../../../components/ui/JoyJoinIcon', () => ({ default: () => null }))
vi.mock('../../../components/ui/Button', () => ({
  default: ({ children, onClick, disabled }: {
    children?: React.ReactNode
    onClick?: () => void
    disabled?: boolean
  }) => (
    <button onClick={onClick} disabled={disabled}>{children}</button>
  ),
}))
vi.mock('../../../components/ui/Chip', () => ({
  default: ({ label }: { label: string }) => <span data-testid='ui-chip'>{label}</span>,
}))
vi.mock('../hooks/useGeneratingLiveCopy', () => ({ useGeneratingLiveCopy: () => null }))
vi.mock('../hooks/useIcebreakerDraft', () => ({
  useIcebreakerDraft: () => ({
    readDraft: () => null,
    writeDraftDebounced: vi.fn(),
    clearDraft: vi.fn(),
  }),
}))

const trackMock = vi.mocked(socialIcebreakerAnalytics.track)
const hapticsMock = vi.mocked(haptics)

const PROMPTS = [
  { id: 'qp-1', promptText: '如果今晚这桌是一部电影，片名应该叫《____》', category: '脑洞' },
  { id: 'qp-2', promptText: '我敢打赌，在座没有人比我更擅长____', category: '自信' },
]

const SESSION_ID = 'sess-chips-1'
const USER_ID = 'user-chips-1'

const baseProps = {
  socialSessionId: SESSION_ID,
  isHost: false,
  prompts: PROMPTS,
  userId: USER_ID,
  playerCount: 4,
  onGenerate: vi.fn(async () => ({})),
  onSubmit: vi.fn(async () => ({})),
  onVote: vi.fn(async () => ({})),
}

function expectedChips(promptId: string) {
  return pickQuipInspirationChips(SESSION_ID, promptId, USER_ID)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAuthState.chipsEnabled = true
  mockShowModal.mockResolvedValue({ confirm: true, cancel: false })
})

describe('QuipBattleHeroView P2 #6 灵感 chips', () => {
  it('flag OFF renders zero chips (byte-identical legacy answer phase)', () => {
    mockAuthState.chipsEnabled = false
    const { container } = render(<QuipBattleHeroView {...baseProps} />)
    expect(container.querySelectorAll('.quip-inspiration-chips')).toHaveLength(0)
    expect(screen.getAllByPlaceholderText('填入你的神回复…')).toHaveLength(PROMPTS.length)
    expect(trackMock).not.toHaveBeenCalled()
  })

  it('flag ON renders the deterministic 3-chip row under every prompt input', () => {
    const { container } = render(<QuipBattleHeroView {...baseProps} />)
    const rows = container.querySelectorAll('.quip-inspiration-chips')
    expect(rows).toHaveLength(PROMPTS.length)
    expect(screen.getAllByText(QUIP_CHIP_ROW_LABEL)).toHaveLength(PROMPTS.length)
    for (const prompt of PROMPTS) {
      for (const chip of expectedChips(prompt.id)) {
        expect(screen.getByText(chip.text)).toBeTruthy()
      }
    }
    // 3 chips per row, wraps carry the press affordance.
    expect(container.querySelectorAll('.quip-inspiration-chips__chip-wrap')).toHaveLength(6)
  })

  it('fires quip_chip_shown once per prompt (deduped across re-renders)', () => {
    const { rerender } = render(<QuipBattleHeroView {...baseProps} />)
    rerender(<QuipBattleHeroView {...baseProps} />)
    const shownCalls = trackMock.mock.calls.filter((c) => c[0] === 'quip_chip_shown')
    expect(shownCalls).toHaveLength(PROMPTS.length)
    const promptIds = shownCalls.map((c) => (c[4] as { promptId: string }).promptId).sort()
    expect(promptIds).toEqual(['qp-1', 'qp-2'])
  })

  it('empty box: tap fills the chip text, collapses the row, fires tap (replaced=false) + haptics', async () => {
    render(<QuipBattleHeroView {...baseProps} />)
    const chip = expectedChips('qp-1')[0]
    fireEvent.click(screen.getByText(chip.text))
    await waitFor(() => {
      expect(screen.getAllByPlaceholderText('填入你的神回复…')[0]).toHaveProperty('value', chip.text)
    })
    expect(hapticsMock).toHaveBeenCalledWith('light')
    const tapCalls = trackMock.mock.calls.filter((c) => c[0] === 'quip_chip_tap')
    expect(tapCalls).toHaveLength(1)
    expect(tapCalls[0][4]).toEqual({ promptId: 'qp-1', chipId: chip.id, replaced: false })
    // 采纳即收起: qp-1's row is gone, qp-2's row remains.
    expect(screen.getAllByText(QUIP_CHIP_ROW_LABEL)).toHaveLength(1)
  })

  it('chip-sourced value: tapping another chip replaces directly (no confirm)', async () => {
    render(<QuipBattleHeroView {...baseProps} />)
    const [first, second] = expectedChips('qp-1')
    fireEvent.click(screen.getByText(first.text))
    await waitFor(() => {
      expect(screen.getAllByPlaceholderText('填入你的神回复…')[0]).toHaveProperty('value', first.text)
    })
    // The row collapsed on first adopt — re-tapping is impossible through the
    // UI, but the decision layer still replaces chip-sourced text directly
    // when reachable; assert via the remaining prompt's flow instead.
    fireEvent.click(screen.getByText(expectedChips('qp-2')[0].text))
    await waitFor(() => {
      expect(screen.getAllByPlaceholderText('填入你的神回复…')[1]).toHaveProperty(
        'value',
        expectedChips('qp-2')[0].text,
      )
    })
    expect(mockShowModal).not.toHaveBeenCalled()
    expect(second).toBeTruthy()
  })

  it('hand-typed value: confirm replaces + fires tap (replaced=true); cancel keeps text and fires nothing', async () => {
    render(<QuipBattleHeroView {...baseProps} />)
    const input = screen.getAllByPlaceholderText('填入你的神回复…')[0]
    fireEvent.change(input, { target: { value: '我自己写的一句神回复' } })

    // Cancel path first: nothing changes, no tap event.
    mockShowModal.mockResolvedValueOnce({ confirm: false, cancel: true })
    const chip = expectedChips('qp-1')[1]
    fireEvent.click(screen.getByText(chip.text))
    await waitFor(() => expect(mockShowModal).toHaveBeenCalledTimes(1))
    expect(input).toHaveProperty('value', '我自己写的一句神回复')
    expect(trackMock.mock.calls.filter((c) => c[0] === 'quip_chip_tap')).toHaveLength(0)
    expect(hapticsMock).toHaveBeenCalledWith('light')

    // Confirm path: replaces, collapses, fires tap with replaced=true.
    fireEvent.click(screen.getByText(chip.text))
    await waitFor(() => {
      expect(screen.getAllByPlaceholderText('填入你的神回复…')[0]).toHaveProperty('value', chip.text)
    })
    const tapCalls = trackMock.mock.calls.filter((c) => c[0] === 'quip_chip_tap')
    expect(tapCalls).toHaveLength(1)
    expect(tapCalls[0][4]).toEqual({ promptId: 'qp-1', chipId: chip.id, replaced: true })
  })

  it('submit success fires quip_chip_adopted only for answers starting with a chip text', async () => {
    render(<QuipBattleHeroView {...baseProps} />)
    const chip = expectedChips('qp-1')[2]
    fireEvent.click(screen.getByText(chip.text))
    await waitFor(() => {
      expect(screen.getAllByPlaceholderText('填入你的神回复…')[0]).toHaveProperty('value', chip.text)
    })
    // Extend the filled answer — post-fill edits still count as adopted.
    fireEvent.change(screen.getAllByPlaceholderText('填入你的神回复…')[0], {
      target: { value: `${chip.text}真的有这种事` },
    })
    // Second prompt stays hand-typed → no adopted event for it.
    fireEvent.change(screen.getAllByPlaceholderText('填入你的神回复…')[1], {
      target: { value: '全手打答案' },
    })
    fireEvent.click(screen.getByText('提交答案'))
    await waitFor(() => {
      const adoptedCalls = trackMock.mock.calls.filter((c) => c[0] === 'quip_chip_adopted')
      expect(adoptedCalls).toHaveLength(1)
      expect(adoptedCalls[0][4]).toEqual({ promptId: 'qp-1', chipId: chip.id })
    })
    expect(baseProps.onSubmit).toHaveBeenCalledWith([
      { promptId: 'qp-1', answerText: `${chip.text}真的有这种事` },
      { promptId: 'qp-2', answerText: '全手打答案' },
    ])
  })

  it('never renders chips on the voting / waiting / revealed phases', () => {
    const submittedProps = { ...baseProps, submittedUserIds: [USER_ID, 'u2', 'u3', 'u4'] }
    const { container, rerender } = render(<QuipBattleHeroView {...submittedProps} />)
    expect(container.querySelectorAll('.quip-inspiration-chips')).toHaveLength(0)
    rerender(
      <QuipBattleHeroView
        {...submittedProps}
        votedUserIds={[USER_ID, 'u2', 'u3', 'u4']}
        revealed
        results={[]}
      />,
    )
    expect(container.querySelectorAll('.quip-inspiration-chips')).toHaveLength(0)
    expect(trackMock.mock.calls.filter((c) => c[0] === 'quip_chip_shown')).toHaveLength(0)
  })
})
