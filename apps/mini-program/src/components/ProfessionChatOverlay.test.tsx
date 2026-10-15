import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { shouldShowAIGCLabel } from '@joyjoin/shared/api'
import {
  formatHSLAsRGBA,
  getArchetypeHSL,
  getContrastSafeArchetypeColor,
} from '@shared/archetypeColors'
import ProfessionChatOverlay from './ProfessionChatOverlay'
import { sanitizeIndustrySource } from '../lib/onboarding/professionSubmissionGuard'
import { POOLS_QUERY_KEY } from '../lib/prefetchEngine'

// ── Behavioural harness (QA follow-up: SCALE-01 / AC-07 / AC-09) ─────────────
// The ONLY network round-trip in this surface is the first classify call. Every
// correction interaction (tray open / chip select) must stay purely local, so
// these tests drive the real component with a spy-able `apiRequest`.
const { apiRequestMock, analyticsMock } = vi.hoisted(() => ({
  apiRequestMock: vi.fn(),
  analyticsMock: {
    stepStarted: vi.fn(),
    stepEnter: vi.fn(),
    stepCompleted: vi.fn(),
    stepAbandoned: vi.fn(),
    validationFailed: vi.fn(),
    errorOccurred: vi.fn(),
    interaction: vi.fn(),
    setExperiment: vi.fn(),
  },
}))

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

