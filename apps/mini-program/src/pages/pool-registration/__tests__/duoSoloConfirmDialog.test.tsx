import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, fireEvent } from '@testing-library/react'
import DuoSoloConfirmDialog from '../components/DuoSoloConfirmDialog'
import { haptics } from '../../../lib/utils/haptics'

/**
 * 双人成行 S2 solo 确认弹窗组件合同（sprint duo-s2-invitee-role-separation）。
 *
 * D-4: 自绘居中 dialog（否决 showModal/ActionSheet）；主按钮唯一实心紫且
 *      居上（默认焦点）；次按钮文字式；命中区 ≥88rpx；无 × 关闭；
 *      遮罩点击 ≡ 主按钮。
 * D-5: 文案逐字（标题含截断插值名）。
 * D-7: 复用 reg-confirm-backdrop-in 200ms / reg-confirm-card-pop 320ms，
 *      零新增 keyframes；打开与按钮 haptics 均 light；reduced-motion 无动画
 *      但 haptics 照常（spy 断言）。
 */

vi.mock('@tarojs/components', () => ({
  View: (props: Record<string, unknown>) => {
    const { hoverClass: _hoverClass, catchMove: _catchMove, ...rest } = props
    return <div {...rest} />
  },
  Text: (props: Record<string, unknown>) => <span {...props} />,
}))

vi.mock('../../../lib/utils/haptics', () => ({
  haptics: vi.fn(),
}))

const mockHaptics = vi.mocked(haptics)

