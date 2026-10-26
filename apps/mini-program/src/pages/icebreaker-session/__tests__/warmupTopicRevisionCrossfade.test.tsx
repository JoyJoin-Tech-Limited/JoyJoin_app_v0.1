import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { WarmupCardSlot } from '../components/WarmupCardSlot'
import type { SocialTopic } from '@shared/socialIcebreaker'

vi.mock('@tarojs/components', () => ({
  View: (props: Record<string, unknown>) => <div {...props} />,
  Text: (props: Record<string, unknown>) => <span {...props} />,
  Image: ({ lazyLoad: _lazyLoad, ...rest }: Record<string, unknown>) => <img {...rest} />,
  Button: (props: Record<string, unknown>) => <button {...props} />,
}))

vi.mock('../../../hooks/useAIGCLabelsEnabled', () => ({
  useAIGCLabelsEnabled: () => false,
}))

vi.mock('../../../hooks/useDeviceTier', () => ({
  useDeviceTier: () => ({ isDegradation: false }),
}))

vi.mock('../../../hooks/useTierReveal', () => ({
  useTierReveal: () => ({ revealedCount: 0, tiers: [] }),
}))

vi.mock('../../../lib/utils/haptics', () => ({ haptics: vi.fn() }))
vi.mock('../../../lib/analytics/socialIcebreakerAnalytics', () => ({
  socialIcebreakerAnalytics: { track: vi.fn() },
}))
vi.mock('../../../lib/mascot/xiaoyueExpressions', () => ({
  getXiaoyueExpressionAsset: () => 'https://cdn.example/xiaoyue.webp',
}))
vi.mock('../../../lib/utils/systemInfo', () => ({
  getWindowInfoCompat: () => ({ windowWidth: 375 }),
  getSystemReducedMotionCompat: () => false,
}))
vi.mock('../WarmupEmberRim', () => ({
  WarmupEmberRim: () => null,
  useEmberSync: () => ({ embers: [], halo: 'off', entering: false }),
}))

const topic = (id: string, question: string): SocialTopic => ({
  id,
  question,
  mood: 'relaxed',
  emoji: '',
  category: '轻松开场',
  depthLevel: 1,
  promptStyle: 'binary',
  safety: 'gentle',
})

function renderSlot(revision: number, topics: ReturnType<typeof topic>[], index = 0) {
  return render(
    <WarmupCardSlot
      state='topic_card'
      topics={topics}
      currentIndex={index}
      topicSetRevision={revision}
      isFlipped
      reduceMotion={false}
      isDeepPromptExpanded={false}
      onGenerateTopics={() => {}}
      onRetry={() => {}}
      onToggleDeepPrompt={() => {}}
      onFeedbackTap={() => {}}
    />,
  )
}

describe('WarmupCardSlot — whole-deck revision crossfade (AC-04/AC-10)', () => {
  it('plays the quiet switch when the revision changes even if index stays 0', async () => {
    const oldTopics = [topic('old-1', '旧问题一'), topic('old-2', '旧问题二')]
    const newTopics = [topic('new-1', '新问题一'), topic('new-2', '新问题二')]
    const view = renderSlot(1, oldTopics, 0)
    expect(screen.getByText('旧问题一')).toBeInTheDocument()

    view.rerender(
      <WarmupCardSlot
        state='topic_card'
        topics={newTopics}
        currentIndex={0}
        topicSetRevision={2}
        isFlipped
        reduceMotion={false}
        isDeepPromptExpanded={false}
        onGenerateTopics={() => {}}
        onRetry={() => {}}
        onToggleDeepPrompt={() => {}}
        onFeedbackTap={() => {}}
      />,
    )

    const next = await screen.findByText('新问题一')
    await waitFor(() => {
      expect(next.className).toContain('warmup-card-slot__question--switching')
    })
  })

  it('does not replay the switch for an unchanged revision on re-render', async () => {
    const topics = [topic('same-1', '同一个问题')]
    const view = renderSlot(3, topics, 0)
    view.rerender(
      <WarmupCardSlot
        state='topic_card'
        topics={topics}
        currentIndex={0}
        topicSetRevision={3}
        isFlipped
        reduceMotion={false}
        isDeepPromptExpanded={false}
        onGenerateTopics={() => {}}
        onRetry={() => {}}
        onToggleDeepPrompt={() => {}}
        onFeedbackTap={() => {}}
      />,
    )
    const question = screen.getByText('同一个问题')
    expect(question.className).not.toContain('warmup-card-slot__question--switching')
  })
})