vi.mock('../hooks/onboarding/useOnboardingAnalytics', () => ({
  useOnboardingAnalytics: () => analyticsMock,
}))

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
  default: ({ label, onClick, className, selected, ariaLabel }: any) => (
    <button
      type='button'
      className={className}
      data-selected={selected ? 'true' : 'false'}
      aria-label={ariaLabel}
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
const STATUS_HINTS_SOURCE = readFileSync(
  resolve(process.cwd(), 'src/components/profession/ProfessionOverlayStatusHints.tsx'),
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

interface RenderOverlayOptions {
  onSkip?: () => void
  userCity?: string
  userArchetype?: string
  /** Seeds the shared pools feed cache (read-only mirror, never fetched). */
  pools?: Array<Record<string, unknown>>
}

function renderOverlay(
  onSubmit: (value: string, classification?: any) => void,
  options: RenderOverlayOptions = {},
) {
  const queryClient = new QueryClient()
  if (options.pools) {
    queryClient.setQueryData(POOLS_QUERY_KEY, options.pools)
  }
  return render(
    <QueryClientProvider client={queryClient}>
      <ProfessionChatOverlay
        visible
        smartProfession
        initialValue='用户体验设计师'
        userCity={options.userCity}
        userArchetype={options.userArchetype}
        onSubmit={onSubmit}
        onSkip={options.onSkip ?? vi.fn()}
      />
    </QueryClientProvider>,
  )
}

async function reachRevealCard(options: RenderOverlayOptions = {}) {
  const onSubmit = vi.fn()
  const view = renderOverlay(onSubmit, options)
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

// ── Pre-ship review fixes (2026-09-15) ──────────────────────────────────────

describe('ProfessionChatOverlay · one-shot scroll targets (tray scroll-yank fix)', () => {
  it('never falls back to bottom-anchor when the ladder target clears', () => {
    // The old memo `scrollTrigger > 0 ? 'bottom-anchor' : ''` latched: once the
    // 600ms timer cleared the ladder target, the prop flipped back to
    // 'bottom-anchor' and the re-triggered scroll yanked the open tray away.
    expect(OVERLAY_SOURCE).not.toContain("scrollTrigger > 0 ? 'bottom-anchor'")
    // bottom-anchor is its own one-shot with the same 600ms clear pattern
    expect(OVERLAY_SOURCE).toContain("setBottomScrollTarget('bottom-anchor')")
    expect(OVERLAY_SOURCE).toMatch(/setTimeout\(\(\) => setBottomScrollTarget\(''\), 600\)/)
    // clearing the ladder target now yields '' — no competing anchor
    expect(OVERLAY_SOURCE).toContain('ladderScrollTarget || bottomScrollTarget')
  })
})

describe('ProfessionChatOverlay · stale candidate re-scoping (REL-01)', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
    apiRequestMock.mockResolvedValue(CLASSIFY_RESPONSE)
  })

  it('drops pre-correction segment/occupation candidates after a 类别 correction', async () => {
    const { view } = await reachRevealCard()

    fireEvent.click(screen.getByLabelText('更换类别'))
    selectTrayChip(view.container, TIER_FIXTURES.category.choice.label)

    // §6.5 选中确认 + cascade explainer appear under the corrected row
    expect(screen.getByText('好，记下了')).toBeTruthy()
    expect(screen.getByText('下面两行也要再确认一下')).toBeTruthy()

    // the segment/occupation candidates were scoped to 科技互联网 — after the
    // correction both child trays are honestly empty and non-interactive
    const segmentChange = screen.getByLabelText('更换细分')
    expect(segmentChange.className).toContain('profession-overlay__ladder-change--disabled')
    fireEvent.click(segmentChange)
    expect(trayChips(view.container).length).toBe(0)

    const pendingSegment = screen.getByLabelText('补充细分')
    expect(pendingSegment.getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(pendingSegment)
    expect(trayChips(view.container).length).toBe(0)
  })
})

describe('ProfessionChatOverlay · pending-pill affordance (false-affordance fix)', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('renders 待补充 non-interactive when the row has no candidates, and hides the benefit hint', async () => {
    apiRequestMock.mockResolvedValue({
      ...CLASSIFY_RESPONSE,
      classification: {
        category: { id: 'tech', label: '科技互联网' },
        segment: null,
        niche: null,
        standardizedOccupationId: null,
      },
      correctionCandidates: undefined,
    })
    const { view } = await reachRevealCard()

    for (const label of ['补充细分', '补充角色']) {
      const pill = screen.getByLabelText(label)
      expect(pill.getAttribute('aria-disabled')).toBe('true')
      expect(pill.className).toContain('profession-overlay__ladder-pending--disabled')
      fireEvent.click(pill)
      // dead tap removed: no tray opens
      expect(trayChips(view.container).length).toBe(0)
    }

    // no row is fillable → the benefit hint must not invite an impossible action
    expect(screen.queryByText('补上职业方向，之后能进更对味的局')).toBeNull()
  })

  it('keeps 待补充 interactive and shows the benefit hint when candidates exist', async () => {
    apiRequestMock.mockResolvedValue({
      ...CLASSIFY_RESPONSE,
      classification: {
        category: { id: 'tech', label: '科技互联网' },
        segment: null,
        niche: null,
        standardizedOccupationId: null,
      },
      correctionCandidates: {
        segment: [
          { id: 'ai_ml', label: '人工智能' },
          { id: 'software_dev', label: '软件开发' },
        ],
      },
    })
    const { view } = await reachRevealCard()

    const pill = screen.getByLabelText('补充细分')
    expect(pill.getAttribute('aria-disabled')).toBe('false')
    expect(pill.className).not.toContain('profession-overlay__ladder-pending--disabled')

    fireEvent.click(pill)
    expect(trayChips(view.container).length).toBe(2)

    // at least one row is fillable → the benefit hint shows
    expect(screen.getByText('补上职业方向，之后能进更对味的局')).toBeTruthy()
  })

  it('keeps the 88rpx tap floor and disabled styling for the pending pill', () => {
    expect(OVERLAY_STYLES).toMatch(/&__ladder-pending\s*\{[\s\S]*?min-height: \$cta-min-tap/)
    expect(OVERLAY_STYLES).toMatch(/&__ladder-pending[\s\S]*?&--disabled\s*\{[\s\S]*?pointer-events: none/)
  })
})

describe('ProfessionChatOverlay · selection acknowledgment (§6.5)', () => {
  it('ships the ack + cascade copy and reduced-motion coverage for the new elements', () => {
    expect(OVERLAY_SOURCE).toContain("const LADDER_ACK_COPY = '好，记下了'")
    expect(OVERLAY_SOURCE).toContain("'下面两行也要再确认一下'")
    expect(OVERLAY_SOURCE).toContain('profession-overlay__ladder-ack')
    expect(OVERLAY_SOURCE).not.toContain('showToast({ title: \'好，记下了')
    // new classes are defined and killed under reduced-motion / low-end tiers
    expect(OVERLAY_STYLES).toContain('&__ladder-ack')
    expect(OVERLAY_STYLES).toContain('&__ladder-cascade-hint')
    expect(OVERLAY_STYLES.match(/profession-overlay__ladder-ack,/g)?.length ?? 0).toBeGreaterThanOrEqual(3)
  })
})

// ── Read-only trait tag section (2026-10-14) ────────────────────────────────

describe('ProfessionChatOverlay · read-only trait tag section', () => {
  it('delegates tag derivation to the pure helper and ships the analytics event', () => {
    expect(OVERLAY_SOURCE).toContain("from '../lib/onboarding/professionTraitTags'")
    expect(OVERLAY_SOURCE).toContain('deriveProfessionTraitTagGroups(')
    expect(OVERLAY_SOURCE).toContain('profession_chat_trait_tags_shown')
    // counts only, never tag text (§11 metadata discipline)
    expect(OVERLAY_SOURCE).toContain('archetypeCount')
    expect(OVERLAY_SOURCE).toContain('impressionCount')
  })

  it('gates 印象 chips on meta.aigc.aiGenerated and passes ladder labels for filtering', () => {
    expect(OVERLAY_SOURCE).toContain('aiGenerated: aigcMeta?.aiGenerated === true')
    expect(OVERLAY_SOURCE).toContain('ladderRowLabels')
  })

  it('keeps the section read-only — no tap/remove affordance on the new pills', () => {
    const sectionStart = OVERLAY_SOURCE.indexOf("profession-overlay__trait-section")
    expect(sectionStart).toBeGreaterThan(-1)
    // The benefit hint moved ABOVE the tag section (design pass 2026-10-14);
    // the section now ends at the fallback-hint block.
    const sectionEnd = OVERLAY_SOURCE.indexOf('{isFallbackSource && (', sectionStart)
    const section = OVERLAY_SOURCE.slice(sectionStart, sectionEnd)
    expect(section).not.toContain('onClick')
    expect(section).not.toContain('hoverClass')
    expect(section).not.toContain('selected')
  })

  it('defines every new BEM class and kills the animation under reduced-motion / low-end', () => {
    for (const klass of [
      '&__trait-section',
      '&__trait-group',
      '&__trait-group-head',
      '&__trait-group-mark',
      '&__trait-group-label',
      '&__trait-row',
      '&__trait-pill',
      '&__trait-pill-dot',
      '&__trait-pill-text',
    ]) {
      expect(OVERLAY_STYLES).toContain(klass)
    }
    expect(OVERLAY_STYLES).toContain('@keyframes profession-trait-pill-pop-in')
    // static fallback in all three degradation blocks (low-end + media + class)
    expect(
      OVERLAY_STYLES.match(/\.profession-overlay__trait-pill \{/g)?.length ?? 0,
    ).toBeGreaterThanOrEqual(2)
    expect(
      OVERLAY_STYLES.match(/\.profession-overlay__trait-pill,/g)?.length ?? 0,
    ).toBeGreaterThanOrEqual(3)
    expect(
      OVERLAY_STYLES.match(/\.profession-overlay__trait-group-head,/g)?.length ?? 0,
    ).toBeGreaterThanOrEqual(3)
  })
})

describe('ProfessionChatOverlay · trait tag behaviour', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('renders 特质 chips from archetypeContext and AIGC-gated 印象 chips (ladder-filtered)', async () => {
    apiRequestMock.mockResolvedValue({
      ...CLASSIFY_RESPONSE,
      displayTags: ['后端工程师', '逻辑清晰', '靠谱'],
      archetypeContext: { primaryArchetype: 'corgi', traits: ['能量充沛', '幽默感强'] },
      meta: { aigc: { aiGenerated: true } },
    })
    const { view } = await reachRevealCard()

    // 特质 group — server traits render under 「你的特质」
    expect(screen.getByText('你的特质')).toBeTruthy()
    expect(screen.getByText('能量充沛')).toBeTruthy()
    expect(screen.getByText('幽默感强')).toBeTruthy()

    // 印象 group — 「后端工程师」 duplicates the 角色 row and must be filtered
    expect(screen.getByText('悦仔的印象')).toBeTruthy()
    const impressions = Array.from(
      view.container.querySelectorAll('.profession-overlay__trait-pill--impression'),
    ).map((el) => el.textContent)
    expect(impressions).toEqual(['逻辑清晰', '靠谱'])

    // read-only: the pills render as plain views, never as the tappable Chip mock
    const pill = view.container.querySelector('.profession-overlay__trait-pill')
    expect(pill?.tagName).toBe('DIV')
  })

  it('renders no 印象 chips when meta.aigc.aiGenerated is not true (fail-closed)', async () => {
    apiRequestMock.mockResolvedValue({
      ...CLASSIFY_RESPONSE,
      displayTags: ['逻辑清晰'],
      archetypeContext: { primaryArchetype: 'corgi', traits: ['能量充沛'] },
      meta: { aigc: { aiGenerated: false } },
    })
    await reachRevealCard()

    expect(screen.getByText('你的特质')).toBeTruthy()
    expect(screen.getByText('能量充沛')).toBeTruthy()
    expect(screen.queryByText('悦仔的印象')).toBeNull()
    expect(screen.queryByText('逻辑清晰')).toBeNull()
  })
})

describe('ProfessionChatOverlay · 角色 niche fallback (display vs persistence)', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
    apiRequestMock.mockResolvedValue({
      ...CLASSIFY_RESPONSE,
      classification: {
        category: { id: 'finance', label: '金融服务' },
        segment: { id: 'investment_banking', label: '投资银行' },
        niche: { id: 'ma_advisory', label: '并购顾问' },
        standardizedOccupationId: null,
      },
      correctionCandidates: undefined,
    })
  })

  it('shows the resolved niche on the 角色 row instead of 待补充', async () => {
    const { view } = await reachRevealCard()

    const occupationRow = view.container.querySelector('#ladder-row-occupation')
    expect(occupationRow?.querySelector('.profession-overlay__ladder-pill')?.textContent).toBe(
      '并购顾问',
    )
    expect(occupationRow?.querySelector('.profession-overlay__ladder-pending')).toBeNull()
  })

  it('keeps standardizedOccupationId null on submit — the niche id only persists via industryNiche', async () => {
    const { onSubmit } = await reachRevealCard()
    fireEvent.click(screen.getByLabelText('确认并继续'))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    const payload = onSubmit.mock.calls[0][1]
    expect(payload.standardizedOccupationId).toBeNull()
    expect(payload.industryNiche).toBe('ma_advisory')
    expect(payload.industryNicheLabel).toBe('并购顾问')
    expect(payload.industrySource).toBe(CLASSIFY_RESPONSE.source)
  })
})

