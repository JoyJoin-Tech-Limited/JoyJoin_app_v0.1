import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ProfessionDisplayField, {
  INDUSTRY_COHORT_MIN_COUNT,
  PROFESSION_DISPLAY_EMPTY_HINT,
  PROFESSION_DISPLAY_EMPTY_VALUE,
  buildIndustryCohortLine,
} from './ProfessionDisplayField'
import type { ProfessionClassificationLike } from '../../lib/onboarding/professionLadderReducer'

const { apiRequestMock } = vi.hoisted(() => ({ apiRequestMock: vi.fn() }))

vi.mock('@tarojs/components', () => ({
  View: ({ children, hoverClass: _hoverClass, hoverStartTime: _hoverStartTime, hoverStayTime: _hoverStayTime, ...props }: any) => (
    <div {...props}>{children}</div>
  ),
  Text: ({ children, ...props }: any) => <span {...props}>{children}</span>,
}))

vi.mock('../../lib/api/api', () => ({
  apiRequest: (...args: unknown[]) => apiRequestMock(...args),
}))

const SOURCE = readFileSync(
  resolve(process.cwd(), 'src/components/profile/ProfessionDisplayField.tsx'),
  'utf8',
)

/** The 「并购顾问」 regression fixture: canonical id absent, niche resolved. */
const MA_ADVISOR_FIXTURE: ProfessionClassificationLike = {
  industryCategory: 'finance',
  industryCategoryLabel: '金融服务',
  industrySegmentNew: 'investment_banking',
  industrySegmentLabel: '投资银行',
  industryNiche: 'ma_advisory',
  industryNicheLabel: '并购顾问',
  standardizedOccupationId: null,
}

interface RenderFieldOptions {
  rawValue?: string
  classification?: ProfessionClassificationLike | null
  archetypeId?: string
  userCity?: string
  onEdit?: () => void
}

function renderField(options: RenderFieldOptions = {}) {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <ProfessionDisplayField
        rawValue={options.rawValue ?? '并购顾问'}
        classification={options.classification === undefined ? MA_ADVISOR_FIXTURE : options.classification}
        archetypeId={options.archetypeId}
        userCity={options.userCity}
        onEdit={options.onEdit ?? vi.fn()}
      />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  apiRequestMock.mockReset()
})

describe('ProfessionDisplayField · 职业画像 ladder (read-only)', () => {
  it('shows the resolved taxonomy niche on the 角色 row when no canonical id exists', () => {
    const { container } = renderField()
    expect(screen.getByText('类别')).toBeTruthy()
    expect(screen.getByText('细分')).toBeTruthy()
    expect(screen.getByText('角色')).toBeTruthy()
    expect(screen.getByText('金融服务')).toBeTruthy()
    expect(screen.getByText('投资银行')).toBeTruthy()
    const ladder = container.querySelector('.profession-display-field__ladder') as HTMLElement
    expect(ladder).toBeTruthy()
    expect(ladder.textContent).toContain('并购顾问')
  })

  it('prefers the canonical occupation display name over the niche', () => {
    renderField({
      rawValue: '前端',
      classification: {
        industryCategory: 'tech',
        industryCategoryLabel: '科技互联网',
        industrySegmentNew: 'software_dev',
        industrySegmentLabel: '软件开发',
        industryNiche: null,
        industryNicheLabel: null,
        standardizedOccupationId: 'frontend_engineer',
      },
    })
    expect(screen.getByText('前端工程师')).toBeTruthy()
  })

  it('never renders a 待补充 placeholder — unresolved rows are skipped entirely', () => {
    renderField({ classification: null })
    expect(screen.queryByText('待补充')).toBeNull()
    expect(screen.queryByText('类别')).toBeNull()
    // the raw value still renders — the card is a display, not a dead end
    expect(screen.getByText('并购顾问')).toBeTruthy()
  })
})

describe('ProfessionDisplayField · 特质 pills + empty state', () => {
  it('renders the archetype registry traits for a known archetype', () => {
    renderField({ archetypeId: 'hamster_praise' })
    expect(screen.getByText('鼓励性强')).toBeTruthy()
    expect(screen.getByText('反应热情')).toBeTruthy()
    expect(screen.getByText('正能量满满')).toBeTruthy()
  })

  it('renders no trait pills for an unknown archetype', () => {
    renderField({ archetypeId: 'not_a_real_archetype' })
    expect(screen.queryByText('鼓励性强')).toBeNull()
  })

  it('shows the recovery nudge in the empty state and taps through to the overlay', () => {
    const onEdit = vi.fn()
    const { container } = renderField({ rawValue: '', classification: null, onEdit })
    expect(screen.getByText(PROFESSION_DISPLAY_EMPTY_VALUE)).toBeTruthy()
    expect(screen.getByText(PROFESSION_DISPLAY_EMPTY_HINT)).toBeTruthy()
    fireEvent.click(container.querySelector('.profession-display-field') as HTMLElement)
    expect(onEdit).toHaveBeenCalledTimes(1)
  })
})

describe('ProfessionDisplayField · truthful 同城 cohort line (fail-open)', () => {
  it('renders the line only for a real count ≥ min-count', async () => {
    apiRequestMock.mockResolvedValue({ count: 23 })
    renderField({ userCity: '深圳' })
    await waitFor(() => expect(screen.getByText('同城还有 23 位金融服务方向的人')).toBeTruthy())
    expect(apiRequestMock).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/api/inference/industry-cohort-count' }),
    )
  })

  it('never renders for counts below the min-count floor', async () => {
    apiRequestMock.mockResolvedValue({ count: INDUSTRY_COHORT_MIN_COUNT - 1 })
    renderField({ userCity: '深圳' })
    await waitFor(() => expect(apiRequestMock).toHaveBeenCalledTimes(1))
    expect(screen.queryByText(/同城还有/)).toBeNull()
  })

  it('never renders for a null count or a failed request', async () => {
    apiRequestMock.mockResolvedValue({ count: null })
    const view = renderField({ userCity: '深圳' })
    await waitFor(() => expect(apiRequestMock).toHaveBeenCalledTimes(1))
    expect(screen.queryByText(/同城还有/)).toBeNull()

    view.unmount()
    apiRequestMock.mockReset()
    apiRequestMock.mockRejectedValue(new Error('offline'))
    renderField({ userCity: '深圳' })
    await waitFor(() => expect(apiRequestMock).toHaveBeenCalledTimes(1))
    expect(screen.queryByText(/同城还有/)).toBeNull()
  })

  it('does not call the endpoint when the city is unknown', async () => {
    renderField({ userCity: undefined })
    await new Promise((resolveTick) => setTimeout(resolveTick, 10))
    expect(apiRequestMock).not.toHaveBeenCalled()
  })
})

describe('ProfessionDisplayField · copy governance', () => {
  const FORBIDDEN_VOCAB = /匹配|社交|灵魂|撮合|AI/

  it('keeps the cohort line builder and empty hint free of banned vocabulary', () => {
    expect(FORBIDDEN_VOCAB.test(buildIndustryCohortLine(23, '金融服务'))).toBe(false)
    expect(FORBIDDEN_VOCAB.test(PROFESSION_DISPLAY_EMPTY_HINT)).toBe(false)
    expect(buildIndustryCohortLine(23, '金融服务')).toBe('同城还有 23 位金融服务方向的人')
  })

  it('source contains no banned vocabulary and no inline emoji', () => {
    expect(FORBIDDEN_VOCAB.test(SOURCE)).toBe(false)
    expect(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(SOURCE)).toBe(false)
  })
})
