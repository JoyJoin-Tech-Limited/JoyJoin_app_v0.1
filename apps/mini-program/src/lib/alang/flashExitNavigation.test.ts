import { beforeEach, describe, expect, it, vi } from 'vitest'
import { leaveFlashStory } from './flashExitNavigation'

const navigation = vi.hoisted(() => ({
  redirectTo: vi.fn(),
  reLaunch: vi.fn(),
}))

vi.mock('@tarojs/taro', () => ({ default: navigation }))

describe('Flash settled-story exit navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    navigation.redirectTo.mockResolvedValue(undefined)
    navigation.reLaunch.mockResolvedValue(undefined)
  })

  it('leaves through redirectTo when the page stack accepts it', async () => {
    await leaveFlashStory('/pages/alang/event/index')

    expect(navigation.redirectTo).toHaveBeenCalledWith({ url: '/pages/alang/event/index' })
    expect(navigation.reLaunch).not.toHaveBeenCalled()
  })

  it('falls back to reLaunch when redirectTo cannot leave the settled story', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    navigation.redirectTo.mockRejectedValueOnce(new Error('redirect failed'))

    await leaveFlashStory('/pages/alang/event/index')

    expect(navigation.redirectTo).toHaveBeenCalledWith({ url: '/pages/alang/event/index' })
    expect(navigation.reLaunch).toHaveBeenCalledWith({ url: '/pages/alang/event/index' })
    expect(consoleError).toHaveBeenCalledOnce()
    consoleError.mockRestore()
  })
})
