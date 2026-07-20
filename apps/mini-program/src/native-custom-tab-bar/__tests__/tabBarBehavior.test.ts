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
    switchTab: vi.fn().mockImplementation(({ success, fail }: { success?: Function; fail?: Function }) => {
      // WeChat invokes success/fail asynchronously; use setTimeout so tests
      // can observe the optimistic update before rollback.
      setTimeout(() => {
        if (opts.switchTabResult === 'fail') {
          fail?.({ errMsg: 'switchTab:fail page not found' })
        } else {
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

  it('preserves the current selection when re-attached', async () => {
    setupMocks()
    const component = await loadComponent()

    component.setData({ selected: 2 })
    component.attached()

    expect(component.data.selected).toBe(2)
    expect(component._confirmedSelected).toBe(2)
  })

  it('updates the active highlight when a side tab is tapped', async () => {
    setupMocks({ switchTabResult: 'success' })
    const component = await loadComponent()
    component.attached()

    component.handleTabTap(makeEvent(1, '/pages/events/index', 'events'))

    expect(component.data.selected).toBe(1)
    expect(component._confirmedSelected).toBe(1)
  })

  it('selects the center hub when the center button is tapped', async () => {
    setupMocks({ switchTabResult: 'success' })
    const component = await loadComponent()
    component.attached()

    component.handleCenterTap()

    expect(component.data.selected).toBe(CENTER_TAB_INDEX)
    expect(component._confirmedSelected).toBe(CENTER_TAB_INDEX)
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
    expect(component._confirmedSelected).toBe(1)
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

  it('no-ops when tapping the already-selected side tab', async () => {
    setupMocks({ switchTabResult: 'success' })
    const component = await loadComponent()
    component.attached()

    component.handleTabTap(makeEvent(0, '/pages/discover/index', 'discover'))

    expect(global.wx.switchTab).not.toHaveBeenCalled()
    expect(global.wx.vibrateShort).not.toHaveBeenCalled()
  })

  it('no-ops when tapping the already-selected center button', async () => {
    setupMocks({ switchTabResult: 'success' })
    const component = await loadComponent()
    component.attached()
    component.setSelected(CENTER_TAB_INDEX)

    component.handleCenterTap()

    expect(global.wx.switchTab).not.toHaveBeenCalled()
  })

  it('rolls back optimistic selection and shows toast when switchTab fails', async () => {
    setupMocks({ switchTabResult: 'fail' })
    const component = await loadComponent()
    component.attached()

    component.handleTabTap(makeEvent(2, '/pages/connections/index', 'connections'))

    // Optimistic update happens synchronously.
    expect(component.data.selected).toBe(2)
    expect(component._confirmedSelected).toBe(2)

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

  it('ignores rapid taps while a switchTab is already in flight', async () => {
    setupMocks({ switchTabResult: 'success' })
    const component = await loadComponent()
    component.attached()

    component.handleTabTap(makeEvent(1, '/pages/events/index', 'events'))
    component.handleTabTap(makeEvent(2, '/pages/connections/index', 'connections'))

    // Only the first tap should trigger switchTab.
    expect(global.wx.switchTab).toHaveBeenCalledTimes(1)
    expect(component.data.selected).toBe(1)

    // After the in-flight switch completes, a new tap works.
    await vi.advanceTimersByTimeAsync(0)
    component.handleTabTap(makeEvent(2, '/pages/connections/index', 'connections'))
    expect(global.wx.switchTab).toHaveBeenCalledTimes(2)
    expect(component.data.selected).toBe(2)
  })


  it('releases a stuck in-flight guard after the safety timeout', async () => {
    setupMocks({ switchTabResult: 'success' })
    const component = await loadComponent()
    component.attached()

    component.handleTabTap(makeEvent(1, '/pages/events/index', 'events'))
    // Mock never advances timers, so success/fail never runs.
    component.handleTabTap(makeEvent(2, '/pages/connections/index', 'connections'))
    expect(global.wx.switchTab).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(2000)
    component.handleTabTap(makeEvent(2, '/pages/connections/index', 'connections'))
    expect(global.wx.switchTab).toHaveBeenCalledTimes(2)
  })

  it('switches to center hub and highlights the center index', async () => {
    setupMocks({ switchTabResult: 'success' })
    const component = await loadComponent()
    component.attached()

    component.handleCenterTap()

    expect(component.data.selected).toBe(CENTER_TAB_INDEX)
    expect(component._confirmedSelected).toBe(CENTER_TAB_INDEX)
    expect(global.wx.switchTab).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/pages/center-hub/index' })
    )

    await vi.advanceTimersByTimeAsync(0)
    expect(component.data.announcement).toBe('已切换到中心入口')
  })

  it('rolls back the center selection when switchTab fails', async () => {
    setupMocks({ switchTabResult: 'fail' })
    const component = await loadComponent()
    component.attached()

    // Start on the events tab so we can verify selection rolls back to it.
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
        label: '匹配中',
        showBadge: true,
        action: { kind: 'pending-registration', navigation: 'switchTab', url: '/pages/center-hub/index' },
      },
      badges: { discover: 3, activities: 0, chat: 12 },
    })

    await vi.advanceTimersByTimeAsync(50)

    expect(component.data.center.label).toBe('匹配中')
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
    expect(component.data.hidden).toBe(true)

    component.setSelected(0)
    expect(component.data.hidden).toBe(false)
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
    'pages/event-ticket-payment/index',
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
    expect(component.data.hidden).toBe(true)

    component.setSelected(0)
    expect(component.data.hidden).toBe(false)
    expect(component.data.selected).toBe(0)

    component.show()
    expect(component.data.hidden).toBe(false)
    expect(component.data.selected).toBe(0)
  })

  describe('setCollapsed', () => {
    it('collapses and expands the tab bar', async () => {
      setupMocks()
      const component = await loadComponent()
      component.attached()

      expect(component.data.collapsed).toBe(false)

      const collapsedResult = component.setCollapsed(true)
      expect(collapsedResult).toBe(true)
      expect(component.data.collapsed).toBe(true)

      const expandedResult = component.setCollapsed(false)
      expect(expandedResult).toBe(true)
      expect(component.data.collapsed).toBe(false)
    })

    it('returns false without redundant setData when already in target state', async () => {
      setupMocks()
      const component = await loadComponent()
      component.attached()

      expect(component.setCollapsed(false)).toBe(false)
      expect(component.data.collapsed).toBe(false)
    })

    it('returns false and no-ops when the component is detached', async () => {
      setupMocks()
      const component = await loadComponent()
      component.attached()

      component.detached()

      const result = component.setCollapsed(true)
      expect(result).toBe(false)
      expect(component.data.collapsed).toBe(false)
    })

    it('allows setCollapsed to work again after detach + re-attach', async () => {
      setupMocks()
      const component = await loadComponent()
      component.attached()

      component.detached()
      expect(component._isDetached).toBe(true)
      expect(component.setCollapsed(true)).toBe(false)

      // Simulate WeChat re-attaching the custom tab bar instance.
      component.attached()
      expect(component._isDetached).toBe(false)

      expect(component.setCollapsed(true)).toBe(true)
      expect(component.data.collapsed).toBe(true)

      expect(component.setCollapsed(false)).toBe(true)
      expect(component.data.collapsed).toBe(false)
    })

    it('allows collapse state changes on low-end devices (gating is caller responsibility)', async () => {
      setupMocks()
      const component = await loadComponent()
      component.attached()
      component.setData({ lowEnd: true })

      expect(component.setCollapsed(true)).toBe(true)
      expect(component.data.collapsed).toBe(true)
    })

    it('announces collapse state for screen readers and clears after 1 s', async () => {
      setupMocks()
      const component = await loadComponent()
      component.attached()

      component.setCollapsed(true)
      expect(component.data.announcement).toBe('标签栏已收起')

      await vi.advanceTimersByTimeAsync(1000)
      expect(component.data.announcement).toBe('')

      component.setCollapsed(false)
      expect(component.data.announcement).toBe('标签栏已展开')

      await vi.advanceTimersByTimeAsync(1000)
      expect(component.data.announcement).toBe('')
    })
  })
})