// ── Design quick wins (2026-10-14 design audit) ─────────────────────────────

describe('ProfessionChatOverlay · design quick wins (WS1)', () => {
  it('inverts the ladder hierarchy — value pills out-rank the row micro-labels', () => {
    expect(OVERLAY_STYLES).toMatch(
      /\.chip__label\s*\{[\s\S]*?font-size: \$font-size-base;[\s\S]*?font-weight: \$font-weight-medium;[\s\S]*?color: \$color-text-primary;/,
    )
    // dead level prop removed from the ladder value Chip (level styles only
    // apply under .chip--selected — it was visual noise here)
    expect(OVERLAY_SOURCE).not.toMatch(/label=\{row\.value\.label\}[\s\S]{0,120}?level=\{1\}/)
  })

  it('gives the resolved pill tap-to-correct affordance + an honest static modifier', () => {
    expect(OVERLAY_SOURCE).toContain('onClick={hasCandidates ? () => handleOpenCorrection(row.tier) : undefined}')
    expect(OVERLAY_SOURCE).toContain("`更换${row.label}：${row.value.label}`")
    expect(OVERLAY_SOURCE).toContain("'profession-overlay__ladder-pill--static'")
    // static modifier neutralizes the Chip active transform + tap shimmer
    expect(OVERLAY_STYLES).toMatch(/&--static\s*\{[\s\S]*?&\.chip:active\s*\{\s*transform: none;/)
    expect(OVERLAY_STYLES).toMatch(/&\.chip::before\s*\{\s*content: none;/)
  })

  it('fills the value column with the dashed pending pill + bumps its text', () => {
    expect(OVERLAY_STYLES).toMatch(/&__ladder-pending\s*\{[\s\S]*?flex: 1;/)
    expect(OVERLAY_STYLES).toMatch(/&__ladder-pending-text\s*\{\s*font-size: \$font-size-sm;/)
  })

  it('lifts the reveal card (32rpx radius, brand shadow, fallback shadow variant)', () => {
    expect(OVERLAY_STYLES).toMatch(/&__reveal-card\s*\{[\s\S]*?border-radius: \$card-radius;/)
    expect(OVERLAY_STYLES).toMatch(/&__reveal-card\s*\{[\s\S]*?box-shadow: 0 16rpx 48rpx rgba\(\$color-primary, 0\.10\);/)
    expect(OVERLAY_STYLES).toMatch(/&--fallback\s*\{[\s\S]*?box-shadow: 0 16rpx 48rpx rgba\(\$color-warning, 0\.10\);/)
    // @include safe-area-inline removed — the card inherits it from &__chat
    const cardStart = OVERLAY_STYLES.indexOf('&__reveal-card {')
    const cardEnd = OVERLAY_STYLES.indexOf('&__reveal-title-row', cardStart)
    expect(OVERLAY_STYLES.slice(cardStart, cardEnd)).not.toContain('@include safe-area-inline')
  })

  it('sets the title in the display font at 36rpx bold', () => {
    expect(OVERLAY_STYLES).toMatch(
      /&__reveal-title\s*\{[\s\S]*?font-family: \$font-cn-display;[\s\S]*?font-size: \$font-size-lg;[\s\S]*?font-weight: \$font-weight-bold;/,
    )
  })

  it('places the benefit hint directly after the ladder, before the tag section', () => {
    const hintIndex = OVERLAY_SOURCE.indexOf('{showBenefitHint && (')
    const traitIndex = OVERLAY_SOURCE.indexOf("profession-overlay__trait-section")
    expect(hintIndex).toBeGreaterThan(-1)
    expect(traitIndex).toBeGreaterThan(-1)
    expect(hintIndex).toBeLessThan(traitIndex)
  })

  it('keeps the deepened bridge accent with no dormant chemistry modifier', () => {
    expect(OVERLAY_STYLES).toMatch(/&__reveal-bridge\s*\{[\s\S]*?border-left: 4rpx solid rgba\(\$color-primary, 0\.45\);/)
    // Cleanup lock (2026-10-15): the old bridge-line chemistry modifier was
    // retired when the banner took its place — it must not creep back in.
    expect(OVERLAY_STYLES).not.toContain('&--chemistry')
  })

  it('turns the soft check into a corner badge on the avatar', () => {
    expect(OVERLAY_STYLES).toMatch(
      /&__reveal-check\s*\{[\s\S]*?position: absolute;[\s\S]*?right: -4rpx;[\s\S]*?bottom: -4rpx;[\s\S]*?border: 4rpx solid \$color-surface;/,
    )
    expect(OVERLAY_STYLES).toMatch(/&__reveal-mascot\s*\{[\s\S]*?position: relative;[\s\S]*?overflow: visible;/)
    expect(OVERLAY_STYLES).toMatch(/&__reveal-mascot-img\s*\{[\s\S]*?border-radius: 50%;/)
    // the badge is nested inside the mascot wrapper in the TSX
    const mascotStart = OVERLAY_SOURCE.indexOf("profession-overlay__reveal-mascot'")
    const titleRowEnd = OVERLAY_SOURCE.indexOf('profession-overlay__reveal-aigc', mascotStart)
    expect(OVERLAY_SOURCE.slice(mascotStart, titleRowEnd)).toContain('profession-overlay__reveal-check')
  })

  it('quiets the 换一个 affordance (22rpx, normal weight) while keeping the tap height', () => {
    expect(OVERLAY_STYLES).toMatch(/&__ladder-change-text\s*\{\s*font-size: \$font-size-xs;[\s\S]*?font-weight: \$font-weight-normal;/)
    expect(OVERLAY_STYLES).toMatch(/&__ladder-change\s*\{[\s\S]*?min-height: \$cta-min-tap;/)
  })
})

describe('ProfessionChatOverlay · resolved pill behaviour (WS1)', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
    apiRequestMock.mockResolvedValue(CLASSIFY_RESPONSE)
    analyticsMock.interaction.mockClear()
  })

  it('opens the correction tray when a resolved ladder pill is tapped', async () => {
    const { view } = await reachRevealCard()
    const pill = view.container.querySelector(
      '#ladder-row-occupation .profession-overlay__ladder-pill',
    ) as HTMLElement
    expect(pill).toBeTruthy()
    expect(pill.className).not.toContain('--static')
    fireEvent.click(pill)
    expect(trayChips(view.container).length).toBeGreaterThan(0)
  })

  it('marks resolved pills static when the row has no candidates — tap is a no-op', async () => {
    apiRequestMock.mockResolvedValue({ ...CLASSIFY_RESPONSE, correctionCandidates: undefined })
    const { view } = await reachRevealCard()
    const pill = view.container.querySelector(
      '#ladder-row-occupation .profession-overlay__ladder-pill',
    ) as HTMLElement
    expect(pill.className).toContain('profession-overlay__ladder-pill--static')
    fireEvent.click(pill)
    expect(trayChips(view.container).length).toBe(0)
  })
})

// ── Signature choreography (write-in sweep, 2026-10-14) ─────────────────────

describe('ProfessionChatOverlay · reveal choreography (WS2)', () => {
  it('ships the new keyframes, staggered delays, and a ≤1.2s envelope', () => {
    expect(OVERLAY_STYLES).toContain('@keyframes profession-pill-sweep')
    expect(OVERLAY_STYLES).toContain('@keyframes profession-fade-rise')
    expect(OVERLAY_STYLES).toContain('@keyframes profession-reveal-title-fade')
    // ladder rows staged at 0.18 / 0.24 / 0.30
    expect(OVERLAY_STYLES).toContain('&:nth-child(1) { animation-delay: 0.18s; }')
    expect(OVERLAY_STYLES).toContain('&:nth-child(2) { animation-delay: 0.24s; }')
    expect(OVERLAY_STYLES).toContain('&:nth-child(3) { animation-delay: 0.3s; }')
    // write-in sweep cascade 0.46 / 0.58 / 0.70 with a 0.45s duration
    expect(OVERLAY_STYLES).toContain('animation-delay: 0.46s;')
    expect(OVERLAY_STYLES).toContain('animation-delay: 0.58s;')
    expect(OVERLAY_STYLES).toContain('animation-delay: 0.7s;')
    expect(OVERLAY_STYLES).toMatch(/animation: profession-pill-sweep 0\.45s/)
    // bridge + CTA closing beats
    expect(OVERLAY_STYLES).toContain('0.72s backwards')
    expect(OVERLAY_STYLES).toContain('0.8s backwards')
    // envelope: last beat is the CTA at 0.80s + 0.35s = 1.15s ≤ 1.2s
    expect(OVERLAY_STYLES).toMatch(/animation: profession-fade-rise 0\.35s[^;]*0\.8s backwards;/)
  })

  it('registers every new animated class in all three degradation blocks', () => {
    // identical static end-states: low-end + prefers-reduced-motion + --reduce-motion
    expect(OVERLAY_STYLES.match(/\.profession-overlay__reveal-title,/g)?.length).toBe(3)
    expect(OVERLAY_STYLES.match(/\.profession-overlay__reveal-bridge,/g)?.length).toBe(3)
    expect(OVERLAY_STYLES.match(/\.profession-overlay__reveal-confirm \{/g)?.length).toBe(3)
    expect(OVERLAY_STYLES.match(/\.profession-overlay__ladder-pill--sweep::after \{/g)?.length).toBe(3)
    // the sweep pseudo-element is fully removed (content: none) in degraded modes
    expect(OVERLAY_STYLES).toMatch(
      /\.profession-overlay__ladder-pill--sweep::after \{\s*content: none;\s*animation: none;/,
    )
    // no permanent will-change anywhere (only `will-change: auto` resets allowed)
    expect(OVERLAY_STYLES).not.toMatch(/will-change:\s*(?!auto\b)[a-z-]+/)
  })

  it('keeps the confirm CTA pressed feedback intact (backwards fill, not forwards)', () => {
    const confirmStart = OVERLAY_STYLES.indexOf('&__reveal-confirm {')
    const confirmEnd = OVERLAY_STYLES.indexOf('@keyframes profession-fade-rise', confirmStart)
    const block = OVERLAY_STYLES.slice(confirmStart, confirmEnd)
    expect(block).toContain('backwards;')
    expect(block).not.toContain('forwards;')
  })
})

describe('ProfessionChatOverlay · write-in sweep is one-shot (WS2)', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
    apiRequestMock.mockResolvedValue(CLASSIFY_RESPONSE)
    analyticsMock.interaction.mockClear()
  })

  it('applies the sweep class on initial reveal and clears it on the first correction', async () => {
    const { view } = await reachRevealCard()
    // every resolved pill carries the sweep on the initial reveal
    expect(view.container.querySelectorAll('.profession-overlay__ladder-pill--sweep').length).toBe(3)

    fireEvent.click(screen.getByLabelText('更换角色'))
    selectTrayChip(view.container, TIER_FIXTURES.occupation.choice.label)

    // after any correction the sweep can never re-fire (tray open/close safe)
    expect(view.container.querySelectorAll('.profession-overlay__ladder-pill--sweep').length).toBe(0)

    // re-opening a tray must not re-arm it either
    fireEvent.click(screen.getByLabelText('更换角色'))
    expect(view.container.querySelectorAll('.profession-overlay__ladder-pill--sweep').length).toBe(0)
  })
})

// ── Flow fixes (PM audit R2 / R3 / R6) ──────────────────────────────────────

describe('ProfessionChatOverlay · R2 measurement enrichment', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
    apiRequestMock.mockResolvedValue(CLASSIFY_RESPONSE)
    analyticsMock.interaction.mockClear()
  })

  it('enriches profession_chat_classification_success with pendingRowCount + durationMs', async () => {
    await reachRevealCard()
    expect(analyticsMock.interaction).toHaveBeenCalledWith(
      'profession_chat_classification_success',
      expect.objectContaining({
        pendingRowCount: 0,
        durationMs: expect.any(Number),
      }),
    )
  })

  it('enriches profession_chat_confirmed with pendingRowCount + durationMs', async () => {
    apiRequestMock.mockResolvedValue({
      ...CLASSIFY_RESPONSE,
      classification: {
        category: { id: 'tech', label: '科技互联网' },
        segment: null,
        niche: null,
        standardizedOccupationId: null,
      },
      correctionCandidates: {
        segment: [{ id: 'ai_ml', label: '人工智能' }],
      },
    })
    await reachRevealCard()
    analyticsMock.interaction.mockClear()
    fireEvent.click(screen.getByLabelText('确认并继续'))
    expect(analyticsMock.interaction).toHaveBeenCalledWith(
      'profession_chat_confirmed',
      expect.objectContaining({
        pendingRowCount: 2,
        durationMs: expect.any(Number),
      }),
    )
  })

  it('enriches profession_chat_skipped with sendCount / hadClassification / source / dwellMs', async () => {
    const onSkip = vi.fn()
    await reachRevealCard({ onSkip })
    analyticsMock.interaction.mockClear()
    // two-tap guard: arm, then execute
    fireEvent.click(screen.getByLabelText('跳过职业输入'))
    fireEvent.click(screen.getByLabelText('仍要跳过？已分析的结果会清空'))
    expect(analyticsMock.interaction).toHaveBeenCalledWith(
      'profession_chat_skipped',
      expect.objectContaining({
        sendCount: 1,
        hadClassification: true,
        source: 'model',
        dwellMs: expect.any(Number),
      }),
    )
  })

  it('fires profession_field_tapped from the essential-data picker (source wiring)', () => {
    const pageSource = readFileSync(
      resolve(process.cwd(), 'src/pages/onboarding/essential-data/index.tsx'),
      'utf8',
    )
    expect(pageSource).toContain("'profession_field_tapped'")
    expect(pageSource).toContain('hasPrefill: professionText')
    expect(pageSource).toContain('intent,')
  })
})

describe('ProfessionChatOverlay · R3 skip guard', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
    apiRequestMock.mockResolvedValue(CLASSIFY_RESPONSE)
    analyticsMock.interaction.mockClear()
  })

  it('stays one-tap before the reveal card', async () => {
    const onSkip = vi.fn()
    renderOverlay(vi.fn(), { onSkip })
    fireEvent.click(screen.getByLabelText('跳过职业输入'))
    await waitFor(() => expect(onSkip).toHaveBeenCalledTimes(1), { timeout: 1500 })
  })

  it('becomes a two-tap confirm once the reveal card is up', async () => {
    const onSkip = vi.fn()
    await reachRevealCard({ onSkip })

    // first tap — arms, swaps the label, does NOT skip
    fireEvent.click(screen.getByLabelText('跳过职业输入'))
    expect(onSkip).not.toHaveBeenCalled()
    expect(screen.getByText('仍要跳过？已分析的结果会清空')).toBeTruthy()

    // second tap — executes
    fireEvent.click(screen.getByLabelText('仍要跳过？已分析的结果会清空'))
    await waitFor(() => expect(onSkip).toHaveBeenCalledTimes(1), { timeout: 1500 })
  })

  it('auto-reverts the armed label after 3s (source wiring)', () => {
    expect(OVERLAY_SOURCE).toContain('SKIP_ARM_REVERT_MS')
    expect(OVERLAY_SOURCE).toMatch(/setTimeout\(\(\) => setSkipArmed\(false\), SKIP_ARM_REVERT_MS\)/)
    const helpersSource = readFileSync(
      resolve(process.cwd(), 'src/lib/onboarding/professionOverlayHelpers.ts'),
      'utf8',
    )
    expect(helpersSource).toContain('SKIP_ARM_REVERT_MS = 3000')
    const copySource = readFileSync(
      resolve(process.cwd(), 'src/lib/onboarding/professionOverlayCopy.ts'),
      'utf8',
    )
    expect(copySource).toContain("SKIP_ARMED_COPY = '仍要跳过？已分析的结果会清空'")
  })
})

describe('ProfessionChatOverlay · R6 quota + dead end', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
    analyticsMock.interaction.mockClear()
  })

  it('refunds send quota on BOTH the catch path and the low-confidence block', () => {
    const refunds = OVERLAY_SOURCE.match(
      /sendCountRef\.current = Math\.max\(0, sendCountRef\.current - 1\)/g,
    )
    expect(refunds?.length).toBe(2)
  })

  it('never hits the max-send wall across five refunded low-confidence sends', async () => {
    vi.useFakeTimers()
    try {
      apiRequestMock.mockResolvedValue({
        ...CLASSIFY_RESPONSE,
        confidence: 0.1, // structured but below MIN_STRUCTURED_CONFIDENCE → blocked
      })
      const view = renderOverlay(vi.fn())
      const input = view.container.querySelector('.profession-overlay__input') as HTMLInputElement
      expect(input).toBeTruthy()

      for (let i = 0; i < 5; i++) {
        fireEvent.change(input, { target: { value: `星际架构师${i}号` } })
        fireEvent.click(screen.getByLabelText('发送'))
        // stagger (400ms) settles the blocked branch
        await vi.advanceTimersByTimeAsync(500)
        // debounce window (DEBOUNCE_MS = 2000) before the next send
        await vi.advanceTimersByTimeAsync(2100)
      }

      expect(apiRequestMock).toHaveBeenCalledTimes(5)
      expect(
        analyticsMock.interaction.mock.calls.filter(
          ([event]) => event === 'profession_chat_low_confidence_blocked',
        ).length,
      ).toBe(5)
      expect(
        analyticsMock.interaction.mock.calls.some(
          ([event]) => event === 'profession_chat_max_send_reached',
        ),
      ).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  }, 15000)

  it('ships the R6 dead-end banner copy + tappable skip wiring', () => {
    // the banner component owns the copy swap + tap execution
    expect(STATUS_HINTS_SOURCE).toContain('MAX_SEND_SKIP_BANNER_COPY')
    expect(STATUS_HINTS_SOURCE).toContain('profession-overlay__max-send-hint--action')
    expect(STATUS_HINTS_SOURCE).toContain('onMaxSendSkip()')
    // the overlay gates it on "no usable classification" and wires the skip
    expect(OVERLAY_SOURCE).toContain(
      'maxSendSkippable={!isUsableStoredProfessionClassification(classificationData)}',
    )
    expect(OVERLAY_SOURCE).toContain('onMaxSendSkip={handleMaxSendSkip}')
    expect(OVERLAY_SOURCE).toMatch(/handleMaxSendSkip[\s\S]*?setShowMaxSendHint\(false\)[\s\S]*?handleSkip\(\)/)
    // copy constant lives in the shared copy deck (consolidated 2026-10-15)
    const copySource = readFileSync(
      resolve(process.cwd(), 'src/lib/onboarding/professionOverlayCopy.ts'),
      'utf8',
    )
    expect(copySource).toContain("'悦仔暂时没读懂这题～先跳过，之后随时能在个人主页补充'")
    // banner styles ship in this change (class-coverage gate) — nested &--action
    // modifiers compile to profession-overlay__max-send-hint--action / --active
    expect(OVERLAY_STYLES).toMatch(/&__max-send-hint\s*\{[\s\S]*?&--action\s*\{/)
    expect(OVERLAY_STYLES).toContain('.profession-overlay__max-send-hint--active')
    expect(OVERLAY_STYLES).toMatch(/&__max-send-hint-text\s*\{[\s\S]*?&--action\s*\{/)
  })
})

// ── Truthful 同城排桌线 (commercialization #1) ──────────────────────────────

describe('ProfessionChatOverlay · truthful 同城排桌线 (WS4)', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
    apiRequestMock.mockResolvedValue(CLASSIFY_RESPONSE)
    analyticsMock.interaction.mockClear()
  })

  const inDays = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()

  it('renders the cached city pool count when city + data are available', async () => {
    await reachRevealCard({
      userCity: '深圳',
      pools: [
        { id: 'p1', city: '深圳', dateTime: inDays(2) },
        { id: 'p2', city: '深圳', dateTime: inDays(5) },
        { id: 'p3', city: '广州', dateTime: inDays(2) }, // other city
        { id: 'p4', city: '深圳', dateTime: inDays(10) }, // outside the 7d window
        { id: 'p5', city: '深圳', dateTime: inDays(-1) }, // past — not 在排桌
      ],
    })
    expect(screen.getByText('本周深圳有 2 场局在排桌')).toBeTruthy()
    expect(screen.queryByText(/JoyJoin 里还有很多/)).toBeNull()
  })

  it('falls back to the generic line when the pools cache is cold', async () => {
    await reachRevealCard({ userCity: '深圳' })
    expect(screen.getByText(/JoyJoin 里还有很多科技互联网方向的小伙伴/)).toBeTruthy()
    expect(screen.queryByText(/场局在排桌/)).toBeNull()
  })

  it('falls back to the generic line when the city is unknown', async () => {
    await reachRevealCard({
      pools: [{ id: 'p1', city: '深圳', dateTime: inDays(2) }],
    })
    expect(screen.getByText(/JoyJoin 里还有很多科技互联网方向的小伙伴/)).toBeTruthy()
    expect(screen.queryByText(/场局在排桌/)).toBeNull()
  })

  it('falls back to the generic line when N = 0 (never a fabricated 0)', async () => {
    await reachRevealCard({
      userCity: '深圳',
      pools: [{ id: 'p1', city: '广州', dateTime: inDays(2) }],
    })
    expect(screen.getByText(/JoyJoin 里还有很多科技互联网方向的小伙伴/)).toBeTruthy()
    expect(screen.queryByText(/场局在排桌/)).toBeNull()
  })

  it('mirrors the pools feed read-only — no fetch, enabled:false (Discover precedent)', () => {
    expect(OVERLAY_SOURCE).toContain('POOLS_QUERY_KEY')
    expect(OVERLAY_SOURCE).toMatch(/useQuery<EventPoolSummary\[\]>\(\{[\s\S]*?enabled: false/)
    // replaces (not augments) the vague line — only one primary bridge line renders
    expect(OVERLAY_SOURCE).toContain('showCityPoolLine')
    expect(OVERLAY_SOURCE).toContain('cityPoolLine')
  })
})

// ── Chemistry banner (PM audit R5, 2026-10-15) ──────────────────────────────
// The archetype chemistry line is promoted from the demoted bridge block into
// the card's emotional centrepiece: an accent-tinted banner above the trait
// section (±the matchSuccess mascot). Plain bridge rendering is the fallback
// whenever the archetype is absent/unknown — never fabricated chemistry.

describe('ProfessionChatOverlay · chemistry banner (PM R5)', () => {
  const TRAIT_RESPONSE = {
    ...CLASSIFY_RESPONSE,
    archetypeContext: { primaryArchetype: 'corgi', traits: ['能量充沛'] },
  }

  beforeEach(() => {
    apiRequestMock.mockReset()
    apiRequestMock.mockResolvedValue(TRAIT_RESPONSE)
    analyticsMock.interaction.mockClear()
  })

  it('renders the banner above the trait section when the archetype is known', async () => {
    const { view } = await reachRevealCard({ userArchetype: 'corgi' })

    const banner = view.container.querySelector('.profession-overlay__reveal-chemistry')
    const traitSection = view.container.querySelector('.profession-overlay__trait-section')

    expect(banner).toBeTruthy()
    expect(traitSection).toBeTruthy()
    // DOM order: chemistry banner → read-only tag section
    expect(
      Boolean(
        banner!.compareDocumentPosition(traitSection!) & Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    ).toBe(true)
    // copy unchanged — the exact sentence that lived in the bridge block
    expect(banner!.textContent).toContain('你的「社牛柯基」特质 + 科技互联网背景，在局里会很吃香')
  })

  it('tints the banner with the archetype accent and mounts the matchSuccess mascot', async () => {
    const { view } = await reachRevealCard({ userArchetype: 'corgi' })
    const banner = view.container.querySelector(
      '.profession-overlay__reveal-chemistry',
    ) as HTMLElement

    const styleAttr = banner.getAttribute('style') ?? ''
    // low-alpha archetype wash — rgba because WeChat WXSS drops hsla()
    expect(styleAttr).toContain(formatHSLAsRGBA(getArchetypeHSL('corgi'), 0.12))
    // contrast-safe accent rail (jsdom normalizes alpha-1 rgba → rgb; match the triple)
    const railTriple = getContrastSafeArchetypeColor('corgi').match(/rgba\((\d+, \d+, \d+)/)?.[1]
    expect(railTriple).toBeTruthy()
    expect(styleAttr).toContain(railTriple as string)

    const mascot = banner.querySelector(
      'img.profession-overlay__reveal-chemistry-mascot',
    ) as HTMLImageElement
    expect(mascot).toBeTruthy()
    expect(mascot.getAttribute('src')).toContain('xiaoyue-match-success.webp')
  })

  it('derives the accent from the user\u2019s archetype (two archetypes → two tints)', async () => {
    const corgi = await reachRevealCard({ userArchetype: 'corgi' })
    const corgiStyle = corgi.view.container
      .querySelector('.profession-overlay__reveal-chemistry')
      ?.getAttribute('style')
    corgi.view.unmount()

    const dolphin = await reachRevealCard({ userArchetype: 'dolphin_calm' })
    const dolphinStyle = dolphin.view.container
      .querySelector('.profession-overlay__reveal-chemistry')
      ?.getAttribute('style')

    expect(corgiStyle).toBeTruthy()
    expect(dolphinStyle).toBeTruthy()
    expect(corgiStyle).not.toBe(dolphinStyle)
  })

  it('falls back to the plain bridge line when the archetype is absent — no banner, no fabricated chemistry', async () => {
    const { view } = await reachRevealCard()

    expect(view.container.querySelector('.profession-overlay__reveal-chemistry')).toBeNull()
    expect(screen.getByText(/JoyJoin 里还有很多科技互联网方向的小伙伴/)).toBeTruthy()
    expect(screen.queryByText(/在局里会很吃香/)).toBeNull()
  })

  it('treats an unknown archetype id as absent (fail-closed)', async () => {
    const { view } = await reachRevealCard({ userArchetype: 'mystery_species' })

    expect(view.container.querySelector('.profession-overlay__reveal-chemistry')).toBeNull()
    expect(screen.queryByText(/在局里会很吃香/)).toBeNull()
  })

  it('ships the new BEM classes, the shared fade-rise entrance, and all three degradation blocks', () => {
    for (const klass of [
      '&__reveal-chemistry',
      '&__reveal-chemistry-mascot',
      '&__reveal-chemistry-text',
    ]) {
      expect(OVERLAY_STYLES).toContain(klass)
    }
    // reuses the shared transform/opacity-only keyframes — no new motion primitive
    expect(OVERLAY_STYLES).toMatch(
      /&__reveal-chemistry\s*\{[\s\S]*?animation: profession-fade-rise 0\.35s cubic-bezier\(0\.22, 1, 0\.36, 1\) 0\.5s backwards;/,
    )
    // static end-state in low-end + prefers-reduced-motion + --reduce-motion
    expect(OVERLAY_STYLES.match(/\.profession-overlay__reveal-chemistry,/g)?.length ?? 0).toBe(3)
    // no permanent will-change anywhere
    expect(OVERLAY_STYLES).not.toMatch(/will-change:\s*(?!auto\b)[a-z-]+/)
  })

  it('keeps the render order: benefit hint → chemistry → traits → social proof', () => {
    const hintIndex = OVERLAY_SOURCE.indexOf('{showBenefitHint && (')
    const chemistryIndex = OVERLAY_SOURCE.indexOf('{showChemistryBanner && (')
    const traitIndex = OVERLAY_SOURCE.indexOf('profession-overlay__trait-section')
    const bridgeIndex = OVERLAY_SOURCE.indexOf(
      '{!isFallbackSource && classificationData?.industryCategoryLabel && (',
    )
    expect(hintIndex).toBeGreaterThan(-1)
    expect(chemistryIndex).toBeGreaterThan(hintIndex)
    expect(traitIndex).toBeGreaterThan(chemistryIndex)
    expect(bridgeIndex).toBeGreaterThan(traitIndex)
  })
})