function renderDialog(overrides: Partial<Parameters<typeof DuoSoloConfirmDialog>[0]> = {}) {
  const onStayTogether = vi.fn()
  const onGoSolo = vi.fn()
  const utils = render(
    <DuoSoloConfirmDialog
      visible
      inviterName='阿明'
      reduceMotion={false}
      onStayTogether={onStayTogether}
      onGoSolo={onGoSolo}
      {...overrides}
    />,
  )
  return { onStayTogether, onGoSolo, ...utils }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('DuoSoloConfirmDialog — D-5 文案逐字', () => {
  it('标题/正文/主按钮/次按钮逐字渲染（标题含截断插值名）', () => {
    const { container } = renderDialog()
    expect(container.querySelector('.duo-solo-confirm__title')?.textContent).toBe(
      '这场是和 阿明 约好的',
    )
    expect(container.querySelector('.duo-solo-confirm__body')?.textContent).toBe(
      '一个人报名也可以，只是不会和 TA 同桌。',
    )
    expect(container.querySelector('.duo-solo-confirm__primary-text')?.textContent).toBe('还是一起去')
    expect(container.querySelector('.duo-solo-confirm__secondary-text')?.textContent).toBe('就我一个人')
  })

  it('长名经 truncateDuoName 截断（>6 字 → 6 字+…），缺省兜底「朋友」', () => {
    const { container: longName } = renderDialog({ inviterName: '一二三四五六七' })
    expect(longName.querySelector('.duo-solo-confirm__title')?.textContent).toBe(
      '这场是和 一二三四五六… 约好的',
    )
    const { container: noName } = renderDialog({ inviterName: '' })
    expect(noName.querySelector('.duo-solo-confirm__title')?.textContent).toBe('这场是和 朋友 约好的')
  })
})

describe('DuoSoloConfirmDialog — D-4 结构与交互', () => {
  it('主按钮唯一实心紫且居上（DOM 顺序在次按钮之前）；无 × 关闭按钮', () => {
    const { container } = renderDialog()
    const card = container.querySelector('.duo-solo-confirm')
    expect(card).not.toBeNull()
    const primary = card?.querySelector('.duo-solo-confirm__primary')
    const secondary = card?.querySelector('.duo-solo-confirm__secondary')
    expect(primary).not.toBeNull()
    expect(secondary).not.toBeNull()
    // 主按钮居上（默认焦点 = 文档序第一行动点）。
    expect(primary!.compareDocumentPosition(secondary!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // 无 × 关闭元素（reg-confirm 有 __close，本弹窗必须没有对应物）。
    expect(card?.querySelector('[aria-label=\'关闭\']')).toBeNull()
    expect(card?.textContent).not.toContain('×')
  })

  it('遮罩点击 ≡ 主按钮（dismiss，不提交变更）', () => {
    const { container, onStayTogether, onGoSolo } = renderDialog()
    fireEvent.click(container.querySelector('.duo-solo-confirm-overlay')!)
    expect(onStayTogether).toHaveBeenCalledTimes(1)
    expect(onGoSolo).not.toHaveBeenCalled()
  })

  it('主按钮 → onStayTogether；次按钮 → onGoSolo（卡片本体点击不透传遮罩）', () => {
    const { container, onStayTogether, onGoSolo } = renderDialog()
    fireEvent.click(container.querySelector('.duo-solo-confirm__primary')!)
    expect(onStayTogether).toHaveBeenCalledTimes(1)
    expect(onGoSolo).not.toHaveBeenCalled()
    fireEvent.click(container.querySelector('.duo-solo-confirm__secondary')!)
    expect(onGoSolo).toHaveBeenCalledTimes(1)
    expect(onStayTogether).toHaveBeenCalledTimes(1)
  })

  it('visible=false 时不渲染（退出即时卸载）', () => {
    const { container } = renderDialog({ visible: false })
    expect(container.querySelector('.duo-solo-confirm-overlay')).toBeNull()
  })

  it('role=dialog + aria-modal + aria-labelledby 指向标题', () => {
    const { container } = renderDialog()
    const card = container.querySelector('.duo-solo-confirm')
    expect(card?.getAttribute('role')).toBe('dialog')
    expect(card?.getAttribute('aria-modal')).toBe('true')
    expect(card?.getAttribute('aria-labelledby')).toBe('duo-solo-confirm-title')
    expect(container.querySelector('#duo-solo-confirm-title')).not.toBeNull()
  })
})

describe('DuoSoloConfirmDialog — D-7 动效与 haptics', () => {
  it('打开时 haptics light；reduced-motion 下 haptics 照常（spy 断言）', () => {
    renderDialog()
    expect(mockHaptics).toHaveBeenCalledWith('light')
    vi.clearAllMocks()
    renderDialog({ reduceMotion: true })
    expect(mockHaptics).toHaveBeenCalledWith('light')
  })

  it('按钮 haptics 均 light（reduced-motion 照常）', () => {
    const { container } = renderDialog({ reduceMotion: true })
    vi.clearAllMocks()
    fireEvent.click(container.querySelector('.duo-solo-confirm__primary')!)
    expect(mockHaptics).toHaveBeenCalledWith('light')
    fireEvent.click(container.querySelector('.duo-solo-confirm__secondary')!)
    expect(mockHaptics).toHaveBeenCalledTimes(2)
  })

  it('reduced-motion：overlay 与 card 均切 --static（无动画）', () => {
    const { container } = renderDialog({ reduceMotion: true })
    expect(container.querySelector('.duo-solo-confirm-overlay--static')).not.toBeNull()
    expect(container.querySelector('.duo-solo-confirm--static')).not.toBeNull()
  })
})

describe('DuoSoloConfirmDialog — 工程结构合同（D-4/D-7/D-10）', () => {
  const dialogSource = readFileSync(
    resolve(__dirname, '..', 'components', 'DuoSoloConfirmDialog.tsx'),
    'utf-8',
  )
  const dialogScss = readFileSync(
    resolve(__dirname, '..', 'components', 'DuoSoloConfirmDialog.scss'),
    'utf-8',
  )

  it('否决 Taro.showModal / ActionSheet——组件零引用', () => {
    expect(dialogSource).not.toContain('showModal')
    expect(dialogSource).not.toContain('ActionSheet')
    expect(dialogSource).not.toContain('showActionSheet')
  })

  it('文案全部来自 duoCopy 常量（组件不内联 D-5 字符串）', () => {
    expect(dialogSource).toContain('DUO_SOLO_CONFIRM_BODY')
    expect(dialogSource).toContain('DUO_SOLO_CONFIRM_PRIMARY')
    expect(dialogSource).toContain('DUO_SOLO_CONFIRM_SECONDARY')
    expect(dialogSource).toContain('getDuoSoloConfirmTitle')
    expect(dialogSource).not.toContain('一个人报名也可以')
    expect(dialogSource).not.toContain('还是一起去\'')
    expect(dialogSource).not.toContain('就我一个人\'')
  })

  it('D-7: 复用 reg-confirm 既有 keyframes，SCSS 零 @keyframes 定义', () => {
    expect(dialogScss).toContain('animation: reg-confirm-backdrop-in 200ms')
    expect(dialogScss).toContain('animation: reg-confirm-card-pop 320ms')
    expect(dialogScss).not.toContain('@keyframes')
  })

  it('D-4: 两按钮命中区 ≥88rpx（主 96rpx / 次 88rpx），主按钮实心 $color-primary', () => {
    expect(dialogScss).toContain('height: 96rpx')
    expect(dialogScss).toContain('height: 88rpx')
    expect(dialogScss).toContain('background: $color-primary')
    // 标题单行防御（540/544rpx 贴边的 CSS 兜底；真机数列入合并前手工核验）。
    expect(dialogScss).toContain('@include text-truncate')
  })

  it('TSX 不 import 自己的 SCSS（subpackage 分包样式门：由页面 SCSS @use）', () => {
    expect(dialogSource).not.toContain("import './DuoSoloConfirmDialog.scss'")
    expect(dialogSource).not.toContain('.scss')
  })
})
