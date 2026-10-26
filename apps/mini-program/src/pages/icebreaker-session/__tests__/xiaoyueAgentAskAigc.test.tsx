import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { XiaoyueAgentAsk } from '../components/XiaoyueAgentAsk'
import { buildXiaoyueAgentAskViewModel, type XiaoyueAgentAskSnapshot } from '../viewModels/xiaoyueAgentAskModel'

const aigcState = vi.hoisted(() => ({ enabled: true }))

vi.mock('@tarojs/components', () => ({
  View: (props: Record<string, unknown>) => <div {...props} />,
  Text: (props: Record<string, unknown>) => <span {...props} />,
  Image: ({ lazyLoad: _lazyLoad, ...rest }: Record<string, unknown>) => <img {...rest} />,
  Button: (props: Record<string, unknown>) => <button {...props} />,
}))

vi.mock('../../../hooks/useAIGCLabelsEnabled', () => ({
  useAIGCLabelsEnabled: () => aigcState.enabled,
}))

vi.mock('../../../hooks/useDeviceTier', () => ({
  useDeviceTier: () => ({ isDegradation: false }),
}))

vi.mock('../../../components/ui/JoyJoinIcon', () => ({
  default: () => <span data-testid='icon' />,
}))

vi.mock('../../../components/ai-content/AIContentReportButton', () => ({
  default: () => <span>反馈</span>,
}))

function makeAsk(aiGenerated: boolean): XiaoyueAgentAskSnapshot {
  return {
    id: 'ask_aigc',
    kind: 'warmup_rotate_topics',
    phase: 'warmup',
    reason: 'topic_stall',
    createdAt: 1,
    baseTopicSetRevision: 1,
    status: 'pending',
    meta: { fallbackUsed: !aiGenerated, aigc: { aiGenerated } },
  }
}

function renderAsk(aiGenerated: boolean) {
  const view = buildXiaoyueAgentAskViewModel({
    ask: makeAsk(aiGenerated),
    stage: 'pending',
    slow: false,
    offline: false,
  })
  render(
    <XiaoyueAgentAsk
      view={view}
      onAccept={() => {}}
      onIgnore={() => {}}
      onCloseSession={() => {}}
      onRetry={() => {}}
      onDismissFailure={() => {}}
    />,
  )
}

describe('XiaoyueAgentAsk AIGC footer — per-item only (AC-14)', () => {
  it('does not label curated Ask copy even when global labels are enabled', () => {
    aigcState.enabled = true
    renderAsk(false)
    expect(screen.queryByText('内容由 AI 生成')).not.toBeInTheDocument()
  })

  it('does not label an AI item when global labels are disabled', () => {
    aigcState.enabled = false
    renderAsk(true)
    expect(screen.queryByText('内容由 AI 生成')).not.toBeInTheDocument()
  })

  it('labels only when the item meta itself says aiGenerated === true', () => {
    aigcState.enabled = true
    renderAsk(true)
    expect(screen.getByText('内容由 AI 生成')).toBeInTheDocument()
  })
})
