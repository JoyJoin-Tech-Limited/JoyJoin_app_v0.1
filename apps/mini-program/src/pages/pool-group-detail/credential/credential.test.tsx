import { fireEvent, render, waitFor } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PoolGroupDetailsResponse } from '@shared/api'
import CredentialPage from './index'

const mocks = vi.hoisted(() => ({
  groupId: 'group-1',
  flag: true,
  query: vi.fn(),
  setClipboardData: vi.fn(),
  navigateBack: vi.fn(),
  vibrateShort: vi.fn(),
  redeemOpen: vi.fn(),
  credentialPresent: vi.fn(),
  screen: vi.fn(),
  refetch: vi.fn(),
}))

vi.mock('@tarojs/components', () => ({
  View: (props: Record<string, unknown>) => <div {...props} />,
  Text: (props: Record<string, unknown>) => <span {...props} />,
}))
vi.mock('@tarojs/taro', () => ({
  default: {
    useRouter: () => ({ params: { groupId: mocks.groupId } }),
    navigateBack: mocks.navigateBack,
    setClipboardData: mocks.setClipboardData,
    vibrateShort: mocks.vibrateShort,
  },
  useRouter: () => ({ params: { groupId: mocks.groupId } }),
}))
vi.mock('@tanstack/react-query', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-query')>()),
  useQuery: mocks.query,
}))
vi.mock('../../../hooks/useAuthGuard', () => ({
  useAuthGuard: () => ({ user: { features: { venueDealsEnabled: mocks.flag } }, isLoading: false }),
}))
vi.mock('../../../hooks/useDeviceTier', () => ({ useDeviceTier: () => ({ isDegradation: true }) }))
vi.mock('../../../lib/utils/systemInfo', () => ({ getSystemReducedMotionCompat: () => true }))
vi.mock('./useCredentialScreen', () => ({ default: (enabled: boolean) => { mocks.screen(enabled); return '' } }))
vi.mock('../../../components/loading/LoadingScreen', () => ({ default: () => <div>loading</div> }))
vi.mock('../../../lib/analytics/venueDealAnalytics', () => ({
  trackVenueDealRedeemPageOpen: mocks.redeemOpen,
  trackVenueDealCredentialPresent: mocks.credentialPresent,
}))

const baseDeal = {
  id: 'deal-1',
  kind: 'discount' as const,
  valueOffPercent: 20,
  title: '悦聚同桌专属折扣',
  method: 'code' as const,
  code: '悦聚同桌',
  venueName: '山止川行·南山店',
}

function response(deal: Record<string, unknown> | null = baseDeal): PoolGroupDetailsResponse {
  return {
    group: {
      id: 'group-1', eventPoolId: 'pool-1', groupNumber: 1, memberCount: 6,
      venueAssignmentStatus: 'assigned', venueName: baseDeal.venueName,
      venueAddress: '深圳市南山区', venueDeal: deal,
    },
    pool: {
      id: 'pool-1', title: '周末松弛感饭局', eventType: '饭局', city: '深圳',
      dateTime: '2026-11-20T11:00:00.000Z', hasGuaranteedDeal: true,
    },
    members: [],
  } as PoolGroupDetailsResponse
}

beforeEach(() => {
  mocks.groupId = 'group-1'
  mocks.flag = true
  mocks.setClipboardData.mockReset().mockResolvedValue({})
  mocks.navigateBack.mockReset().mockResolvedValue({})
  mocks.vibrateShort.mockReset()
  mocks.screen.mockReset()
  mocks.redeemOpen.mockReset()
  mocks.credentialPresent.mockReset()
  mocks.refetch.mockReset().mockResolvedValue({})
  mocks.query.mockReset().mockReturnValue({ data: response(), isLoading: false, refetch: mocks.refetch })
})

