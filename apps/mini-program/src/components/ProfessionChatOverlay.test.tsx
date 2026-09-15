import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { shouldShowAIGCLabel } from '@joyjoin/shared/api'
import ProfessionChatOverlay from './ProfessionChatOverlay'
import { sanitizeIndustrySource } from '../lib/onboarding/professionSubmissionGuard'

// ── Behavioural harness (QA follow-up: SCALE-01 / AC-07 / AC-09) ─────────────
// The ONLY network round-trip in this surface is the first classify call. Every
// correction interaction (tray open / chip select) must stay purely local, so
// these tests drive the real component with a spy-able `apiRequest`.
const { apiRequestMock } = vi.hoisted(() => ({ apiRequestMock: vi.fn() }))

vi.mock('@tarojs/components', () => ({
  View: ({
    children,
    hoverClass: _hoverClass,
    hoverStartTime: _hoverStartTime,
    hoverStayTime: _hoverStayTime,
    ...props
  }: any) => <div {...props}>{children}</div>,
  Text: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  Input: ({ value, placeholder, onInput, className, disabled }: any) => (
    <input
      className={className}
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(event) => onInput?.({ detail: { value: event.target.value } })}
    />
  ),
  ScrollView: ({ children }: any) => <div>{children}</div>,
  Image: ({ src, className }: any) => <img className={className} src={src} />,
}))

vi.mock('@tarojs/taro', () => ({
  default: {
    getApp: vi.fn(() => ({ config: {} })),
    getNetworkType: vi.fn((options: any) => options?.success?.({ networkType: 'wifi' })),
    onNetworkStatusChange: vi.fn(),
    offNetworkStatusChange: vi.fn(),
    onKeyboardHeightChange: vi.fn(),
    offKeyboardHeightChange: vi.fn(),
    showToast: vi.fn(),
    vibrateShort: vi.fn(),
    getSystemInfoSync: vi.fn(() => ({
      brand: 'test',
      model: 'test',
      system: 'test',
      platform: 'devtools',
      screenWidth: 375,
      screenHeight: 812,
      windowWidth: 375,
      windowHeight: 667,
      statusBarHeight: 44,
      pixelRatio: 2,
      benchmarkLevel: 50,
      reduceMotion: false,
    })),
  },
  useDidShow: vi.fn(),
}))

vi.mock('../lib/api/api', () => ({
  apiRequest: (...args: unknown[]) => apiRequestMock(...args),
}))

vi.mock('../lib/utils/haptics', () => ({ haptics: vi.fn() }))

vi.mock('../hooks/onboarding/useOnboardingAnalytics', () => {
  const analytics = {
    stepStarted: vi.fn(),
    stepEnter: vi.fn(),
    stepCompleted: vi.fn(),
    stepAbandoned: vi.fn(),
    validationFailed: vi.fn(),
    errorOccurred: vi.fn(),
    interaction: vi.fn(),
    setExperiment: vi.fn(),
  }
  return { useOnboardingAnalytics: () => analytics }
})

vi.mock('../hooks/useDeviceTier', () => {
  const tier = { tier: 'primary', benchmarkLevel: null, isPrimary: true, isDegradation: false }
  return { useDeviceTier: () => tier }
})

vi.mock('../hooks/useAIGCLabelsEnabled', () => ({ useAIGCLabelsEnabled: () => false }))

vi.mock('./profession/ProfessionChatMessage', () => ({
  default: () => null,
  ProfessionTypingBubble: () => null,
}))
vi.mock('./profession/ProfessionExpressionPreloader', () => ({ default: () => null }))
vi.mock('./profession/ProfessionOverlayStatusHints', () => ({ default: () => null }))
vi.mock('./ai-content/AIGCLabel', () => ({ default: () => null }))
vi.mock('./ai-content/AIContentReportButton', () => ({ default: () => null }))
vi.mock('./ui/Chip', () => ({
  default: ({ label, onClick, className, selected }: any) => (
    <button
      type='button'
      className={className}
      data-selected={selected ? 'true' : 'false'}
      onClick={onClick}
    >
      {label}
    </button>
  ),
}))

