import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * pool-group-detail 的 VenueDealCard 接线契约（源码级）。
 * 组件行为本身由 components/VenueDealCard/VenueDealCard.test.tsx 覆盖。
 */
const pageSource = readFileSync(resolve(__dirname, '../index.tsx'), 'utf8')
const pageStyles = readFileSync(resolve(__dirname, '../index.scss'), 'utf8')

describe('pool-group-detail × VenueDealCard 接线', () => {
  it('渲染组件且使用共享 DTO 字段', () => {
    expect(pageSource).toContain("import VenueDealCard from '../../components/VenueDealCard'")
    expect(pageSource).toContain('group.venueDeal ?? null')
  })

  it('状态分流由共享真值表函数决定（行为测试在 lib/matching/venueDealCardState.test.ts）', () => {
    expect(pageSource).toContain("import { resolveVenueDealCardState } from '../../lib/matching/venueDealCardState'")
    expect(pageSource).toContain('hasGuaranteedDeal: poolGroup?.pool.hasGuaranteedDeal')
    expect(pageSource).toContain('hasGuaranteedDealBinding: poolGroup?.pool.hasGuaranteedDealBinding')
    expect(pageSource).toContain('queryError: Boolean(error)')
    expect(pageSource).toContain("locked={venueDealState === 'locked'}")
    expect(pageSource).toContain("adjusted={venueDealState === 'adjusted'}")
    expect(pageSource).toContain("error={venueDealState === 'error'}")
  })

  it('首个用户可见触点暗发于 venueDealsEnabled flag', () => {
    expect(pageSource).toContain("currentUser?.features?.venueDealsEnabled === true")
  })

  it('整卡不渲染的默认路径与 collapsed 排除由真值表 hidden 承担', () => {
    expect(pageSource).toContain("const showVenueDealCard = venueDealState !== 'hidden'")
    expect(pageSource).toContain('isCollapsedGroup,')
  })

  it('重试是真实动作：失效本组 query', () => {
    expect(pageSource).toContain("queryClient.invalidateQueries({ queryKey: ['mini-program', 'pool-group', groupId] })")
    expect(pageSource).toContain('onRetry={handleDealRetry}')
  })

  it('仅已解锁票券传出示动作，URL 只携带编码后的 groupId', () => {
    expect(pageSource).toContain("onPress={venueDealState === 'ticket'")
    expect(pageSource).toContain('/pages/pool-group-detail/credential/index?groupId=${encodeURIComponent(groupId)}')
  })

  it('S6 曝光按 group+deal 去重且只发 ticket，点卡先于导航', () => {
    expect(pageSource).toContain('dealImpressionsRef = useRef(new Set<string>())')
    expect(pageSource).toContain("if (venueDealState !== 'ticket' || !venueDeal || !poolGroup?.pool.id) return")
    expect(pageSource).toContain('const key = `${groupId}:${venueDeal.id}`')
    expect(pageSource).toContain('trackVenueDealCardImpression({ poolId: poolGroup.pool.id, groupId, deal: venueDeal })')
    const tap = pageSource.indexOf('trackVenueDealCardTap({ poolId: pool.id, groupId, deal: venueDeal })')
    const navigate = pageSource.indexOf('void Taro.navigateTo({', tap)
    expect(tap).toBeGreaterThan(-1)
    expect(navigate).toBeGreaterThan(tap)
  })

  it('组件样式 @use 合编译进本页 WXSS，组件 TSX 不 import 自己的 SCSS', () => {
    expect(pageStyles).toContain("@use '../../components/VenueDealCard/index.scss' as venue-deal;")
    const componentSource = readFileSync(
      resolve(__dirname, '../../../components/VenueDealCard/index.tsx'),
      'utf8',
    )
    expect(componentSource).not.toContain(".scss'")
  })
})
