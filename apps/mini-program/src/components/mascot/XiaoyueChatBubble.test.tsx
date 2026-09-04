import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import Taro from '@tarojs/taro'
import XiaoyueChatBubble from './XiaoyueChatBubble'

vi.mock('@tarojs/components', () => ({
  View: (props: Record<string, unknown>) => <div {...props} />,
  Text: (props: Record<string, unknown>) => <span {...props} />,
  Image: (props: Record<string, unknown>) => <img {...props} />,
}))

vi.mock('../../lib/mascot/xiaoyueExpressions', () => ({
  getXiaoyueExpressionAsset: (id: string) => `/assets/xiaoyue-expressions/${id}.webp`,
}))

vi.mock('@tarojs/taro', () => ({
  default: { getSystemInfoSync: () => ({ reduceMotion: false }) },
}))

describe('XiaoyueChatBubble center-avatar gating', () => {
  it('applies --center-avatar to horizontal rows with avatar >= 152rpx', () => {
    const { container } = render(<XiaoyueChatBubble content='测试' horizontal avatarSize='200rpx' />)
    expect(container.querySelector('.xiaoyue-chat-bubble--center-avatar')).toBeTruthy()
  })

  it('keeps top-alignment (no --center-avatar) for the default 96rpx avatar', () => {
    const { container } = render(<XiaoyueChatBubble content='测试' horizontal />)
    expect(container.querySelector('.xiaoyue-chat-bubble--center-avatar')).toBeNull()
  })

  it('keeps top-alignment for explicit small avatarSize', () => {
    const { container } = render(<XiaoyueChatBubble content='测试' horizontal avatarSize='96rpx' />)
    expect(container.querySelector('.xiaoyue-chat-bubble--center-avatar')).toBeNull()
  })

  it('never centers the stacked (wide) layout', () => {
    const { container } = render(<XiaoyueChatBubble content='测试' wide avatarSize='200rpx' />)
    expect(container.querySelector('.xiaoyue-chat-bubble--center-avatar')).toBeNull()
  })

  it('never centers a hidden-avatar bubble', () => {
    const { container } = render(<XiaoyueChatBubble content='测试' horizontal hideAvatar avatarSize='200rpx' />)
    expect(container.querySelector('.xiaoyue-chat-bubble--center-avatar')).toBeNull()
  })
})

describe('XiaoyueChatBubble layout classes', () => {
  it('defaults to horizontal layout', () => {
    const { container } = render(<XiaoyueChatBubble content='测试' />)
    expect(container.querySelector('.xiaoyue-chat-bubble--horizontal')).toBeTruthy()
  })

  it('renders the speech tail only in the horizontal tailed path', () => {
    const { container } = render(<XiaoyueChatBubble content='测试' horizontal tail avatarSize='96rpx' />)
    expect(container.querySelector('.xiaoyue-chat-bubble__bubble--tail')).toBeTruthy()
  })

  it('omits the tail when the avatar is hidden', () => {
    const { container } = render(<XiaoyueChatBubble content='测试' horizontal tail hideAvatar />)
    expect(container.querySelector('.xiaoyue-chat-bubble__bubble--tail')).toBeNull()
  })
})
