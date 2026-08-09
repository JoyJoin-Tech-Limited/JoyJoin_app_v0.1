import { beforeEach, describe, expect, it, vi } from 'vitest'
import { haptics } from './haptics'

const taroRuntime = vi.hoisted(() => ({
  vibrateShort: vi.fn(),
  vibrateLong: vi.fn(),
}))

vi.mock('@tarojs/taro', () => ({
  default: taroRuntime,
}))

describe('haptics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not block the primary action when canIUse is absent at runtime', () => {
    expect(() => haptics('success')).not.toThrow()
    expect(taroRuntime.vibrateShort).toHaveBeenCalledWith({ type: 'heavy' })
  })
})
