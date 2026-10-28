import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { HostTableBriefPopover } from '../components/HostTableBriefPopover'

vi.mock('@tarojs/components', () => ({
  View: (props: Record<string, unknown>) => <div {...props} />,
  Text: (props: Record<string, unknown>) => <span {...props} />,
}))

vi.mock('../../../lib/utils/haptics', () => ({
  haptics: vi.fn(),
}))

import { haptics } from '../../../lib/utils/haptics'

describe('HostTableBriefPopover — optional host-only quiet hint', () => {
  it('shows the pace and one real anchor without profile narration', () => {
    render(
      <HostTableBriefPopover
        paceShort='先聊具体小事，顺畅就不必换'
        anchorLabel='最近的短途出行'
        onClose={() => {}}
      />,
    )
    expect(screen.getByText('先聊具体小事，顺畅就不必换')).toBeInTheDocument()
    expect(screen.getByText('「最近的短途出行」会比较好接')).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/画像|AI|匹配|分数|根据数据/)
  })

  it('omits an invented anchor or avoid-domain when no authoritative input exists', () => {
    render(<HostTableBriefPopover paceShort='先聊具体小事' onClose={() => {}} />)
    expect(screen.queryByText(/会比较好接/)).not.toBeInTheDocument()
    expect(screen.queryByText(/先不展开/)).not.toBeInTheDocument()
    expect(screen.getByText('不想答就跳过，先听也可以')).toBeInTheDocument()
  })

  it('closes once with a light haptic and an 88rpx target class', () => {
    const onClose = vi.fn()
    render(<HostTableBriefPopover paceShort='先聊具体小事' onClose={onClose} />)
    const close = screen.getByRole('button', { name: '收起桌边小提示' })
    expect(close.className).toContain('host-table-brief__close')
    fireEvent.click(close)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(haptics).toHaveBeenCalledWith('light')
  })
})
