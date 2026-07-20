import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  attemptMiniProgramNavigation,
  getCurrentMiniProgramRoute,
  normalizeMiniProgramRoute,
} from './reliableMiniProgramNavigation'

const mocks = vi.hoisted(() => ({
  getCurrentPages: vi.fn(),
}))

vi.mock('@tarojs/taro', () => ({
  default: {
    getCurrentPages: mocks.getCurrentPages,
  },
}))

describe('reliableMiniProgramNavigation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCurrentPages.mockReturnValue([])
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('normalizes routes before comparing a page stack with a destination URL', () => {
    expect(normalizeMiniProgramRoute('/subpackages/alang/search/index?slug=alang-demo'))
      .toBe('subpackages/alang/search/index')
  })

  it('prefers the native page stack when the Taro wrapper is unavailable or stale', () => {
    vi.stubGlobal('getCurrentPages', () => [{ route: 'subpackages/alang/search/index' }])

    expect(getCurrentMiniProgramRoute()).toBe('subpackages/alang/search/index')
    expect(mocks.getCurrentPages).not.toHaveBeenCalled()
  })

  it('falls back to the Taro page stack when the native stack is empty', () => {
    vi.stubGlobal('getCurrentPages', () => [])
    mocks.getCurrentPages.mockReturnValue([{ route: 'subpackages/alang/search/index' }])

    expect(getCurrentMiniProgramRoute()).toBe('subpackages/alang/search/index')
    expect(mocks.getCurrentPages).toHaveBeenCalledTimes(1)
  })

  it('falls back to the Taro page stack when the native reader throws', () => {
    vi.stubGlobal('getCurrentPages', () => {
      throw new Error('native page stack unavailable')
    })
    mocks.getCurrentPages.mockReturnValue([{ route: 'subpackages/alang/search/index' }])

    expect(getCurrentMiniProgramRoute()).toBe('subpackages/alang/search/index')
    expect(mocks.getCurrentPages).toHaveBeenCalledTimes(1)
  })

  it('does not treat a success callback with an unknown page stack as committed', async () => {
    vi.useFakeTimers()
    const attempt = attemptMiniProgramNavigation(
      () => Promise.resolve(),
      null,
      'subpackages/alang/search/index',
      () => true,
      'NAVIGATION_TIMEOUT',
    )

    await vi.advanceTimersByTimeAsync(3_100)

    await expect(attempt).resolves.toEqual({ committed: false })
  })

  it('commits only after the target route appears in the page stack', async () => {
    vi.useFakeTimers()
    let currentRoute = 'subpackages/alang/config/index'
    mocks.getCurrentPages.mockImplementation(() => [{ route: currentRoute }])
    setTimeout(() => {
      currentRoute = 'subpackages/alang/search/index'
    }, 500)

    const attempt = attemptMiniProgramNavigation(
      () => Promise.resolve(),
      'subpackages/alang/config/index',
      'subpackages/alang/search/index',
      () => true,
      'NAVIGATION_TIMEOUT',
    )

    await vi.advanceTimersByTimeAsync(700)

    await expect(attempt).resolves.toEqual({ committed: true })
  })
})
