import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import Taro from '@tarojs/taro'
import XiaoyueSpriteAnimator from './XiaoyueSpriteAnimator'

vi.mock('@tarojs/components', () => ({
  Image: (props: Record<string, unknown>) => <img {...props} />,
  View: (props: Record<string, unknown>) => <div {...props} />,
}))

vi.mock('../../hooks/useDeviceTier', () => ({
  useDeviceTier: () => ({ isDegradation: false }),
}))

vi.mock('../../assets/mascot/xiaoyue-spritesheet-manifest.json', () => ({
  default: {
    version: 1,
    frame: { width: 200, height: 200, padding: 2 },
    states: {
      coach: {
        sheet: 'xiaoyue-coach.webp',
        frameCount: 9,
        frameWidth: 200,
        frameHeight: 200,
        duration: 1200,
        loop: true,
        oneShot: false,
      },
      celebrate: {
        sheet: 'xiaoyue-celebrate.webp',
        frameCount: 7,
        frameWidth: 400,
        frameHeight: 400,
        duration: 1500,
        loop: false,
        oneShot: true,
      },
      success: {
        sheet: 'xiaoyue-success.webp',
        frameCount: 1,
        frameWidth: 200,
        frameHeight: 200,
        duration: 800,
        loop: false,
        oneShot: true,
      },
    },
  },
}))

describe('XiaoyueSpriteAnimator', () => {
  it('does not use setInterval for frame playback', () => {
    const setIntervalSpy = vi.spyOn(global, 'setInterval')
    const { container } = render(<XiaoyueSpriteAnimator state='coach' />)
    const img = container.querySelector('img')

    expect(img).toBeTruthy()
    expect(setIntervalSpy).not.toHaveBeenCalled()

    const style = img?.getAttribute('style') || ''
    expect(style).toContain('steps(9)')
    expect(style).toContain('1200ms')
    expect(style).toContain('infinite')

    setIntervalSpy.mockRestore()
  })

  it('drives one-shot states with CSS steps animation and no setInterval', () => {
    const setIntervalSpy = vi.spyOn(global, 'setInterval')
    const { container } = render(<XiaoyueSpriteAnimator state='celebrate' />)
    const img = container.querySelector('img')
    const style = img?.getAttribute('style') || ''

    expect(style).toContain('steps(7)')
    expect(style).toContain('1500ms')
    expect(style).not.toContain('infinite')
    expect(style).toContain('forwards')
    expect(setIntervalSpy).not.toHaveBeenCalled()

    setIntervalSpy.mockRestore()
  })

  it('renders a static first frame when reduced motion is enabled', () => {
    vi.mocked(Taro.getSystemInfoSync).mockReturnValueOnce({ reduceMotion: true } as any)

    const { container } = render(<XiaoyueSpriteAnimator state='coach' />)
    const img = container.querySelector('img') as HTMLImageElement | null

    expect(img?.style.animation).toBe('')
    expect(img?.getAttribute('style')).not.toContain('steps(')
  })

  it('renders a static frame when staticFrame is provided', () => {
    const { container } = render(<XiaoyueSpriteAnimator state='coach' staticFrame={3} />)
    const img = container.querySelector('img') as HTMLImageElement | null

    expect(img?.style.animation).toBe('')
    expect(img?.getAttribute('style')).not.toContain('steps(')
  })

  it('cleans up timers and app lifecycle listeners on unmount', () => {
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout')
    const offAppShowSpy = vi.spyOn(Taro, 'offAppShow')
    const offAppHideSpy = vi.spyOn(Taro, 'offAppHide')

    const { unmount } = render(<XiaoyueSpriteAnimator state='celebrate' />)
    unmount()

    expect(clearTimeoutSpy).toHaveBeenCalled()
    expect(offAppShowSpy).toHaveBeenCalled()
    expect(offAppHideSpy).toHaveBeenCalled()

    clearTimeoutSpy.mockRestore()
    offAppShowSpy.mockRestore()
    offAppHideSpy.mockRestore()
  })

  it('fires onComplete for one-shot states', () => {
    vi.useFakeTimers()
    const onComplete = vi.fn()

    render(<XiaoyueSpriteAnimator state='success' onComplete={onComplete} />)

    vi.advanceTimersByTime(800)
    expect(onComplete).toHaveBeenCalledTimes(1)

    vi.useRealTimers()
  })
})
