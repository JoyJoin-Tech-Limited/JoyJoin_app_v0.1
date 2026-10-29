import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import XiaoyueLetterCard from '../XiaoyueLetterCard'

vi.mock('@tarojs/components', () => ({
  View: (props: Record<string, unknown>) => <div {...props} />,
  Text: (props: Record<string, unknown>) => <span {...props} />,
  Image: (props: Record<string, unknown>) => <img {...props} />,
}))

vi.mock('@shared/archetypeColorTokens', () => ({ getArchetypeTokens: () => null }))
vi.mock('@shared/personality/archetypeNames', () => ({ ARCHETYPE_BY_ID: {} }))
vi.mock('../../../lib/mascot/xiaoyueExpressions', () => ({ getXiaoyueExpressionAsset: () => 'mascot.webp' }))
vi.mock('../../../lib/utils/cdnAssets', () => ({ localAsset: (path: string) => path }))
vi.mock('../MatchPromiseChip', () => ({ default: () => null }))
vi.mock('../PoolTeaserStrip', () => ({ default: () => null }))

const baseProps = {
  insight: '先吃得舒服，再慢慢聊开。',
  matchingPromise: '预算和活动期待会一起参与排桌。',
  reasons: [] as string[],
  trustLabel: '排桌后再揭晓桌友',
  visible: true,
  reduceMotion: true,
}

describe('XiaoyueLetterCard — factual decision note', () => {
  it('renders one benefit statement and at most two available facts in the existing letter', () => {
    const { container } = render(
      <XiaoyueLetterCard
        {...baseProps}
        decisionNote={{
          benefit: '先看时间、地点和费用是否合适，再决定是否留座。',
          facts: ['时间：10月31日 周六 19:30', '地点：南山区', '这条不应出现'],
        }}
      />,
    )

    expect(screen.getByText('先看时间、地点和费用是否合适，再决定是否留座。')).toBeInTheDocument()
    expect(screen.getByText('时间：10月31日 周六 19:30')).toBeInTheDocument()
    expect(screen.getByText('地点：南山区')).toBeInTheDocument()
    expect(screen.queryByText('这条不应出现')).not.toBeInTheDocument()
    expect(container.querySelectorAll('.xiaoyue-letter-card__decision-fact')).toHaveLength(2)
  })

  it('omits the decision block and empty facts when data is unavailable', () => {
    const { container, rerender } = render(<XiaoyueLetterCard {...baseProps} />)
    expect(container.querySelector('.xiaoyue-letter-card__decision-note')).toBeNull()

    rerender(
      <XiaoyueLetterCard
        {...baseProps}
        decisionNote={{ benefit: '先看事实再决定。', facts: ['', '  '] }}
      />,
    )
    expect(screen.getByText('先看事实再决定。')).toBeInTheDocument()
    expect(container.querySelector('.xiaoyue-letter-card__decision-facts')).toBeNull()
  })

  it('keeps fact text escaped rather than interpreting markup', () => {
    const { container } = render(
      <XiaoyueLetterCard
        {...baseProps}
        decisionNote={{ benefit: '先看事实再决定。', facts: ['<script>alert(1)</script>'] }}
      />,
    )

    expect(screen.getByText('<script>alert(1)</script>')).toBeInTheDocument()
    expect(container.querySelector('script')).toBeNull()
  })
})
