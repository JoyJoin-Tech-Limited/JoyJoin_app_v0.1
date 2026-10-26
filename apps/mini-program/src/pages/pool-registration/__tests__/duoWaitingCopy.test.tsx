import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { PropsWithChildren } from 'react'
import { render } from '@testing-library/react'
import PoolRegistrationDuoCard from '../components/PoolRegistrationDuoCard'
import type { DuoWaitingCopyResolved } from '../../../lib/duo/duoCopy'

/**
 * 双人成行 S3 waiting 文案组件接线合同（PR-2，sprint duo-s3-waiting-copy-direction）。
 *
 * Render matrix (AC-2/AC-3/AC-8): the card renders the resolved waiting copy
 * verbatim and gates 「再喊一次」 on `showAgain` (D1 only); a missing
 * `waitingCopy` prop defensively falls back to D1 + 朋友 (AC-3). D-5: the
 * waiting region is always the --static expand variant （等待不是成就）.
 *
 * Source-locks: waiting copy strings live ONLY in lib/duo/duoCopy.ts — the
 * card must not re-inline them; the hook must resolve the copy from duo-status
 * direction fields (never the invite lookup's inviter name); the page must
 * pass the hook-resolved value through.
 *
 * Note (AC-7): D3 (invitee 视角) is unreachable on device before S2 — waiting
 * requires a share timestamp and the invitee never shares. It is covered here
 * at component level and in lib/duo/__tests__/duoCopy.test.ts at pure-function
 * level; the device walk covers D1/D2 only.
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

function renderWaitingCard(waitingCopy?: DuoWaitingCopyResolved) {
  return render(
    <PoolRegistrationDuoCard
      state='waiting'
      mode='duo'
      isCreatingInvite={false}
      partnerName='朋友'
      waitingCopy={waitingCopy}
      reduceMotion={false}
      onSelectMode={vi.fn()}
      onOpenInfo={vi.fn()}
      onRetry={vi.fn()}
    />,
  )
}

describe('PoolRegistrationDuoCard — S3 waiting copy matrix (AC-2/AC-3/AC-8)', () => {
  it('D1（等对方报名）: renders the copy and the「再喊一次」pill', () => {
    const { container } = renderWaitingCard({
      direction: 'sentFriend',
      text: '已发给 朋友，等 TA 报名',
      showAgain: true,
    })
    expect(container.querySelector('.pool-reg-duo__waiting-text')?.textContent).toBe(
      '已发给 朋友，等 TA 报名',
    )
    expect(container.querySelector('.pool-reg-duo__again-btn')).not.toBeNull()
    expect(container.querySelector('.pool-reg-duo__again-pill')).not.toBeNull()
    expect(container.querySelector('.pool-reg-duo__again-pill-text')?.textContent).toBe('再喊一次')
  })

  it('D2（就等你）: renders the copy WITHOUT「再喊一次」（AC-8）', () => {
    const { container } = renderWaitingCard({
      direction: 'onlyYou',
      text: '阿明 已经报名了，就等你',
      showAgain: false,
    })
    expect(container.querySelector('.pool-reg-duo__waiting-text')?.textContent).toBe(
      '阿明 已经报名了，就等你',
    )
    expect(container.querySelector('.pool-reg-duo__again-btn')).toBeNull()
  })

  it('D3（invitee 视角）: renders the copy WITHOUT「再喊一次」（AC-8；AC-7 纯函数/组件级验收）', () => {
    const { container } = renderWaitingCard({
      direction: 'promised',
      text: '你和 阿明 约好了，等 TA 报名',
      showAgain: false,
    })
    expect(container.querySelector('.pool-reg-duo__waiting-text')?.textContent).toBe(
      '你和 阿明 约好了，等 TA 报名',
    )
    expect(container.querySelector('.pool-reg-duo__again-btn')).toBeNull()
  })

  it('waitingCopy 缺失时防御性回退 D1 + 朋友（AC-3: 字段未知绝不渲染「就等你」）', () => {
    const { container } = renderWaitingCard(undefined)
    expect(container.querySelector('.pool-reg-duo__waiting-text')?.textContent).toBe(
      '已发给 朋友，等 TA 报名',
    )
    expect(container.querySelector('.pool-reg-duo__again-btn')).not.toBeNull()
  })

  it('D-5: waiting 区域固定 --static（三向文案全部无动画，不随 reduceMotion 切换）', () => {
    const { container } = renderWaitingCard({
      direction: 'onlyYou',
      text: '阿明 已经报名了，就等你',
      showAgain: false,
    })
    expect(container.querySelector('.pool-reg-duo__expand--static')).not.toBeNull()
    expect(container.querySelector('.pool-reg-duo__expand--static')?.className).toContain(
      'pool-reg-duo__expand',
    )
  })
})

describe('S3 waiting copy — 接线结构合同（copy 唯一权威在 lib/duo/duoCopy.ts）', () => {
  const cardSource = readFileSync(
    resolve(__dirname, '..', 'components', 'PoolRegistrationDuoCard.tsx'),
    'utf-8',
  )
  const hookSource = readFileSync(
    resolve(__dirname, '..', '..', '..', 'hooks', 'useDuoRegistration.ts'),
    'utf-8',
  )
  const pageSource = readFileSync(resolve(__dirname, '..', 'index.tsx'), 'utf-8')

  it('卡片渲染 resolved copy 并按 showAgain 门控「再喊一次」，不再内联 waiting 文案', () => {
    expect(cardSource).toContain('{waiting.text}')
    expect(cardSource).toContain('waiting.showAgain')
    // D-1 逐字片段不得出现在卡片源码——copy 只能来自 duoCopy.ts 常量。
    expect(cardSource).not.toContain('已发给')
    expect(cardSource).not.toContain('已经报名了')
    expect(cardSource).not.toContain('约好了')
  })

  it('hook 从 duo-status 方向字段解析 waiting copy（绝不用 invite lookup 的邀请者名）', () => {
    expect(hookSource).toContain('resolveDuoWaitingCopy({')
    expect(hookSource).toContain('viewerRole: duoStatus?.viewerRole')
    expect(hookSource).toContain('pendingSide: duoStatus?.pendingSide')
    expect(hookSource).toContain('friendDisplayName: duoStatus?.friendDisplayName')
  })

  it('页面把 hook 解析的 waitingCopy 透传给卡片', () => {
    expect(pageSource).toContain('waitingCopy={duo.duoWaitingCopy}')
  })
})
