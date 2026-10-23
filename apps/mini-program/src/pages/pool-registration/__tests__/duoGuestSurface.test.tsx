import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { PropsWithChildren } from 'react'
import { render } from '@testing-library/react'
import PoolRegistrationDuoCard from '../components/PoolRegistrationDuoCard'
import { getGuestDuoCopy } from '../../../lib/duo/duoCopy'

/**
 * 双人成行 S2 guest 表面组件合同（sprint duo-s2-invitee-role-separation）。
 *
 * D-2: guest 态零按钮（无 openType='share' 元素、无「喊朋友一起来」文案）。
 * D-3: __guest 挂既有 __expand 容器内；L1/L2 两行结构稳定（P1 兼容条款）；
 *      进入复用 fade-slide-up（--static 仅随 reduceMotion）；aria-live。
 * D-8: lookup 加载中两条骨架（55%/40%、aria-busy）；文案名字缺失兜底「朋友」。
 * AC-9: 文案与 lib/duo/duoCopy 的 S3 常量同一引用（组件不内联字符串）。
 */

vi.mock('@tarojs/components', () => ({
  View: (props: Record<string, unknown>) => {
    const { hoverClass: _hoverClass, ...rest } = props
    return <div {...rest} />
  },
  Text: (props: Record<string, unknown>) => <span {...props} />,
}))

vi.mock('../../../components/ui/Button', () => ({
  default: ({ className, children }: PropsWithChildren<{ className?: string }>) => (
    <button type='button' className={className}>
      {children}
    </button>
  ),
}))

vi.mock('../../../lib/utils/haptics', () => ({
  haptics: vi.fn(),
}))

function renderGuestCard(overrides: Partial<Parameters<typeof PoolRegistrationDuoCard>[0]> = {}) {
  return render(
    <PoolRegistrationDuoCard
      state='guest'
      mode='duo'
      isCreatingInvite={false}
      partnerName='阿明'
      guestCopy={getGuestDuoCopy('reserved', '阿明')}
      reduceMotion={false}
      onSelectMode={vi.fn()}
      onOpenInfo={vi.fn()}
      onRetry={vi.fn()}
      {...overrides}
    />,
  )
}

