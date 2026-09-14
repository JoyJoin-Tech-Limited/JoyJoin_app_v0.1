/**
 * Sprint gm-debrief W7.1 — AIGC label is fail-closed on WarmupCardSlot.
 *
 * - No meta (curated fallback / route heal / legacy payload) → no label.
 * - Meta present but aiGenerated:false (curated) → no label.
 * - Meta present and aiGenerated:true (live LLM) → label renders.
 *
 * W7.5 structural: the dead `topicAigcMeta` default-true variable is gone.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { AIResponseMeta } from '@shared/types/aiMeta'
import { WarmupCardSlot } from '../WarmupCardSlot'

vi.mock('@tarojs/components', () => ({
  View: (props: Record<string, unknown>) => <div {...props} />,
  Text: (props: Record<string, unknown>) => <span {...props} />,
  Image: ({ lazyLoad: _lazyLoad, ...rest }: Record<string, unknown>) => <img {...rest} />,
  Button: (props: Record<string, unknown>) => <button {...props} />,
}))

vi.mock('../../../../hooks/useAIGCLabelsEnabled', () => ({
  useAIGCLabelsEnabled: vi.fn(() => true),
}))

vi.mock('../../../../hooks/useDeviceTier', () => ({
  useDeviceTier: vi.fn(() => ({ isDegradation: false })),
}))

vi.mock('../../../../hooks/useTierReveal', () => ({
  useTierReveal: vi.fn(() => ({ revealedCount: 0, tiers: [] })),
}))

vi.mock('../../../../lib/utils/haptics', () => ({ haptics: vi.fn() }))

vi.mock('../../../../lib/analytics/socialIcebreakerAnalytics', () => ({
  socialIcebreakerAnalytics: { track: vi.fn() },
}))

vi.mock('../../../../lib/mascot/xiaoyueExpressions', () => ({
  getXiaoyueExpressionAsset: vi.fn(() => 'https://cdn.example/xiaoyue.webp'),
}))

vi.mock('../../../../lib/utils/systemInfo', () => ({
  getWindowInfoCompat: vi.fn(() => ({ windowWidth: 375 })),
  getSystemReducedMotionCompat: vi.fn(() => true),
}))

vi.mock('../WarmupEmberRim', () => ({
  WarmupEmberRim: () => null,
  useEmberSync: vi.fn(() => ({
    embers: [],
    halo: 'off',
    entering: false,
  })),
}))

const baseMeta = (aigc?: AIResponseMeta['aigc']): AIResponseMeta => ({
  generatedAt: '2026-09-12T00:00:00.000Z',
  fromCache: false,
  provider: null,
  fallbackUsed: true,
  ...(aigc ? { aigc } : {}),
})

function renderSlot(warmupTopicsMeta?: AIResponseMeta) {
  return render(
    <WarmupCardSlot
      state='topic_card'
      topics={[
        {
          id: 't1',
          question: '最近有什么让你笑到停不下来的事？',
          mood: 'relaxed',
          emoji: '✨',
          category: '轻松开场',
          depthLevel: 1,
          promptStyle: 'binary',
          safety: 'gentle',
        },
      ]}
      currentIndex={0}
      isFlipped
      reduceMotion
      isDeepPromptExpanded={false}
      onGenerateTopics={() => {}}
      onRetry={() => {}}
      onToggleDeepPrompt={() => {}}
      onFeedbackTap={() => {}}
      warmupTopicsMeta={warmupTopicsMeta}
    />,
  )
}

describe('WarmupCardSlot — fail-closed AIGC label (W7.1)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does NOT render the label when meta is absent (curated fallback)', () => {
    renderSlot(undefined)
    expect(screen.queryByText('内容由 AI 生成')).not.toBeInTheDocument()
    expect(screen.queryByText('反馈')).not.toBeInTheDocument()
  })

  it('does NOT render the label when meta marks aiGenerated:false', () => {
    renderSlot(baseMeta({ aiGenerated: false }))
    expect(screen.queryByText('内容由 AI 生成')).not.toBeInTheDocument()
    expect(screen.queryByText('反馈')).not.toBeInTheDocument()
  })

  it('renders the label when meta marks aiGenerated:true (live LLM)', () => {
    renderSlot(baseMeta({ aiGenerated: true, labelType: 'ai-generated' }))
    expect(screen.getByText('内容由 AI 生成')).toBeInTheDocument()
    expect(screen.getByText('反馈')).toBeInTheDocument()
  })

  it('W7.5: the dead topicAigcMeta default-true variable is gone from source', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/pages/icebreaker-session/components/WarmupCardSlot.tsx'),
      'utf8',
    )
    expect(source).not.toContain('topicAigcMeta')
    expect(source).not.toContain('aiGenerated: true')
  })
})
