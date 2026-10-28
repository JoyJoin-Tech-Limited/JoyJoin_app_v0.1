import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import XiaoyueSessionShell from '../XiaoyueSessionShell'

vi.mock('@tarojs/components', () => ({
  View: (props: Record<string, unknown>) => <div {...props} />,
  Text: (props: Record<string, unknown>) => <span {...props} />,
  Image: ({ lazyLoad: _lazyLoad, ...rest }: Record<string, unknown>) => <img {...rest} />,
}))

vi.mock('../../../hooks/useAIGCLabelsEnabled', () => ({
  useAIGCLabelsEnabled: () => false,
}))

vi.mock('../../../lib/mascot/xiaoyueExpressions', () => ({
  getXiaoyueExpressionAsset: () => '/mock/xiaoyue.webp',
  ICEBREAKER_XIAOYUE_EXPRESSION: {},
}))

vi.mock('../../../lib/utils/haptics', () => ({ haptics: vi.fn() }))

vi.mock('../../ai-content/AIContentReportButton', () => ({
  default: () => <span>反馈</span>,
}))

const baseProps = {
  phase: 'warmup' as const,
  isHost: true,
}

describe('XiaoyueSessionShell — Quiet Concierge guidance', () => {
  it('uses one guidance line and does not duplicate the old host hint', () => {
    render(
      <XiaoyueSessionShell
        {...baseProps}
        guidanceLine='先聊具体小事，不想答就跳过'
        sessionPack={{
          phaseCoaching: {
            warmup: { toneLine: '原主线', hostHint: '旧的主持人提示' },
          },
        } as never}
      />,
    )
    expect(screen.getByText('先聊具体小事，不想答就跳过')).toBeInTheDocument()
    expect(screen.queryByText('旧的主持人提示')).not.toBeInTheDocument()
  })

  it('makes the phase row the only host-brief trigger', () => {
    const onOpenHostBrief = vi.fn()
    render(
      <XiaoyueSessionShell
        {...baseProps}
        guidanceLine='话题卡 · 先聊具体小事'
        hostBriefAvailable
        onOpenHostBrief={onOpenHostBrief}
      />,
    )
    const trigger = screen.getByRole('button', { name: '展开桌边小提示' })
    fireEvent.click(trigger)
    expect(onOpenHostBrief).toHaveBeenCalledTimes(1)
  })

  it('renders the optional brief in its own slot without changing the mascot', () => {
    render(
      <XiaoyueSessionShell
        {...baseProps}
        guidanceLine='话题卡 · 先聊具体小事'
        hostBrief={<div>桌边小提示内容</div>}
      />,
    )
    expect(screen.getByText('桌边小提示内容')).toBeInTheDocument()
    expect(document.querySelectorAll('img')).toHaveLength(1)
  })
})