describe('PoolRegistrationDuoCard — S2 guest 表面（D-2/D-3/AC-9）', () => {
  it('渲染 __guest 区：恰好两行文字（L1/L2 类名钩子稳定，P1 兼容条款）', () => {
    const { container } = renderGuestCard()
    const guest = container.querySelector('.pool-reg-duo__guest')
    expect(guest).not.toBeNull()
    expect(container.querySelector('.pool-reg-duo__guest-line1')?.textContent).toBe(
      '阿明 这局给你留了个位置',
    )
    expect(container.querySelector('.pool-reg-duo__guest-line2')?.textContent).toBe(
      '报名后你们会被排进同一桌',
    )
    // 恰好两条文本行（无第三行——P1 的第三行是未来的纯增量）。
    expect(guest?.querySelectorAll('span').length).toBe(2)
  })

  it('D-2: guest 态零按钮——无 <button>、无 openType=\'share\'、无「喊朋友一起来」', () => {
    const { container } = renderGuestCard()
    expect(container.querySelector('button')).toBeNull()
    expect(container.querySelector('.pool-reg-duo__share-btn')).toBeNull()
    expect(container.querySelector('.pool-reg-duo__again-btn')).toBeNull()
    expect(container.textContent).not.toContain('喊朋友一起来')
    expect(container.textContent).not.toContain('再喊一次')
  })

  it('__guest 挂在既有 __expand 容器内，进入复用 fade-slide-up（非 --static）', () => {
    const { container } = renderGuestCard()
    const expand = container.querySelector('.pool-reg-duo__expand')
    expect(expand).not.toBeNull()
    expect(expand?.className).not.toContain('pool-reg-duo__expand--static')
    expect(expand?.querySelector('.pool-reg-duo__guest')).not.toBeNull()
  })

  it('reduced-motion：__expand 切 --static（瞬时呈现），结构与文案不变', () => {
    const { container } = renderGuestCard({ reduceMotion: true })
    expect(container.querySelector('.pool-reg-duo__expand--static')).not.toBeNull()
    expect(container.querySelector('.pool-reg-duo__guest-line1')?.textContent).toBe(
      '阿明 这局给你留了个位置',
    )
  })

  it('aria-live=\'polite\' 容器（D-3），segmented 仍显示 2人 且不锁', () => {
    const { container } = renderGuestCard()
    const guest = container.querySelector('.pool-reg-duo__guest')
    expect(guest?.getAttribute('aria-live')).toBe('polite')
    // 显示态 = 2人（thumb 在 duo 侧）——invitee 视觉确认邀请已生效（AC-2）。
    expect(container.querySelector('.pool-reg-duo__segmented-thumb--duo')).not.toBeNull()
    expect(container.querySelector('.pool-reg-duo__segmented--locked')).toBeNull()
  })

  it('D-8 骨架：lookup 加载中渲染 55%/40% 两条骨架 + aria-busy，header 行立即渲染', () => {
    const { container } = renderGuestCard({ guestLoading: true, guestCopy: undefined })
    // header 行（标题 + segmented）不等 lookup，立即渲染。
    expect(container.querySelector('.pool-reg-duo__title')?.textContent).toBe('双人成行')
    expect(container.querySelector('.pool-reg-duo__segmented')).not.toBeNull()
    // 骨架两条，宽度修饰类 55%(--l1)/40%(--l2)，aria-busy=true。
    const guest = container.querySelector('.pool-reg-duo__guest')
    expect(guest?.getAttribute('aria-busy')).toBe('true')
    expect(container.querySelector('.pool-reg-duo__guest-skel--l1')).not.toBeNull()
    expect(container.querySelector('.pool-reg-duo__guest-skel--l2')).not.toBeNull()
    expect(container.querySelector('.pool-reg-duo__guest-line1')).toBeNull()
  })

  it('D-8 兜底：guestCopy 缺失时防御性回退「朋友」留位置版（lookup 路径 AC-3）', () => {
    const { container } = renderGuestCard({ guestCopy: undefined })
    expect(container.querySelector('.pool-reg-duo__guest-line1')?.textContent).toBe(
      '朋友 这局给你留了个位置',
    )
  })

  it('AC-9: guest 文案与 duoCopy 常量同一引用（onlyYou 变体 = S3 的 D2 文案）', () => {
    const { container } = renderGuestCard({ guestCopy: getGuestDuoCopy('onlyYou', '阿明') })
    expect(container.querySelector('.pool-reg-duo__guest-line1')?.textContent).toBe(
      '阿明 已经报名了，就等你',
    )
    expect(container.querySelector('.pool-reg-duo__guest-line2')?.textContent).toBe(
      '报名后你们会被排进同一桌',
    )
  })
})

describe('S2 guest 表面 — 接线结构合同（copy 唯一权威在 lib/duo/duoCopy.ts）', () => {
  const cardSource = readFileSync(
    resolve(__dirname, '..', 'components', 'PoolRegistrationDuoCard.tsx'),
    'utf-8',
  )
  const cardScss = readFileSync(
    resolve(__dirname, '..', 'components', 'PoolRegistrationDuoCard.scss'),
    'utf-8',
  )

  it('卡片经 props/duoCopy 解析 guest 文案，不内联 guest 字符串（AC-9）', () => {
    expect(cardSource).toContain('getGuestDuoCopy')
    // D-1 逐字片段不得出现在卡片源码——copy 只能来自 duoCopy.ts 常量。
    expect(cardSource).not.toContain('这局给你留了个位置')
    expect(cardSource).not.toContain('排进同一桌')
    expect(cardSource).not.toContain('已经报名了，就等你')
  })

  it('D-3 规格：L1 28rpx medium / L2 24rpx secondary / 间距 8rpx / 骨架 55%+40%', () => {
    expect(cardScss).toContain('&__guest-line1')
    expect(cardScss).toContain('&__guest-line2')
    expect(cardScss).toContain('font-size: 28rpx')
    expect(cardScss).toContain('font-weight: $font-weight-medium')
    expect(cardScss).toContain('gap: 8rpx')
    expect(cardScss).toContain('width: 55%')
    expect(cardScss).toContain('width: 40%')
  })

  it('D-3/D-8: guest 区零新增 keyframes（复用 fade-slide-up + pool-reg-shimmer）', () => {
    // 整个 duo 卡片 SCSS 只允许这两个既有 keyframes 引用，guest 区不得引入新的。
    const keyframesDefined = cardScss.match(/@keyframes\s+[\w-]+/g) ?? []
    expect(keyframesDefined).toEqual(['@keyframes pool-reg-duo-bound-glow'])
    expect(cardScss).toContain('animation: fade-slide-up 240ms')
    expect(cardScss).toContain('animation: pool-reg-shimmer 1.5s ease-in-out infinite')
  })
})
