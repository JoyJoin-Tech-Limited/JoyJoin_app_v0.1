import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { PropsWithChildren } from 'react'
import { render, screen } from '@testing-library/react'
import type { EventPoolSummary } from '@shared/api'

import PoolRegistrationSuccessCeremony from '../components/PoolRegistrationSuccessCeremony'

vi.mock('@tarojs/components', () => ({
  View: (props: Record<string, unknown>) => <div {...props} />,
  Text: (props: Record<string, unknown>) => <span {...props} />,
  ScrollView: (props: Record<string, unknown>) => <div {...props} />,
}))

vi.mock('@tarojs/taro', () => ({
  default: { switchTab: vi.fn() },
  useDidShow: vi.fn(),
}))

vi.mock('../../../components/reservation/RegistrationSuccessCeremony', () => ({
  default: ({ children }: PropsWithChildren) => <div data-testid='ceremony-children'>{children}</div>,
}))

vi.mock('../../../components/discover/ChemistryMiniGrid', () => ({ default: () => null }))
vi.mock('../../../components/ui/Button', () => ({
  default: ({ children }: PropsWithChildren) => <button type='button'>{children}</button>,
}))
vi.mock('../../../hooks/useDeviceTier', () => ({
  useDeviceTier: () => ({ isDegradation: false }),
}))
vi.mock('../../../hooks/useResetOnShow', () => ({ useResetOnShow: vi.fn() }))
vi.mock('../../../lib/analytics/discoverAnalytics', () => ({
  discoverAnalytics: { track: vi.fn() },
}))
vi.mock('../../../lib/utils/haptics', () => ({ haptics: vi.fn() }))
vi.mock('../../../lib/matching/groupDisplay', () => ({ formatDateTime: () => '10月24日 19:30' }))

const pool = {
  id: 'pool-1',
  title: '周末咖啡局',
  city: '深圳',
  district: '南山区',
  dateTime: '2026-10-24T19:30:00+08:00',
  registrationCount: 3,
} as unknown as EventPoolSummary

function renderCeremony(overrides: Partial<Parameters<typeof PoolRegistrationSuccessCeremony>[0]> = {}) {
  return render(
    <PoolRegistrationSuccessCeremony
      poolId='pool-1'
      eventType='饭局'
      highlights={[]}
      pool={pool}
      userArchetype={null}
      duoBindingNotice='阿明 这局已经有同行了，这次就各排各的'
      onEnableNotifications={vi.fn()}
      reduceMotion
      {...overrides}
    />,
  )
}

describe('PoolRegistrationSuccessCeremony — Batch B notice（AC-6）', () => {
  it('notice 是 children 第一行，沿用既有 text，无标题/图标/CTA', () => {
    renderCeremony()
    const extras = screen.getByTestId('ceremony-children')
    const firstLine = extras.firstElementChild
    expect(firstLine?.textContent).toBe('阿明 这局已经有同行了，这次就各排各的')
    expect(firstLine?.className).toBe('registration-ceremony__text')
    expect(firstLine?.tagName).toBe('SPAN')
    expect(firstLine?.querySelector('button, img, svg')).toBeNull()
  })

  it('与 duo.bound 互斥：bound 正文存在时不渲染 unavailable notice', () => {
    renderCeremony({ duo: { bound: true, partnerName: '阿明' } })
    expect(screen.queryByText('阿明 这局已经有同行了，这次就各排各的')).toBeNull()
    expect(screen.getByText(/已和 .*阿明.* 组成双人，悦仔会安排同桌。/)).not.toBeNull()
  })
})

describe('Batch B notice 接线与文案所有权（AC-6/7/8）', () => {
  it('免费与 optimistic 权益路径都消费本次响应；ceremony 不内联 notice 文案', () => {
    const pageSource = readFileSync(resolve(__dirname, '..', 'index.tsx'), 'utf-8')
    const optimisticSource = readFileSync(
      resolve(__dirname, '..', '..', '..', 'hooks', 'useOptimisticRegistration.ts'),
      'utf-8',
    )
    const ceremonySource = readFileSync(
      resolve(__dirname, '..', 'components', 'PoolRegistrationSuccessCeremony.tsx'),
      'utf-8',
    )

    expect(pageSource).toContain('const registrationResponse = await registerForPool(apiRequest, poolId, payload)')
    expect(pageSource).toContain('applyDuoBindingResponse(registrationResponse)')
    expect(pageSource).toContain('onRegistrationResponse: applyDuoBindingResponse')
    expect(optimisticSource).toContain('onRegistrationResponse?.(response)')
    expect(pageSource).toContain('clearDuoBindingNotice()')
    expect(ceremonySource).toContain('{!duo?.bound && duoBindingNotice ? (')
    expect(ceremonySource).not.toContain('这次的同行邀请没有生效')
    expect(ceremonySource).not.toContain('这局已经有同行了，这次就各排各的')
  })
})
