import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mirrors the sentinel in native-custom-tab-bar/index.js.
const CENTER_TAB_INDEX = 4

// WeChat native component global stubs.
declare global {
  // eslint-disable-next-line no-var
  var Component: ReturnType<typeof vi.fn>
  // eslint-disable-next-line no-var
  var wx: Record<string, any>
  // eslint-disable-next-line no-var
  var getCurrentPages: () => Array<{ route?: string }>
}

interface ComponentConfig {
  options: Record<string, unknown>
  data: Record<string, unknown>
  lifetimes?: Record<string, Function>
  pageLifetimes?: Record<string, Function>
  methods?: Record<string, Function>
  [key: string]: any
}

interface ComponentInstance {
  data: Record<string, any>
  setData(update: Record<string, any>): void
  [key: string]: any
}

let lastComponentConfig: ComponentConfig | undefined

function setPath(obj: Record<string, any>, path: string, value: any) {
  const keys = path
    .split(/\.|\[|\]/)
    .filter(Boolean)
    .map((k) => (/^\d+$/.test(k) ? parseInt(k, 10) : k))
  const parent = keys.slice(0, -1).reduce((current, key) => current[key], obj)
  parent[keys[keys.length - 1]] = value
}

function createMockInstance(config: ComponentConfig): ComponentInstance {
  const instance: ComponentInstance = {
    data: JSON.parse(JSON.stringify(config.data || {})),
    setData(update: Record<string, any>) {
      Object.entries(update).forEach(([key, value]) => {
        if (key.includes('[') || key.includes('.')) {
          setPath(this.data, key, value)
        } else {
          this.data[key] = value
        }
      })
    },
  }

  // Copy top-level non-method fields (internal timers, flags, etc.).
  Object.keys(config).forEach((key) => {
    if (key === 'data' || key === 'lifetimes' || key === 'pageLifetimes' || key === 'methods' || key === 'options') {
      return
    }
    instance[key] = config[key]
  })

  // Bind methods.
  Object.entries(config.methods || {}).forEach(([key, fn]) => {
    instance[key] = (fn as Function).bind(instance)
  })

  // Bind lifetimes.
  Object.entries(config.lifetimes || {}).forEach(([key, fn]) => {
    instance[key] = (fn as Function).bind(instance)
  })
  Object.entries(config.pageLifetimes || {}).forEach(([key, fn]) => {
    instance[key] = (fn as Function).bind(instance)
  })

  return instance
}

function makeEvent(index: number, url: string, tab: string) {
  return {
    currentTarget: {
      dataset: { index, url, tab },
    },
  }
}