const OVERLAY_SOURCE = readFileSync(
  resolve(process.cwd(), 'src/components/ProfessionChatOverlay.tsx'),
  'utf8',
)
const OVERLAY_STYLES = readFileSync(
  resolve(process.cwd(), 'src/components/ProfessionChatOverlay.scss'),
  'utf8',
)

describe('ProfessionChatOverlay · AIGC fail-closed (AC-12)', () => {
  it('renders no label when meta is absent (local/deterministic path)', () => {
    expect(shouldShowAIGCLabel(undefined)).toBe(false)
  })

  it('passes the server meta through instead of a hardcoded literal', () => {
    expect(OVERLAY_SOURCE).toContain('<AIGCLabel')
    expect(OVERLAY_SOURCE).toContain('meta={aigcMeta}')
    // The false-attribution bug: a hardcoded aiGenerated: true literal
    expect(OVERLAY_SOURCE).not.toMatch(/aiGenerated:\s*true/)
  })

  it('declares meta on the response + classification contracts', () => {
    // The server nests the compliance flag at `meta.aigc` (AIResponseMeta envelope)
    expect(OVERLAY_SOURCE).toMatch(/interface UnderstandProfessionResponse[\s\S]*?meta\?: AIResponseMeta/)
    expect(OVERLAY_SOURCE).toMatch(/interface ProfessionClassificationData[\s\S]*?meta\?: AIGCMeta/)
  })

  it('reads the compliance flag from meta.aigc and clears it on fallback', () => {
    expect(OVERLAY_SOURCE).toContain('data.meta?.aigc')
    expect(OVERLAY_SOURCE).toContain('setAigcMeta(aigc)')
    // fallback / low-confidence / catch paths must clear it
    expect(OVERLAY_SOURCE.match(/setAigcMeta\(undefined\)/g)?.length ?? 0).toBeGreaterThanOrEqual(4)
  })
})

describe('ProfessionChatOverlay · post-reveal input semantics (AC-14)', () => {
  it('hides the chat input once the ladder is shown', () => {
    const inputBarIndex = OVERLAY_SOURCE.indexOf("className='profession-overlay__input-bar'")
    expect(inputBarIndex).toBeGreaterThan(-1)

    const preceding = OVERLAY_SOURCE.slice(Math.max(0, inputBarIndex - 500), inputBarIndex)
    expect(preceding).toContain('{!showRevealCard && (')
  })

  it('removed the 「没识别准确？点击重新分析」 retry hint', () => {
    expect(OVERLAY_SOURCE).not.toContain('没识别准确')
    expect(OVERLAY_SOURCE).not.toContain('profession-overlay__retry-hint')
  })

  it('renders the reveal on row data, not on tag count', () => {
    expect(OVERLAY_SOURCE).toContain('{showRevealCard && ladderState && (')
    expect(OVERLAY_SOURCE).not.toContain('revealTags')
    expect(OVERLAY_SOURCE).not.toContain('removedTags')
  })
})

