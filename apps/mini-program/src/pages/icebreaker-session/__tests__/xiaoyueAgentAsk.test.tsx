import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { XiaoyueAgentAsk } from '../components/XiaoyueAgentAsk'
import { buildXiaoyueAgentAskViewModel, type XiaoyueAgentAskSnapshot } from '../viewModels/xiaoyueAgentAskModel'

vi.mock('@tarojs/components', () => ({
  View: (props: Record<string, unknown>) => <div {...props} />,
  Text: (props: Record<string, unknown>) => <span {...props} />,
  Image: ({ lazyLoad: _lazyLoad, ...rest }: Record<string, unknown>) => <img {...rest} />,
  Button: (props: Record<string, unknown>) => <button {...props} />,
}))

vi.mock('../../../hooks/useAIGCLabelsEnabled', () => ({
  useAIGCLabelsEnabled: vi.fn(() => false),
}))

vi.mock('../../../hooks/useDeviceTier', () => ({
  useDeviceTier: vi.fn(() => ({ isDegradation: false })),
}))

vi.mock('../../../components/ui/JoyJoinIcon', () => ({
  default: () => <span data-testid='icon' />,
}))

vi.mock('../../../components/ai-content/AIContentReportButton', () => ({
  default: () => <span>反馈</span>,
}))

const ask: XiaoyueAgentAskSnapshot = {
  id: 'ask_1',
  kind: 'warmup_rotate_topics',
  phase: 'warmup',
  reason: 'topic_stall',
  createdAt: 1,
  baseTopicSetRevision: 1,
  status: 'pending',
  meta: { fallbackUsed: true, aigc: { aiGenerated: false } },
}

function renderAsk(stage: 'pending' | 'executing' | 'success' | 'failed' | 'unknown', offline = false) {
  const view = buildXiaoyueAgentAskViewModel({ ask, stage, slow: false, offline })
  const handlers = {
    onAccept: vi.fn(),
    onIgnore: vi.fn(),
    onCloseSession: vi.fn(),
    onRetry: vi.fn(),
    onDismissFailure: vi.fn(),
  }
  render(<XiaoyueAgentAsk view={view} {...handlers} />)
  return handlers
}

describe('XiaoyueAgentAsk — host-only bounded card', () => {
  it('renders one question and a single explicit primary action', () => {
    const handlers = renderAsk('pending')
    expect(screen.getByText('这组先聊到这里吗？换一组新话题就好。')).toBeInTheDocument()
    expect(screen.getByText('换一组话题卡')).toBeInTheDocument()
    fireEvent.click(screen.getByText('换一组话题卡'))
    expect(handlers.onAccept).toHaveBeenCalledTimes(1)
  })

  it('ignores and closes without a blocking dialog', () => {
    const handlers = renderAsk('pending')
    fireEvent.click(screen.getByText('先不用'))
    fireEvent.click(screen.getByText('本场不再提示'))
    expect(handlers.onIgnore).toHaveBeenCalledTimes(1)
    expect(handlers.onCloseSession).toHaveBeenCalledTimes(1)
  })

  it('disables duplicate acceptance while executing and shows honest sync copy', () => {
    const handlers = renderAsk('executing')
    expect(screen.getByText('正在同步，当前话题仍可继续')).toBeInTheDocument()
    fireEvent.click(screen.getByText('正在换话题…'))
    expect(handlers.onAccept).not.toHaveBeenCalled()
  })

  it('offers retry after explicit failure and resync after unknown', () => {
    const failed = renderAsk('failed')
    fireEvent.click(screen.getByText('再试一次'))
    expect(failed.onRetry).toHaveBeenCalledTimes(1)
    expect(screen.getByText('这次还没换上，当前话题保留')).toBeInTheDocument()
  })

  it('keeps the current topic usable offline', () => {
    const offline = renderAsk('pending', true)
    expect(screen.getByText('连接恢复后再换，当前话题保留')).toBeInTheDocument()
    fireEvent.click(screen.getByText('换一组话题卡'))
    expect(offline.onAccept).not.toHaveBeenCalled()
  })
})