function setupMocks(opts: { switchTabResult?: 'success' | 'fail'; offline?: boolean; networkType?: string } = {}) {
  const networkHandlers: Array<(res: { isConnected: boolean }) => void> = []
  global.getCurrentPages = vi.fn().mockReturnValue([{ route: 'pages/discover/index' }])
  const wxMocks = {
    getSystemInfoSync: vi.fn().mockReturnValue({
      platform: 'devtools',
      model: 'iPhone 14',
      system: 'iOS 16.0',
      benchmarkLevel: 99,
    }),
    getNetworkType: vi.fn().mockImplementation(({ success }: { success: (res: { networkType: string }) => void }) => {
      success({ networkType: opts.networkType ?? (opts.offline ? 'none' : 'wifi') })
    }),
    onNetworkStatusChange: vi.fn().mockImplementation((handler: (res: { isConnected: boolean }) => void) => {
      networkHandlers.push(handler)
    }),
    offNetworkStatusChange: vi.fn().mockImplementation((handler: (res: { isConnected: boolean }) => void) => {
      const idx = networkHandlers.indexOf(handler)
      if (idx >= 0) networkHandlers.splice(idx, 1)
    }),
    switchTab: vi.fn().mockImplementation(({ url, success, fail }: { url: string; success?: Function; fail?: Function }) => {
      // WeChat invokes success/fail asynchronously; use setTimeout so tests
      // can observe the optimistic update before route reconciliation.
      setTimeout(() => {
        if (opts.switchTabResult === 'fail') {
          fail?.({ errMsg: 'switchTab:fail page not found' })
        } else {
          global.getCurrentPages = vi.fn().mockReturnValue([{ route: url.replace(/^\//, '') }])
          success?.({})
        }
      }, 0)
    }),
    showToast: vi.fn(),
    vibrateShort: vi.fn(),
    reportAnalytics: vi.fn(),
  }

  global.wx = wxMocks
  global.Component = vi.fn().mockImplementation((config: ComponentConfig) => {
    lastComponentConfig = config
    return createMockInstance(config)
  })

  return { wxMocks, networkHandlers }
}

async function loadComponent() {
  vi.resetModules()
  lastComponentConfig = undefined
  // index.js is a plain WeChat native component with no ESM exports.
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  await import('../index.js')
  if (!lastComponentConfig) throw new Error('Component was not registered')
  return createMockInstance(lastComponentConfig)
}

describe('native custom tab bar behavior', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('attaches, detects platform, and registers network listener', async () => {
    const { wxMocks, networkHandlers } = setupMocks()
    const component = await loadComponent()

    component.attached()

    expect(wxMocks.getSystemInfoSync).toHaveBeenCalled()
    expect(wxMocks.getNetworkType).toHaveBeenCalled()
    expect(wxMocks.onNetworkStatusChange).toHaveBeenCalled()
    expect(networkHandlers.length).toBe(1)
    expect(component.data.lowEnd).toBe(false)
  })

  it('marks low-end for old iPhones without benchmarkLevel', async () => {
    setupMocks()
    global.wx.getSystemInfoSync = vi.fn().mockReturnValue({
      platform: 'ios',
      model: 'iPhone 7',
      system: 'iOS 14.2',
    })
    const component = await loadComponent()

    component.attached()

    expect(component.data.lowEnd).toBe(true)
  })

  it('confirms the current selection on attach', async () => {
    setupMocks()
    const component = await loadComponent()

    component.attached()

    expect(component.data.selected).toBe(0)
    expect(component._confirmedSelected).toBe(0)
  })

  it('adopts the visible route on attach instead of stale instance state', async () => {
    setupMocks()
    const component = await loadComponent()

    // A re-created instance may still carry an outdated selection; the route
    // is the authority, so attach must converge to it (here: Discover = 0).
    component.setData({ selected: 2 })
    component.attached()

    expect(component.data.selected).toBe(0)
    expect(component._confirmedSelected).toBe(0)
    expect(component.data.hidden).toBe(false)
  })

  it('reveals an already-lit bar at attach on a tab page (no second tap)', async () => {
    setupMocks()
    global.getCurrentPages = vi.fn().mockReturnValue([{ route: 'pages/events/index' }])
    const component = await loadComponent()

    component.attached()

    expect(component.data.selected).toBe(1)
    expect(component.data.hidden).toBe(false)
  })

  it('updates the active highlight when a side tab is tapped', async () => {
    setupMocks({ switchTabResult: 'success' })
    const component = await loadComponent()
    component.attached()

    component.handleTabTap(makeEvent(1, '/pages/events/index', 'events'))

    expect(component.data.selected).toBe(1)
  })

  it('selects the center hub when the center button is tapped', async () => {
    setupMocks({ switchTabResult: 'success' })
    const component = await loadComponent()
    component.attached()

    component.handleCenterTap()

    expect(component.data.selected).toBe(CENTER_TAB_INDEX)
  })

  it('updates the active highlight via setSelected', async () => {
    setupMocks()
    const component = await loadComponent()
    component.attached()

    component.setSelected(3)

    expect(component.data.selected).toBe(3)
    expect(component._confirmedSelected).toBe(3)
  })

  it('switches side tab with optimistic highlight and announces on success', async () => {
    setupMocks({ switchTabResult: 'success' })
    const component = await loadComponent()
    component.attached()

    component.handleTabTap(makeEvent(1, '/pages/events/index', 'events'))

    expect(component.data.selected).toBe(1)
    expect(global.wx.switchTab).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/pages/events/index' })
    )
    expect(global.wx.vibrateShort).toHaveBeenCalled()
    expect(global.wx.reportAnalytics).toHaveBeenCalledWith(
      'mini_program_tab_bar_tap',
      expect.objectContaining({ tab: 'events', index: 1 })
    )

    // Announcement is set after the async switchTab success callback.
    await vi.advanceTimersByTimeAsync(0)
    expect(component.data.announcement).toBe('已切换到足迹')
  })

  it('re-taps the already-selected side tab through the page handler without a second switchTab', async () => {
    setupMocks({ switchTabResult: 'success' })
    const component = await loadComponent()
    component.attached()
    component.setRetapHandler(() => ({ action: 'scroll-to-top', atTop: false }))

    component.handleTabTap(makeEvent(0, '/pages/discover/index', 'discover'))

    // #2 (2026-11-19): a re-tap owes the user an outcome (scroll top / silent
    // refresh) plus a haptic, but it must never re-issue switchTab.
    expect(global.wx.switchTab).not.toHaveBeenCalled()
    expect(global.wx.vibrateShort).toHaveBeenCalledTimes(1)
    expect(global.wx.reportAnalytics).toHaveBeenCalledWith(
      'mini_program_tab_bar_retap',
      { tab: 'discover', at_top: 0, action: 'scroll-to-top' }
    )
  })

  it('no-ops when tapping the already-selected center button', async () => {
    setupMocks({ switchTabResult: 'success' })
    const component = await loadComponent()
    component.attached()
    global.getCurrentPages = vi.fn().mockReturnValue([{ route: 'pages/center-hub/index' }])
    component.setSelected(CENTER_TAB_INDEX)

    component.handleCenterTap()

    expect(global.wx.switchTab).not.toHaveBeenCalled()
    // A re-tap still acknowledges the press even when the destination is the
    // page already on screen.
    expect(global.wx.vibrateShort).toHaveBeenCalledTimes(1)
  })

  it('rolls back optimistic selection and shows toast when switchTab fails', async () => {
    setupMocks({ switchTabResult: 'fail' })
    const component = await loadComponent()
    component.attached()

    component.handleTabTap(makeEvent(2, '/pages/connections/index', 'connections'))

    // Optimistic update happens synchronously.
    expect(component.data.selected).toBe(2)

    // Failure callback runs asynchronously.
    await vi.advanceTimersByTimeAsync(0)

    expect(component._confirmedSelected).toBe(0)
    expect(component.data.selected).toBe(0)
    expect(global.wx.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: '切换失败，请重试', icon: 'none' })
    )
    expect(global.wx.reportAnalytics).toHaveBeenCalledWith(
      'mini_program_tab_bar_switch_fail',
      expect.objectContaining({ tab: 'connections' })
    )
  })

  it('coalesces rapid taps to one active request and one latest pending destination', async () => {
    setupMocks()
    const component = await loadComponent()
    component.attached()
    const callbacks: Array<{ success?: Function; fail?: Function }> = []
    global.wx.switchTab = vi.fn((options) => callbacks.push(options))

    component.handleTabTap(makeEvent(1, '/pages/events/index', 'events'))
    component.handleTabTap(makeEvent(2, '/pages/connections/index', 'connections'))
    component.handleTabTap(makeEvent(3, '/pages/profile/index', 'profile'))

    expect(global.wx.switchTab).toHaveBeenCalledTimes(1)
    expect(component.data.selected).toBe(3)
    expect(component._pendingSwitch.index).toBe(3)

    global.getCurrentPages = vi.fn().mockReturnValue([{ route: 'pages/events/index' }])
    callbacks[0].success?.({})
    expect(global.wx.switchTab).toHaveBeenCalledTimes(2)
    expect(global.wx.switchTab).toHaveBeenLastCalledWith(
      expect.objectContaining({ url: '/pages/profile/index' })
    )

    global.getCurrentPages = vi.fn().mockReturnValue([{ route: 'pages/profile/index' }])
    callbacks[1].success?.({})
    expect(component.data.selected).toBe(3)
    expect(component._confirmedSelected).toBe(3)
    expect(component._pendingSwitch).toBeNull()
  })

  it('releases the latest pending destination when the previous switch never calls back', async () => {
    setupMocks()
    const component = await loadComponent()
    component.attached()
    global.wx.switchTab = vi.fn()

    component.handleTabTap(makeEvent(1, '/pages/events/index', 'events'))
    component.handleTabTap(makeEvent(2, '/pages/connections/index', 'connections'))

    expect(global.wx.switchTab).toHaveBeenCalledTimes(1)
    expect(component.data.selected).toBe(2)
    await vi.advanceTimersByTimeAsync(400)
    expect(global.wx.switchTab).toHaveBeenCalledTimes(2)
    expect(global.wx.switchTab).toHaveBeenLastCalledWith(
      expect.objectContaining({ url: '/pages/connections/index' })
    )
  })

  it('restores visible-route selection when a lone request never calls back', async () => {
    const component = await loadComponent()
    component.attached()
    global.wx.switchTab = vi.fn()

    component.handleTabTap(makeEvent(1, '/pages/events/index', 'events'))
    expect(component.data.selected).toBe(1)

    await vi.advanceTimersByTimeAsync(400)
    expect(component._switchInFlight).toBe(false)
    expect(component.data.selected).toBe(0)
    expect(component._confirmedSelected).toBe(0)

    component.handleTabTap(makeEvent(1, '/pages/events/index', 'events'))
    expect(global.wx.switchTab).toHaveBeenCalledTimes(2)
  })

  it('ignores a stale failure after the latest destination succeeds', async () => {
    setupMocks()
    const component = await loadComponent()
    component.attached()
    const callbacks: Array<{ success?: Function; fail?: Function }> = []
    global.wx.switchTab = vi.fn((options) => callbacks.push(options))

    component.handleTabTap(makeEvent(1, '/pages/events/index', 'events'))
    component.handleTabTap(makeEvent(2, '/pages/connections/index', 'connections'))
    await vi.advanceTimersByTimeAsync(400)
    global.getCurrentPages = vi.fn().mockReturnValue([{ route: 'pages/connections/index' }])
    callbacks[1].success?.({})
    callbacks[0].fail?.({ errMsg: 'switchTab:fail stale request' })

    expect(component.data.selected).toBe(2)
    expect(component._confirmedSelected).toBe(2)
    expect(global.wx.showToast).not.toHaveBeenCalled()
  })

  it('ignores a stale success after the latest destination succeeds', async () => {
    setupMocks()
    const component = await loadComponent()
    component.attached()
    const callbacks: Array<{ success?: Function; fail?: Function }> = []
    global.wx.switchTab = vi.fn((options) => callbacks.push(options))

    component.handleTabTap(makeEvent(1, '/pages/events/index', 'events'))
    component.handleTabTap(makeEvent(2, '/pages/connections/index', 'connections'))
    await vi.advanceTimersByTimeAsync(400)
    global.getCurrentPages = vi.fn().mockReturnValue([{ route: 'pages/connections/index' }])
    callbacks[1].success?.({})
    global.getCurrentPages = vi.fn().mockReturnValue([{ route: 'pages/events/index' }])
    callbacks[0].success?.({})

    expect(component.data.selected).toBe(2)
    expect(component._confirmedSelected).toBe(2)
    expect(component.data.announcement).toBe('已切换到连接')
  })

  it('lets route truth win over a stale selected index on re-tap', async () => {
    setupMocks()
    global.getCurrentPages = vi.fn().mockReturnValue([{ route: 'pages/profile/index' }])
    const component = await loadComponent()
    component.attached()
    component.setData({ selected: 3, hidden: false })
    component._confirmedSelected = 0

    component.handleTabTap(makeEvent(3, '/pages/profile/index', 'profile'))

    expect(global.wx.switchTab).not.toHaveBeenCalled()
    expect(component.data.selected).toBe(3)
    expect(component._confirmedSelected).toBe(3)
  })

  it('switches to center hub and highlights the center index', async () => {
    setupMocks({ switchTabResult: 'success' })
    const component = await loadComponent()
    component.attached()

    component.handleCenterTap()

    expect(component.data.selected).toBe(CENTER_TAB_INDEX)
    expect(global.wx.switchTab).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/pages/center-hub/index' })
    )

    await vi.advanceTimersByTimeAsync(0)
    expect(component._confirmedSelected).toBe(CENTER_TAB_INDEX)
    expect(component.data.announcement).toBe('已切换到中心入口')
  })

  it('rolls back the center selection when switchTab fails', async () => {
    setupMocks({ switchTabResult: 'fail' })
    const component = await loadComponent()
    component.attached()

    // Start on the events tab so we can verify selection rolls back to it.
    global.getCurrentPages = vi.fn().mockReturnValue([{ route: 'pages/events/index' }])
    component.setSelected(1)

    component.handleCenterTap()

    // Optimistic update highlights the center button.
    expect(component.data.selected).toBe(CENTER_TAB_INDEX)

    // Failure callback runs asynchronously.
    await vi.advanceTimersByTimeAsync(0)

    expect(component._confirmedSelected).toBe(1)
    expect(component.data.selected).toBe(1)
  })

  it('syncState updates badges and center via path-based setData', async () => {
    setupMocks()
    const component = await loadComponent()
    component.attached()

    component.syncState({
      center: {
        label: '排桌中',
        showBadge: true,
        action: { kind: 'pending-registration', navigation: 'switchTab', url: '/pages/center-hub/index' },
      },
      badges: { discover: 3, activities: 0, chat: 12 },
    })

    await vi.advanceTimersByTimeAsync(50)

    expect(component.data.center.label).toBe('排桌中')
    expect(component.data.center.showBadge).toBe(true)
    expect(component.data.leftTabs[0].badgeCount).toBe(3)
    expect(component.data.leftTabs[1].badgeCount).toBe(0)
    expect(component.data.rightTabs[0].badgeCount).toBe(12)
    expect(component.data.rightTabs[1].badgeCount).toBe(0)
  })

  it('syncState debounces rapid badge updates', async () => {
    setupMocks()
    const component = await loadComponent()
    component.attached()

    component.syncState({ badges: { discover: 1, activities: 0, chat: 0 } })
    component.syncState({ badges: { discover: 2, activities: 0, chat: 0 } })
    component.syncState({ badges: { discover: 3, activities: 0, chat: 0 } })

    expect(component.data.leftTabs[0].badgeCount).toBe(0)

    await vi.advanceTimersByTimeAsync(50)

    expect(component.data.leftTabs[0].badgeCount).toBe(3)
    expect(global.wx.setData).not.toBeDefined() // sanity: our mock uses Object.assign
  })

  it('syncState skips updates while offline and replays on reconnect', async () => {
    setupMocks({ offline: true })
    const component = await loadComponent()
    component.attached()

    component.syncState({ badges: { discover: 5, activities: 0, chat: 0 } })
    await vi.advanceTimersByTimeAsync(50)

    // Offline guard prevents update.
    expect(component.data.leftTabs[0].badgeCount).toBe(0)

    // Simulate reconnect.
    component._networkStatusHandler({ isConnected: true })
    await vi.advanceTimersByTimeAsync(50)

    expect(component.data.leftTabs[0].badgeCount).toBe(5)
  })

  it('normalizes string selected values passed by WeChat framework', async () => {
    setupMocks()
    const component = await loadComponent()
    component.attached()

    component.setSelected('3')

    expect(component._confirmedSelected).toBe(3)
    expect(component.data.selected).toBe(3)
  })

  it('pageLifetimes.show safety net reverts drifted selected state', async () => {
    setupMocks()
    global.getCurrentPages = vi.fn().mockReturnValue([{ route: 'pages/discover/index' }])
    const component = await loadComponent()
    component.attached()

    // Simulate an optimistic update that never got confirmed.
    component.setData({ selected: 2 })
    component._confirmedSelected = 0

    component.show()
    await vi.advanceTimersByTimeAsync(100)

    expect(component.data.selected).toBe(0)
  })

  it('pageLifetimes.show syncs the active highlight from the current tab route', async () => {
    setupMocks()
    global.getCurrentPages = vi.fn().mockReturnValue([{ route: 'pages/events/index' }])
    const component = await loadComponent()
    component.attached()

    component.setData({ selected: 0 })
    component._confirmedSelected = 0

    component.show()

    expect(component._confirmedSelected).toBe(1)
    expect(component.data.selected).toBe(1)
    expect(component.data.hidden).toBe(false)
  })

  it('uses the top page route when deciding the active tab', async () => {
    setupMocks()
    global.getCurrentPages = vi.fn().mockReturnValue([
      { route: 'pages/discover/index' },
      { route: 'pages/events/index?$taroTimestamp=123' },
    ])
    const component = await loadComponent()
    component.attached()

    component.show()

    expect(component.data.selected).toBe(1)
  })

  it('detached clears timers and unregisters network listener', async () => {
    const { networkHandlers } = setupMocks()
    const component = await loadComponent()
    component.attached()

    component.detached()

    expect(networkHandlers.length).toBe(0)
    expect(global.wx.offNetworkStatusChange).toHaveBeenCalled()
  })

  it('cancels stale announcement after 1s', async () => {
    setupMocks({ switchTabResult: 'success' })
    const component = await loadComponent()
    component.attached()

    component.handleTabTap(makeEvent(1, '/pages/events/index', 'events'))
    await vi.advanceTimersByTimeAsync(0)
    expect(component.data.announcement).toBe('已切换到足迹')

    await vi.advanceTimersByTimeAsync(1000)
    expect(component.data.announcement).toBe('')
  })

  it('announces tab switch even when the runtime drops _tabNames from the instance', async () => {
    setupMocks({ switchTabResult: 'success' })
    const component = await loadComponent()
    component.attached()

    // Simulate WeChat runtimes that do not reliably attach root-level
    // non-data properties to custom-tab-bar instances (observed as
    // "undefined is not an object (evaluating 'this._tabNames[e]')").
    delete component._tabNames

    component.handleTabTap(makeEvent(1, '/pages/events/index', 'events'))
    await vi.advanceTimersByTimeAsync(0)

    expect(component.data.announcement).toBe('已切换到足迹')
  })

  it('shows the tab bar on tab pages regardless of leading slash or query in route', async () => {
    setupMocks()
    global.getCurrentPages = vi.fn().mockReturnValue([{ route: '/pages/discover/index?$taroTimestamp=123' }])
    const component = await loadComponent()

    component.attached()
    expect(component.data.hidden).toBe(false)

    component.show()
    expect(component.data.hidden).toBe(false)
    expect(component.data.selected).toBe(0)
  })

  it('hides the tab bar when attached to a known non-tab page', async () => {
    setupMocks()
    global.getCurrentPages = vi.fn().mockReturnValue([{ route: 'pages/index/index' }])
    const component = await loadComponent()

    component.attached()

    expect(component.data.hidden).toBe(true)
  })

  it.each([
    'pages/event-detail/index',
    'pages/payments/event-ticket-payment/index',
  ])('keeps the tab bar hidden on %s', async (route) => {
    setupMocks()
    const component = await loadComponent()

    global.getCurrentPages = vi.fn().mockReturnValue([{ route }])
    component.attached()
    expect(component.data.hidden).toBe(true)

    component.show()
    expect(component.data.hidden).toBe(true)
  })

  it('shows the Discover tab for pool-registration and keeps the bar visible on swipe-back', async () => {
    setupMocks()
    global.getCurrentPages = vi.fn().mockReturnValue([{ route: 'pages/pool-registration/index' }])
    const component = await loadComponent()

    component.attached()
    // Discover alias: the bar is revealed at attach and already lit.
    expect(component.data.hidden).toBe(false)
    expect(component.data.selected).toBe(0)

    component.show()
    expect(component.data.hidden).toBe(false)
    expect(component.data.selected).toBe(0)
  })

  describe('route-truth reconciliation', () => {
    it.each([
      ['pages/discover/index', 0],
      ['pages/events/index', 1],
      ['pages/connections/index', 2],
      ['pages/profile/index', 3],
      ['pages/center-hub/index', 4],
      ['pages/pool-registration/index', 0],
    ])('attaches on %s already revealed and lit (index %i)', async (route, index) => {
      setupMocks()
      global.getCurrentPages = vi.fn().mockReturnValue([{ route }])
      const component = await loadComponent()

      component.attached()

      // The regression this locks: a fresh instance used to stay hidden until a
      // single useDidShow push arrived. If that push was lost, the bar only lit
      // on the user's SECOND tap.
      expect(component.data.hidden).toBe(false)
      expect(component.data.selected).toBe(index)
      expect(component._confirmedSelected).toBe(index)
    })

    it('keeps the default hidden state when no page stack is readable', async () => {
      setupMocks()
      global.getCurrentPages = vi.fn().mockReturnValue([])
      const component = await loadComponent()

      expect(() => component.attached()).not.toThrow()
      expect(component.data.hidden).toBe(true)
    })

    it('still hides on a known non-tab route', async () => {
      setupMocks()
      global.getCurrentPages = vi.fn().mockReturnValue([{ route: 'pages/index/index' }])
      const component = await loadComponent()

      component.attached()

      expect(component.data.hidden).toBe(true)
    })

    it('does not re-render when show() finds the instance already correct', async () => {
      setupMocks()
      global.getCurrentPages = vi.fn().mockReturnValue([{ route: 'pages/events/index' }])
      const component = await loadComponent()
      component.attached()

      const setDataSpy = vi.spyOn(component, 'setData')
      component.show()

      expect(setDataSpy).not.toHaveBeenCalled()
    })

    it('does not let a mid-transition show() overwrite a just-landed route push', async () => {
      setupMocks()
      const component = await loadComponent()
      component.attached()

      // The page hook pushed 连接 while getCurrentPages() still reported 发现.
      component.setSelected(2)
      component.show()

      expect(component.data.selected).toBe(2)
      expect(component._confirmedSelected).toBe(2)
    })

    it('reconciles again once the push window has expired', async () => {
      setupMocks()
      const component = await loadComponent()
      component.attached()

      component.setSelected(2)
      component._lastPushAt = 0
      global.getCurrentPages = vi.fn().mockReturnValue([{ route: 'pages/events/index' }])
      component.show()

      expect(component.data.selected).toBe(1)
    })

    it('defers a show() inside the push window and reconciles just after it', async () => {
      setupMocks()
      global.getCurrentPages = vi.fn().mockReturnValue([{ route: 'pages/events/index' }])
      const component = await loadComponent()
      component.attached()

      // Route advanced to 连接, but a push landed inside the 400ms window:
      // the push is fresher than this read, so show() must not repaint.
      global.getCurrentPages = vi.fn().mockReturnValue([{ route: 'pages/connections/index' }])
      component._lastPushAt = Date.now() - 399
      component.show()
      expect(component.data.selected).toBe(1)

      // Same route, window expired: the route backstop takes over again.
      component._lastPushAt = Date.now() - 401
      component.show()
      expect(component.data.selected).toBe(2)
    })

    it('keeps an open sheet hidden through show()', async () => {
      setupMocks()
      const component = await loadComponent()
      component.attached()

      component.setSheetOpen(true)
      component.show()

      expect(component.data.sheetOpen).toBe(true)
    })

    it('plays the logo settle only for the first instance of a session', async () => {
      setupMocks()
      const first = await loadComponent()
      first.attached()
      expect(first.data.settle).toBe(true)

      // A second tab page builds its own instance from the same module.
      const second = createMockInstance(lastComponentConfig as ComponentConfig)
      second.attached()
      expect(second.data.settle).toBe(false)
    })

    it('releases the one-shot logo settle so a rebuilt subtree does not replay it', async () => {
      setupMocks()
      const component = await loadComponent()
      component.attached()
      expect(component.data.settle).toBe(true)

      await vi.advanceTimersByTimeAsync(450)

      // The WXML root sits behind `wx:if`: closing Discover's area-filter sheet
      // rebuilds the subtree, so a latched flag would replay the settle on a
      // screen the user never left.
      expect(component.data.settle).toBe(false)
    })

    it('opens a contextual center destination with navigateTo and never repaints the hub slot', async () => {
      setupMocks()
      const component = await loadComponent()
      component.attached()
      global.wx.navigateTo = vi.fn()

      component.setData({
        center: {
          label: '今日出发',
          showBadge: false,
          action: {
            kind: 'matched-event',
            navigation: 'navigateTo',
            url: '/pages/event-detail/index?id=event-1',
          },
        },
      })

      component.handleCenterTap()

      expect(global.wx.navigateTo).toHaveBeenCalledTimes(1)
      expect(global.wx.navigateTo.mock.calls[0][0].url).toBe('/pages/event-detail/index?id=event-1')
      expect(global.wx.switchTab).not.toHaveBeenCalled()
      // A navigateTo leaves the tab world untouched, so the hub slot must not
      // be painted selected optimistically.
      expect(component.data.selected).toBe(0)
      expect(global.wx.reportAnalytics).toHaveBeenCalledWith(
        'mini_program_center_button_tap',
        expect.objectContaining({ action_kind: 'matched-event', navigation: 'navigateTo' }),
      )
    })
  })
})
