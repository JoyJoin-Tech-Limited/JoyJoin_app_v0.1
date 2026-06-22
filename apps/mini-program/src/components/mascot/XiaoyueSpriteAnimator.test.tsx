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
  it('uses setInterval for looping frame playback', () => {
    vi.useFakeTimers()
    const setIntervalSpy = vi.spyOn(global, 'setInterval')
    const { container } = render(<XiaoyueSpriteAnimator state='coach' />)
    const img = container.querySelector('img')

    expect(img).toBeTruthy()
    expect(setIntervalSpy).toHaveBeenCalledTimes(1)

    const style = img?.getAttribute('style') || ''
    expect(style).not.toContain('steps(')
    expect(style).not.toContain('1200ms')

    setIntervalSpy.mockRestore()
    vi.useRealTimers()
  })

  it('drives one-shot states with setInterval', () => {
    vi.useFakeTimers()
    const setIntervalSpy = vi.spyOn(global, 'setInterval')
    const { container } = render(<XiaoyueSpriteAnimator state='celebrate' />)
    const img = container.querySelector('img')
    const style = img?.getAttribute('style') || ''

    expect(setIntervalSpy).toHaveBeenCalledTimes(1)
    expect(style).not.toContain('steps(')

    setIntervalSpy.mockRestore()
    vi.useRealTimers()
  })

  it('renders a static first frame when reduced motion is enabled', () => {
    vi.useFakeTimers()
    vi.mocked(Taro.getSystemInfoSync).mockReturnValueOnce({ reduceMotion: true } as any)

    const setIntervalSpy = vi.spyOn(global, 'setInterval')
    const { container } = render(<XiaoyueSpriteAnimator state='coach' />)
    const img = container.querySelector('img') as HTMLImageElement | null

    expect(setIntervalSpy).not.toHaveBeenCalled()
    expect(img?.getAttribute('style')).not.toContain('steps(')

    setIntervalSpy.mockRestore()
    vi.useRealTimers()
  })

  it('renders a static frame when staticFrame is provided', () => {
    vi.useFakeTimers()
    const setIntervalSpy = vi.spyOn(global, 'setInterval')
    const { container } = render(<XiaoyueSpriteAnimator state='coach' staticFrame={3} />)
    const img = container.querySelector('img') as HTMLImageElement | null

    expect(setIntervalSpy).not.toHaveBeenCalled()
    expect(img?.getAttribute('style')).not.toContain('steps(')

    setIntervalSpy.mockRestore()
    vi.useRealTimers()
  })

  it('cleans up timers and app lifecycle listeners on unmount', () => {
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval')
    const offAppShowSpy = vi.spyOn(Taro, 'offAppShow')
    const offAppHideSpy = vi.spyOn(Taro, 'offAppHide')

    const { unmount } = render(<XiaoyueSpriteAnimator state='celebrate' />)
    unmount()

    expect(clearIntervalSpy).toHaveBeenCalled()
    expect(offAppShowSpy).toHaveBeenCalled()
    expect(offAppHideSpy).toHaveBeenCalled()

    clearIntervalSpy.mockRestore()
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