describe('同桌凭证出示页', () => {
  it('code：真实门店/日期/桌型、92rpx 暗号与权益分层，复制成功才变绿', async () => {
    const view = render(<CredentialPage />)
    const text = view.container.textContent ?? ''
    expect(text).toContain('山止川行·南山店')
    expect(text).toContain('6 人桌')
    expect(text).toContain('悦聚同桌')
    expect(text).toContain('8 折')
    expect(text).not.toContain('已出示')
    expect(text).not.toContain('已使用')
    expect(text).not.toContain('已核销')
    fireEvent.click(view.getByTestId('credential-copy'))
    await waitFor(() => expect(mocks.setClipboardData).toHaveBeenCalledWith({ data: '悦聚同桌' }))
    expect(view.container.textContent).toContain('暗号已复制')
    expect(view.container.textContent).toContain('已复制 · 可再次复制')
  })

  it('复制失败显示真实暗号，不翻转印章；成功态不混失败提示', async () => {
    mocks.setClipboardData.mockRejectedValue(new Error('denied'))
    const view = render(<CredentialPage />)
    fireEvent.click(view.getByTestId('credential-copy'))
    await waitFor(() => expect(view.container.textContent).toContain('复制失败，请直接念给店员：悦聚同桌'))
    expect(view.container.textContent).not.toContain('暗号已复制')
  })

  it('set_menu + show_page 可静态出示且无复制按钮', () => {
    mocks.query.mockReturnValue({ data: response({
      id: 'deal-2', kind: 'set_menu', setMenuPriceCents: 59800, setMenuOriginalPriceCents: 75800,
      title: '悦聚专属 6 人餐', description: '6 菜 1 汤', method: 'show_page', venueName: baseDeal.venueName,
    }), isLoading: false })
    const view = render(<CredentialPage />)
    expect(view.container.textContent).toContain('悦聚专属 6 人餐')
    expect(view.container.textContent).toContain('¥598 · 整桌一口价')
    expect(view.container.textContent).toContain('把这一页递给店员')
    expect(view.queryByTestId('credential-copy')).toBeNull()
  })

  it('discount + show_page 同样合法，不因没有暗号拒绝', () => {
    mocks.query.mockReturnValue({ data: response({ ...baseDeal, method: 'show_page', code: undefined }), isLoading: false })
    const view = render(<CredentialPage />)
    expect(view.container.textContent).toContain('悦聚同桌专属折扣')
    expect(view.container.textContent).toContain('把这一页递给店员')
  })

  it('仅 code 缺真实暗号时不可用，不伪造', () => {
    mocks.query.mockReturnValue({ data: response({ ...baseDeal, code: '  ' }), isLoading: false })
    const view = render(<CredentialPage />)
    expect(view.container.textContent).toContain('本场暂时没有可出示的优惠')
    expect(view.queryByTestId('credential-code')).toBeNull()
  })

  it('非 assigned / 无 deal / flag off 都不可用，flag off 不发请求', () => {
    for (const data of [
      response(null),
      { ...response(), group: { ...response().group, venueAssignmentStatus: 'unassigned' } },
    ]) {
      mocks.query.mockReturnValue({ data, isLoading: false })
      const view = render(<CredentialPage />)
      expect(view.container.textContent).toContain('本场暂时没有可出示的优惠')
      view.unmount()
    }
    mocks.flag = false
    mocks.query.mockReturnValue({ data: undefined, isLoading: false })
    const view = render(<CredentialPage />)
    expect(view.container.textContent).toContain('本场暂时没有可出示的优惠')
    expect(mocks.query.mock.calls[mocks.query.mock.calls.length - 1]?.[0].enabled).toBe(false)
  })

  it('缺 groupId 不可用且不发请求', () => {
    mocks.groupId = ''
    const view = render(<CredentialPage />)
    expect(view.container.textContent).toContain('本场暂时没有可出示的优惠')
    expect(mocks.query.mock.calls[mocks.query.mock.calls.length - 1]?.[0].enabled).toBe(false)
  })

  it('show_page 折扣是静态出示：不伪造暗号，也不误称按套餐出餐', () => {
    mocks.query.mockReturnValue({ data: response({
      id: 'deal-show-discount', kind: 'discount', valueOffPercent: 20,
      title: '悦聚同桌专属折扣', method: 'show_page', venueName: '山止川行·南山店',
    }), isLoading: false })
    const view = render(<CredentialPage />)
    const text = view.container.textContent ?? ''
    expect(text).toContain('本场优惠')
    expect(text).toContain('无需点按 · 门店按本页权益结算')
    expect(text).not.toContain('门店按套餐出餐')
    expect(text).not.toContain('复制暗号')
    expect(text.split('仅限本场活动 · 本桌使用')).toHaveLength(2)
    expect(text.split('订座费不含餐费，餐费到店与门店另结')).toHaveLength(2)
  })

  it('长套餐名使用降级字号且内容完整', () => {
    const title = '悦聚专属六人分享餐含季节限定菜品'
    mocks.query.mockReturnValue({ data: response({
      id: 'deal-3', kind: 'set_menu', setMenuPriceCents: 128800, setMenuOriginalPriceCents: 168800,
      title, method: 'show_page', venueName: '山止川行·南山科技园旗舰店',
    }), isLoading: false })
    const view = render(<CredentialPage />)
    expect(view.getByTestId('credential-code').className).toContain('deal-credential__code-text--set-menu')
    expect(view.container.textContent).toContain(title)
  })

  it('读取失败即不可用：无数据与有缓存数据的 refetch error 都不能继续出示', () => {
    for (const data of [undefined, response()]) {
      mocks.query.mockReturnValue({ data, error: new Error('refetch failed'), isLoading: false, refetch: mocks.refetch })
      const view = render(<CredentialPage />)
      expect(view.container.textContent).toContain('凭证读取失败')
      expect(view.container.textContent).toContain('请检查网络后重试')
      expect(view.queryByTestId('credential-copy')).toBeNull()
      fireEvent.click(view.getByTestId('credential-retry'))
      expect(mocks.refetch).toHaveBeenCalled()
      expect(mocks.screen).toHaveBeenLastCalledWith(false)
      view.unmount()
    }
  })

  it('关闭命中区域独立且只返回，不调用核销端点', () => {
    const view = render(<CredentialPage />)
    fireEvent.click(view.getByTestId('credential-close'))
    expect(mocks.navigateBack).toHaveBeenCalled()
  })

  it('长店名为印章预留排版空间，不允许文字穿过印章', () => {
    const scss = readFileSync(resolve(__dirname, 'index.scss'), 'utf8')
    expect(scss).toContain('padding: 0 112rpx; /* 为右上印章保留真实排版空间，长店名不得穿过印章 */')
  })

  it('S6：可用页 open 每次 mount 一次；code 只有复制成功才 present', async () => {
    const view = render(<CredentialPage />)
    expect(mocks.redeemOpen).toHaveBeenCalledTimes(1)
    expect(mocks.redeemOpen).toHaveBeenCalledWith({ poolId: 'pool-1', groupId: 'group-1', deal: baseDeal })
    expect(mocks.credentialPresent).not.toHaveBeenCalled()
    view.rerender(<CredentialPage />)
    expect(mocks.redeemOpen).toHaveBeenCalledTimes(1)
    fireEvent.click(view.getByRole('button', { name: '复制暗号' }))
    await waitFor(() => expect(mocks.credentialPresent).toHaveBeenCalledTimes(1))
    expect(mocks.credentialPresent.mock.calls[0][1]).toEqual(expect.any(Number))
  })

  it('S6：show_page 首次可用渲染即 present；error/不可用不发事件', () => {
    const showPageDeal = { ...baseDeal, method: 'show_page' as const, code: undefined }
    mocks.query.mockReturnValue({ data: response(showPageDeal), isLoading: false })
    const view = render(<CredentialPage />)
    expect(mocks.redeemOpen).toHaveBeenCalledTimes(1)
    expect(mocks.credentialPresent).toHaveBeenCalledTimes(1)
    view.unmount()
    mocks.redeemOpen.mockClear()
    mocks.credentialPresent.mockClear()
    mocks.query.mockReturnValue({ data: response(), error: new Error('forbidden'), isLoading: false })
    render(<CredentialPage />)
    expect(mocks.redeemOpen).not.toHaveBeenCalled()
    expect(mocks.credentialPresent).not.toHaveBeenCalled()
  })
})
