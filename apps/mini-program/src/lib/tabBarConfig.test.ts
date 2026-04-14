import { describe, expect, it } from 'vitest'
import { MINI_PROGRAM_TAB_INDEX, MINI_PROGRAM_TAB_ITEMS } from './tabBarConfig'

describe('mini-program tab bar config', () => {
  it('keeps the canonical events tab wired to the second shell slot', () => {
    expect(MINI_PROGRAM_TAB_INDEX.events).toBe(1)
    expect(MINI_PROGRAM_TAB_ITEMS[1]).toMatchObject({
      key: 'events',
      pagePath: 'pages/events/index',
      url: '/pages/events/index',
      text: '足迹',
    })
  })
})