describe('ProfessionChatOverlay · ladder + single CTA (AC-13 / AC-15)', () => {
  it('keeps exactly one primary CTA per state', () => {
    // footer CTA stays gated behind the reveal card
    expect(OVERLAY_SOURCE).toContain('{canShowFooterConfirm && !isSubmitting && !showRevealCard && (')
    expect(OVERLAY_SOURCE).toContain('aria-label=\'确认并继续\'')
    // exactly two render sites (footer + in-card), only one visible at a time
    expect(OVERLAY_SOURCE.match(/aria-label='确认并继续'/g)?.length).toBe(2)
  })

  it('uses the unified title across all three states (AC-16)', () => {
    expect(OVERLAY_SOURCE).toContain("const LADDER_TITLE = '悦仔记下了你的职业'")
    expect(OVERLAY_SOURCE).toContain('{LADDER_TITLE}')
    expect(OVERLAY_SOURCE).not.toContain('你的活动画像已更新')
    expect(OVERLAY_SOURCE).not.toContain('已收进档案，悦仔正在细品')
  })

  it('renders unresolved rows as a dashed 待补充 pill that opens the tray (AC-15)', () => {
    expect(OVERLAY_SOURCE).toContain('profession-overlay__ladder-pending')
    expect(OVERLAY_SOURCE).toContain('{LADDER_PENDING_COPY}')
    expect(OVERLAY_STYLES).toMatch(/&__ladder-pending\s*\{[\s\S]*?border: 2rpx dashed/)
  })

  it('ships the correction tray inline with ≤3 single-select chips (C3 / AC-02)', () => {
    expect(OVERLAY_SOURCE).toContain('const MAX_CORRECTION_CANDIDATES = 3')
    expect(OVERLAY_SOURCE).toContain('candidates.slice(0, MAX_CORRECTION_CANDIDATES)')
    expect(OVERLAY_SOURCE).toContain('selected={candidate.id === row.value?.id}')
    // no multi-select / manual-input / submit semantics
    expect(OVERLAY_SOURCE).not.toContain('其他（手动输入）')
    expect(OVERLAY_SOURCE).not.toMatch(/multiselect|multiSelect/i)
  })

  it('removed the tag soup, sparkles and hand-built checkmark (AC-01)', () => {
    expect(OVERLAY_SOURCE).not.toContain('profession-overlay__sparkle')
    expect(OVERLAY_SOURCE).not.toContain('profession-overlay__celebration')
    expect(OVERLAY_SOURCE).not.toContain('profession-overlay__reveal-tags')
    expect(OVERLAY_SOURCE).not.toContain('profession-overlay__tag-feedback')
    expect(OVERLAY_SOURCE).not.toContain('reveal-checkmark-stem')
    expect(OVERLAY_SOURCE).not.toContain('reveal-checkmark-kick')
    // exactly one soft check remains
    expect(OVERLAY_SOURCE.match(/profession-overlay__reveal-check'/g)?.length).toBe(1)
    expect(OVERLAY_STYLES).not.toContain('__sparkle')
  })

  it('retired the obsolete tag-removal analytics event (OBS-02)', () => {
    expect(OVERLAY_SOURCE).not.toContain('profession_chat_tag_removed')
    expect(OVERLAY_SOURCE).toContain("profession_chat_ladder_viewed")
    expect(OVERLAY_SOURCE).toContain("profession_chat_tier_corrected")
    expect(OVERLAY_SOURCE).toContain("profession_chat_correction_opened")
  })

  it('delegates ladder state to the extracted reducer module (C1)', () => {
    expect(OVERLAY_SOURCE).toContain("from '../lib/onboarding/professionLadderReducer'")
    expect(OVERLAY_SOURCE).toContain('applyTierCorrection(')
    expect(OVERLAY_SOURCE).toContain('createLadderStateFromClassification(')
    expect(OVERLAY_SOURCE).toContain('resolveVisibleLadderRows(')
  })

  it('keeps the expanded row in viewport via ScrollView.scrollIntoView (AC-04)', () => {
    expect(OVERLAY_SOURCE).toContain('setLadderScrollTarget(`ladder-row-${tier}`)')
    expect(OVERLAY_SOURCE).toContain('scrollIntoView={scrollIntoView}')
    expect(OVERLAY_SOURCE).not.toContain('Taro.pageScrollTo')
  })
})

describe('ProfessionChatOverlay · reduced motion (AC-17)', () => {
  it('disables the ladder stagger for reduced-motion + degradation tiers', () => {
    expect(OVERLAY_STYLES).toContain('@media (prefers-reduced-motion: reduce)')
    expect(OVERLAY_STYLES).toMatch(/profession-overlay__ladder-row,[\s\S]*?animation: none/)
    expect(OVERLAY_STYLES).toMatch(/\.profession-overlay--low-end[\s\S]*?profession-overlay__ladder-row/)
  })
})

// ── QA follow-up (contract SCALE-01 / AC-07 / AC-09) ────────────────────────
// Drives the real overlay through the correction path. The correction
// candidates arrive on the FIRST classify response — opening a tray or picking
// a chip must never trigger another round-trip, and the emitted classification
// must carry user-corrected source/confidence plus the selected candidate's
// canonical id.

const CLASSIFY_RESPONSE = {
  reaction: '这个职业挺有意思的',
  reactionHint: '',
  displayTags: [],
  source: 'model',
  confidence: 0.92,
  classification: {
    category: { id: 'tech', label: '科技互联网' },
    segment: { id: 'software_dev', label: '软件开发' },
    niche: { id: 'backend', label: '后端' },
    standardizedOccupationId: 'backend_engineer',
  },
  correctionCandidates: {
    category: [
      { id: 'finance', label: '金融服务' },
      { id: 'tech', label: '科技互联网' },
    ],
    segment: [
      { id: 'ai_ml', label: '人工智能' },
      { id: 'software_dev', label: '软件开发' },
    ],
    occupation: [
      { id: 'frontend_engineer', label: '前端工程师' },
      { id: 'data_analyst', label: '数据分析师' },
    ],
  },
}

const TIER_FIXTURES = {
  category: { rowLabel: '类别', choice: { id: 'finance', label: '金融服务' } },
  segment: { rowLabel: '细分', choice: { id: 'ai_ml', label: '人工智能' } },
  // frontend_engineer is seed-mapped to niche `frontend` in the committed taxonomy,
  // so this also proves the canonical id is decoupled from industryNiche (AC-09).
  occupation: { rowLabel: '角色', choice: { id: 'frontend_engineer', label: '前端工程师' } },
} as const

function renderOverlay(onSubmit: (value: string, classification?: any) => void) {
  return render(
    <ProfessionChatOverlay
      visible
      smartProfession
      initialValue='用户体验设计师'
      onSubmit={onSubmit}
      onSkip={vi.fn()}
    />,
  )
}

async function reachRevealCard() {
  const onSubmit = vi.fn()
  const view = renderOverlay(onSubmit)
  fireEvent.click(screen.getByLabelText('发送'))
  await waitFor(
    () => expect(screen.getByText('悦仔记下了你的职业')).toBeTruthy(),
    { timeout: 3000 },
  )
  return { onSubmit, view }
}

function trayChips(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLButtonElement>('.profession-overlay__ladder-tray-chip'),
  )
}

function selectTrayChip(container: HTMLElement, label: string) {
  const chip = trayChips(container).find((element) => element.textContent === label)
  expect(chip).toBeTruthy()
  fireEvent.click(chip as HTMLButtonElement)
}

describe('ProfessionChatOverlay · correction is network-free (SCALE-01)', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
    apiRequestMock.mockResolvedValue(CLASSIFY_RESPONSE)
  })

  it('opening the 换一个 correction tray performs no network request', async () => {
    const { view } = await reachRevealCard()

    // exactly one round-trip so far — the classify call itself
    expect(apiRequestMock).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/api/inference/understand-profession' }),
    )
    expect(apiRequestMock.mock.calls.length).toBe(1)

    fireEvent.click(screen.getByLabelText('更换角色'))
    expect(apiRequestMock.mock.calls.length).toBe(1)
    // candidates come from the already-received response, not a refetch
    expect(trayChips(view.container).length).toBeGreaterThan(0)

    fireEvent.click(screen.getByLabelText('更换类别'))
    expect(apiRequestMock.mock.calls.length).toBe(1)
    expect(trayChips(view.container).length).toBeGreaterThan(0)
  })

  it('selecting a correction chip performs no network request', async () => {
    const { view } = await reachRevealCard()
    const callsAfterClassify = apiRequestMock.mock.calls.length
    expect(callsAfterClassify).toBe(1)

    fireEvent.click(screen.getByLabelText('更换角色'))
    selectTrayChip(view.container, TIER_FIXTURES.occupation.choice.label)

    expect(apiRequestMock.mock.calls.length).toBe(callsAfterClassify)
  })
})

