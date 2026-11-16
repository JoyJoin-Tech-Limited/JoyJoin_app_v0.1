import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import {
  COST_ONSITE_MENU_NOTE,
  COST_ROW_ONSITE_HINT,
  COST_ROW_ONSITE_HINT_DINING,
} from '@shared/copy/eventCostCopy'
import IcebreakerInclusionSheet from '../IcebreakerInclusionSheet'

const taroMocks = vi.hoisted(() => ({ on: vi.fn(), off: vi.fn() }))

vi.mock('@tarojs/components', () => ({
  View: (props: Record<string, unknown>) => <div {...props} />,
  Text: (props: Record<string, unknown>) => <span {...props} />,
  Image: (props: Record<string, unknown>) => <img {...props} />,
  ScrollView: (props: Record<string, unknown>) => <div {...props} />,
}))

vi.mock('@tarojs/taro', () => ({
  default: { eventCenter: { on: taroMocks.on, off: taroMocks.off } },
}))
vi.mock('../../../lib/utils/haptics', () => ({ haptics: vi.fn() }))
vi.mock('../../../lib/mascot/xiaoyueExpressions', () => ({
  getXiaoyueExpressionAsset: () => '/assets/payment-trust.webp',
}))

const DRINKS_BUDGET_LABEL = `¥${80}–${150} / 人`
const DINING_BUDGET_LABEL = `¥${150}–${300} / 人`

describe('IcebreakerInclusionSheet — cost explanation extension', () => {
  it('keeps the five-phase education and adds the same-source on-site budget', () => {
    const { container } = render(
      <IcebreakerInclusionSheet
        visible
        onClose={vi.fn()}
        onSiteBudgetLabel={DRINKS_BUDGET_LABEL}
        onSiteHint={COST_ROW_ONSITE_HINT}
      />,
    )

    expect(screen.getByText('今晚的费用')).toBeInTheDocument()
    expect(screen.getByText('一笔报名费，一笔到店自付，没有第三笔。')).toBeInTheDocument()
    expect(container.querySelectorAll('.icebreaker-sheet__phase-item')).toHaveLength(5)
    for (const name of ['话题卡', '人格骰子', '机智对决', '谁是卧底', '迷你剧本杀']) {
      expect(screen.getByText(name)).toBeInTheDocument()
    }
    expect(screen.getByText('不包含在报名费里')).toBeInTheDocument()
    expect(screen.getByText('本场到店预算')).toBeInTheDocument()
    expect(screen.getByText(DRINKS_BUDGET_LABEL)).toBeInTheDocument()
    expect(screen.getByText(COST_ROW_ONSITE_HINT)).toBeInTheDocument()
    expect(screen.getByText(/具体环节会由悦仔根据成桌人数和现场氛围灵活组合/)).toBeInTheDocument()
    expect(screen.getByText('具体场地在排桌后公布，到店消费以门店菜单为准')).toBeInTheDocument()
  })

  it('uses the dining hint without implying alcohol', () => {
    render(
      <IcebreakerInclusionSheet
        visible
        onClose={vi.fn()}
        onSiteBudgetLabel={DINING_BUDGET_LABEL}
        onSiteHint={COST_ROW_ONSITE_HINT_DINING}
      />,
    )

    expect(screen.getByText(COST_ROW_ONSITE_HINT_DINING)).toBeInTheDocument()
    expect(screen.queryByText(COST_ROW_ONSITE_HINT)).not.toBeInTheDocument()
  })

  it('null budget fails closed to the menu note without an invented amount', () => {
    render(
      <IcebreakerInclusionSheet
        visible
        onClose={vi.fn()}
        onSiteBudgetLabel={null}
        onSiteHint={COST_ROW_ONSITE_HINT}
      />,
    )

    expect(screen.getByText(COST_ONSITE_MENU_NOTE)).toBeInTheDocument()
    expect(screen.queryByText('本场到店预算')).not.toBeInTheDocument()
    expect(screen.queryByText(/¥\d/)).not.toBeInTheDocument()
  })

  it('keeps the existing visible gate', () => {
    const { container } = render(
      <IcebreakerInclusionSheet visible={false} onClose={vi.fn()} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('applies 0.6 drag resistance and dismisses only beyond the 100px threshold', () => {
    const onClose = vi.fn()
    const { container } = render(<IcebreakerInclusionSheet visible onClose={onClose} />)
    const sheet = container.querySelector('.icebreaker-sheet')!

    fireEvent.touchStart(sheet, { touches: [{ clientY: 100 }] })
    fireEvent.touchMove(sheet, { touches: [{ clientY: 300 }] })
    expect(sheet).toHaveStyle({ transform: 'translateY(120px)' })
    fireEvent.touchEnd(sheet)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('springs back without closing below the threshold and ignores a scrolled list', () => {
    const onClose = vi.fn()
    const { container } = render(<IcebreakerInclusionSheet visible onClose={onClose} />)
    const sheet = container.querySelector('.icebreaker-sheet')!

    fireEvent.touchStart(sheet, { touches: [{ clientY: 100 }] })
    fireEvent.touchMove(sheet, { touches: [{ clientY: 200 }] })
    expect(sheet).toHaveStyle({ transform: 'translateY(60px)' })
    fireEvent.touchEnd(sheet)
    expect(onClose).not.toHaveBeenCalled()
    expect((sheet as HTMLElement).style.transform).toBe('')

    fireEvent(
      container.querySelector('.icebreaker-sheet__scroll')!,
      new CustomEvent('scroll', { detail: { scrollTop: 40 } }),
    )
    fireEvent.touchStart(sheet, { touches: [{ clientY: 100 }] })
    fireEvent.touchMove(sheet, { touches: [{ clientY: 400 }] })
    expect((sheet as HTMLElement).style.transform).toBe('')
  })

  it('closes on the existing router-change event and unsubscribes the same handler', () => {
    const onClose = vi.fn()
    const { rerender } = render(<IcebreakerInclusionSheet visible onClose={onClose} />)
    const routerRegistrations = taroMocks.on.mock.calls.filter(([name]) => name === '__taroRouterChange')
    const registration = routerRegistrations[routerRegistrations.length - 1]
    expect(registration).toBeDefined()
    const handler = registration![1] as () => void

    handler()
    expect(onClose).toHaveBeenCalledTimes(1)
    rerender(<IcebreakerInclusionSheet visible={false} onClose={onClose} />)
    expect(taroMocks.off).toHaveBeenCalledWith('__taroRouterChange', handler)
  })

  it('suppresses drag transforms under reduced motion without changing the close threshold', () => {
    const onClose = vi.fn()
    const { container } = render(
      <IcebreakerInclusionSheet visible shouldReduceMotion onClose={onClose} />,
    )
    const sheet = container.querySelector('.icebreaker-sheet')!

    fireEvent.touchStart(sheet, { touches: [{ clientY: 100 }] })
    fireEvent.touchMove(sheet, { touches: [{ clientY: 300 }] })
    expect(sheet).not.toHaveAttribute('style')
    fireEvent.touchEnd(sheet)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
