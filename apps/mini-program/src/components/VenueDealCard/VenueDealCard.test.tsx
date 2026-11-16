import { render, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import VenueDealCard from './index'
import type { VenueDealSummary } from '@shared/api'
import {
  VENUE_DEAL_CARD_DISCOUNT_HOW,
  VENUE_DEAL_CARD_SET_MENU_HOW,
  VENUE_DEAL_CARD_SET_MENU_FOOT_NOTE,
  VENUE_DEAL_RULE_LINE,
} from '@shared/copy/venueDealCopy'

vi.mock('@tarojs/components', () => ({
  View: (props: Record<string, unknown>) => <div {...props} />,
  Text: (props: Record<string, unknown>) => <span {...props} />,
}))

const discountDeal: VenueDealSummary = {
  id: 'deal-1',
  kind: 'discount',
  valueOffPercent: 20,
  title: '悦聚同桌专属折扣',
  method: 'code',
  code: '悦聚同桌',
  venueName: '山止川行·南山店',
}

const setMenuDeal: VenueDealSummary = {
  id: 'deal-2',
  kind: 'set_menu',
  setMenuPriceCents: 59800,
  setMenuOriginalPriceCents: 75800,
  title: '悦聚专属 6 人餐',
  description: '6 菜 1 汤 + 特调饮品',
  method: 'show_page',
  venueName: '山止川行·南山店',
}

function textOf(view: ReturnType<typeof render>) {
  return view.container.textContent ?? ''
}

describe('VenueDealCard', () => {
  it('无优惠且无承诺时整卡不渲染（静默缺席）', () => {
    const view = render(<VenueDealCard />)
    expect(view.container.firstChild).toBeNull()
    expect(view.queryByTestId('venue-deal-card')).toBeNull()
  })

  it('折扣卡：面值、店名、使用方式与唯一规则行', () => {
    const view = render(<VenueDealCard deal={discountDeal} />)
    const text = textOf(view)
    expect(text).toContain('8')
    expect(text).toContain('折')
    expect(text).toContain('悦聚同桌专属折扣')
    expect(text).toContain('山止川行·南山店')
    expect(text).toContain(VENUE_DEAL_CARD_DISCOUNT_HOW)
    expect(text).toContain(VENUE_DEAL_RULE_LINE)
    expect(text).toContain('已解锁')
    expect(text).not.toContain('待解锁')
  })

  it('套餐卡：一口价 + 划线原价 + 内容说明 + 餐费边界', () => {
    const view = render(<VenueDealCard deal={setMenuDeal} />)
    const text = textOf(view)
    expect(text).toContain('598')
    expect(text).toContain('¥758')
    expect(text).toContain('6 菜 1 汤 + 特调饮品')
    expect(text).toContain(VENUE_DEAL_CARD_SET_MENU_HOW)
    expect(text).toContain(`${VENUE_DEAL_RULE_LINE} · ${VENUE_DEAL_CARD_SET_MENU_FOOT_NOTE}`)
  })

  it('E1 长面值：四位数套餐价降为 compact，三位数不降', () => {
    const valueClass = (view: ReturnType<typeof render>) =>
      view.container.querySelector('[data-testid="venue-deal-card-value"]')?.className ?? ''
    const long = render(<VenueDealCard deal={{ ...setMenuDeal, setMenuPriceCents: 128800 }} />)
    expect(valueClass(long)).toContain('venue-deal-card__value-text--long')
    const thousand = render(<VenueDealCard deal={{ ...setMenuDeal, setMenuPriceCents: 100000 }} />)
    expect(valueClass(thousand)).toContain('venue-deal-card__value-text--long')
    const boundary = render(<VenueDealCard deal={{ ...setMenuDeal, setMenuPriceCents: 99999 }} />)
    expect(valueClass(boundary)).not.toContain('venue-deal-card__value-text--long')
    const normal = render(<VenueDealCard deal={setMenuDeal} />)
    expect(valueClass(normal)).not.toContain('venue-deal-card__value-text--long')
    const discount = render(<VenueDealCard deal={discountDeal} />)
    expect(valueClass(discount)).not.toContain('venue-deal-card__value-text--long')
  })

  it('B0 锁定态：待解锁 + 不指代具体门店 + 无规则行', () => {
    const view = render(<VenueDealCard locked />)
    const text = textOf(view)
    expect(text).toContain('待解锁')
    expect(text).toContain('场地确定后解锁本场专属优惠')
    expect(text).toContain('折扣或套餐，二选一')
    expect(text).not.toContain(VENUE_DEAL_RULE_LINE)
    expect(view.container.querySelector('.venue-deal-card--locked')).not.toBeNull()
  })

  it('E2 读取失败：有重试动作，且不显示已解锁', () => {
    const onRetry = vi.fn()
    const view = render(<VenueDealCard error onRetry={onRetry} />)
    const text = textOf(view)
    expect(text).toContain('读取失败')
    expect(text).toContain('优惠暂时没加载出来')
    expect(text).not.toContain('已解锁')
    fireEvent.click(view.getByTestId('venue-deal-card-retry'))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('已承诺但面值缺失时走「已调整」，不静默消失、不编造面值、不谎报网络错误', () => {
    const broken: VenueDealSummary = { ...discountDeal, valueOffPercent: undefined }
    const view = render(<VenueDealCard deal={broken} />)
    expect(textOf(view)).toContain('已调整')
    expect(textOf(view)).not.toContain('读取失败')
    expect(view.queryByTestId('venue-deal-card-retry')).toBeNull()
  })

  it('assigned + 保底 + 正常响应 null → 已调整 + 客服入口文案，无重试假动作', () => {
    const view = render(<VenueDealCard adjusted />)
    const text = textOf(view)
    expect(text).toContain('本场优惠有调整')
    expect(text).toContain('悦聚客服')
    expect(text).not.toContain('已解锁')
    expect(view.queryByTestId('venue-deal-card-retry')).toBeNull()
  })

  it('S3 边界：不传 onPress 时不是按钮、没有箭头', () => {
    const view = render(<VenueDealCard deal={discountDeal} />)
    const root = view.getByTestId('venue-deal-card')
    expect(root.getAttribute('role')).not.toBe('button')
    expect(root.className).not.toContain('venue-deal-card--pressable')
    expect(textOf(view)).not.toContain('›')
  })

  it('传入 onPress（S4 接线后）整卡成为按钮并回调真实权益', () => {
    const onPress = vi.fn()
    const view = render(<VenueDealCard deal={discountDeal} onPress={onPress} />)
    const root = view.getByTestId('venue-deal-card')
    expect(root.getAttribute('role')).toBe('button')
    expect(root.className).toContain('venue-deal-card--pressable')
    expect(textOf(view)).toContain('›')
    fireEvent.click(root)
    expect(onPress).toHaveBeenCalledWith(discountDeal)
  })

  it('卡片不出现审核禁词与虚假履约状态', () => {
    for (const props of [{ deal: discountDeal }, { deal: setMenuDeal }, { locked: true }, { error: true }, { adjusted: true }]) {
      const text = textOf(render(<VenueDealCard {...props} />))
      for (const banned of ['会员', 'VIP', '独家', '已出示', '已使用', '已核销']) {
        expect(text).not.toContain(banned)
      }
      expect(text).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u)
    }
  })
})
