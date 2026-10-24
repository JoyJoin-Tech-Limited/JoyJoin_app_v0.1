import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * 双人成行 S2 页面接线结构合同（sprint duo-s2-invitee-role-separation）。
 *
 * 页面是 useDuoRegistration 的薄壳，仓库对 pool-registration 的既定页面级
 * 测试词汇是 source-lock 接线断言（见 confirmModalWiring.test.ts）。这里
 * 钉死 D-1 单一表面门控、依赖条款的双回填源压制、D-9 overlay 互斥与
 * 弹窗挂载——任一被未来重构悄悄改掉都会在这里红。
 */
const PAGE_SOURCE = resolve(__dirname, '..', 'index.tsx')

describe('pool-registration S2 页面接线（D-1 单一表面 / Dependencies 归因压制 / D-9 互斥）', () => {
  const source = readFileSync(PAGE_SOURCE, 'utf-8')

  it('D-1: 横幅渲染条件加 step !== STEP_BRIEF 且受 duoDeclinedSolo 压制（step 0 归 guest 卡）', () => {
    expect(source).toContain('duo.showDuoBanner && step !== STEP_BRIEF && !duo.duoDeclinedSolo')
  })

  it('卡片接收 guestCopy + guestLoading（guest 表面与骨架窗由 hook 驱动）', () => {
    expect(source).toContain('guestCopy={duo.guestDuoCopy}')
    expect(source).toContain('guestLoading={duo.guestLoading}')
  })

  it('hook 接收 meRegistered（D-6 触发守卫）与 onDuoDeclinedSolo（归因压制回调）', () => {
    expect(source).toContain('meRegistered: alreadyRegistered')
    expect(source).toContain('onDuoDeclinedSolo: () => {')
  })

  it('Dependencies: 「就我一个人」确认后清空 formState.invitationCode（payload 不再携带）', () => {
    expect(source).toContain('duoDeclinedSoloRef.current = true')
    expect(source).toContain('setFormState((currentState) => ({ ...currentState, invitationCode: undefined }))')
  })

  it('Dependencies: 两条回填源都被压制——挂载初始化与支付回填草稿恢复都过 duoDeclinedSoloRef', () => {
    // 挂载 effect（URL 参数 + user.pendingReferralCode 合成 resolvedInvitationCode）。
    expect(source).toContain('invitationCode: duoDeclinedSoloRef.current ? undefined : resolvedInvitationCode || undefined')
    // applyStoredReturnContext（支付回填草稿恢复路径）。
    expect(source).toContain('invitationCode: duoDeclinedSoloRef.current')
  })

  it('D-9: 确认弹窗与其它 overlay 互斥（handleConfirmCta 同时关闭 duo sheet 与 solo 弹窗）', () => {
    expect(source).toContain('duo.closeDuoSheet()')
    expect(source).toContain('duo.closeSoloConfirm()')
  })

  it('D-4: 自绘确认弹窗挂载并接线两个决策回调', () => {
    expect(source).toContain('<DuoSoloConfirmDialog')
    expect(source).toContain('visible={duo.isSoloConfirmOpen}')
    expect(source).toContain('inviterName={duo.partnerName}')
    expect(source).toContain('onStayTogether={duo.confirmStayTogether}')
    expect(source).toContain('onGoSolo={duo.confirmGoSolo}')
  })

  it('页面 SCSS @use 弹窗样式（subpackage 分包样式门；TSX 零 import）', () => {
    const pageScss = readFileSync(resolve(__dirname, '..', 'index.scss'), 'utf-8')
    expect(pageScss).toContain("@use './components/DuoSoloConfirmDialog.scss' as *;")
    expect(source).not.toContain('DuoSoloConfirmDialog.scss')
  })
})