describe('ProfessionChatOverlay · corrected payload semantics (AC-07)', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
    apiRequestMock.mockResolvedValue(CLASSIFY_RESPONSE)
  })

  it('sanitizeIndustrySource maps user→manual, fuzzy→fallback, ai→ai', () => {
    expect(sanitizeIndustrySource('user')).toBe('manual')
    expect(sanitizeIndustrySource('fuzzy')).toBe('fallback')
    expect(sanitizeIndustrySource('ai')).toBe('ai')
  })

  it.each(['category', 'segment', 'occupation'] as const)(
    'correcting the %s row emits source=user / confidence=1.0 with no mixed code/label',
    async (tier) => {
      const { onSubmit, view } = await reachRevealCard()
      const fixture = TIER_FIXTURES[tier]

      fireEvent.click(screen.getByLabelText(`更换${fixture.rowLabel}`))
      selectTrayChip(view.container, fixture.choice.label)
      fireEvent.click(screen.getByLabelText('确认并继续'))

      expect(onSubmit).toHaveBeenCalledTimes(1)
      const payload = onSubmit.mock.calls[0][1]

      expect(payload.industrySource).toBe('user')
      expect(payload.industryConfidence).toBe(1.0)
      // the emitted source round-trips to the persisted whitelist value
      expect(sanitizeIndustrySource(payload.industrySource)).toBe('manual')

      // codes and labels move together — a code never ships without its label
      expect(Boolean(payload.industryCategory)).toBe(Boolean(payload.industryCategoryLabel))
      expect(Boolean(payload.industrySegmentNew)).toBe(Boolean(payload.industrySegmentLabel))
      expect(Boolean(payload.industryNiche)).toBe(Boolean(payload.industryNicheLabel))

      if (tier === 'category') {
        expect(payload.industryCategory).toBe(fixture.choice.id)
        expect(payload.industryCategoryLabel).toBe(fixture.choice.label)
      }
      if (tier === 'segment') {
        expect(payload.industrySegmentNew).toBe(fixture.choice.id)
        expect(payload.industrySegmentLabel).toBe(fixture.choice.label)
      }
      if (tier === 'occupation') {
        expect(payload.standardizedOccupationId).toBe(fixture.choice.id)
      }
    },
  )
})

describe('ProfessionChatOverlay · corrected role id (AC-09)', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
    apiRequestMock.mockResolvedValue(CLASSIFY_RESPONSE)
  })

  it('stores the selected candidate id and keeps it decoupled from industryNiche', async () => {
    const { onSubmit, view } = await reachRevealCard()
    const candidate = CLASSIFY_RESPONSE.correctionCandidates.occupation[0]

    fireEvent.click(screen.getByLabelText('更换角色'))
    selectTrayChip(view.container, candidate.label)
    fireEvent.click(screen.getByLabelText('确认并继续'))

    const payload = onSubmit.mock.calls[0][1]

    // display = stored: the row shows this candidate's label, the payload keys on its id
    const occupationRow = view.container.querySelector('#ladder-row-occupation')
    expect(occupationRow?.querySelector('.profession-overlay__ladder-pill')?.textContent).toBe(
      candidate.label,
    )
    expect(payload.standardizedOccupationId).toBe(candidate.id)

    // never collapse the canonical occupation id onto the hidden niche id
    expect(payload.industryNiche).toBeTruthy()
    expect(payload.industryNiche).not.toBe(payload.standardizedOccupationId)
  })
})
