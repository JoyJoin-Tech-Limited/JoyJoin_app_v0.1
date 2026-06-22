// Accessibility name lookup for tab-switch announcements.
// Kept as a file-scoped constant so _announceTab can fall back even if a
// WeChat runtime fails to attach root-level properties to the custom-tab-bar
// instance (observed on iPhone / iOS 26.1 / WeChat 8.0.74 as
// "undefined is not an object (evaluating 'this._tabNames[e]')").
var TAB_NAMES = { 0: '发现', 1: '足迹', 2: '连接', 3: '我的', 4: '中心入口' }

// WeChat normally only attaches the custom-tab-bar component on tabBar pages,
// but in some base-library / routing scenarios it can be attached to non-tab
// pages (e.g. the landing page). Keep an explicit allow-list and hide the bar
// when that happens instead of leaking a fixed-position UI over the page.
// Source of truth: MINI_PROGRAM_TAB_BAR_CONFIG_ITEMS in
// apps/mini-program/src/lib/navigation/tabBarConfig.ts (referenced by
// tabBar.list in apps/mini-program/src/app.config.ts).
// If the tabBar list changes, this allow-list must be updated too.
var TAB_BAR_PAGE_PATHS = {
  'pages/discover/index': true,
  'pages/events/index': true,
  'pages/connections/index': true,
  'pages/profile/index': true,
  'pages/center-hub/index': true,
}

// Layout constants for the sliding active pill (must stay in sync with index.wxss).
// 750rpx design width minus surface margins, row padding, and center gap.
var TAB_BAR_CENTER_GAP_RPX = 192
var TAB_BAR_SURFACE_MARGIN_RPX = 24
var TAB_BAR_ROW_PADDING_RPX = 24

function computeTabItemWidth(windowWidth) {
  var designWidth = 750
  var availableRpx =
    designWidth -
    TAB_BAR_SURFACE_MARGIN_RPX * 2 -
    TAB_BAR_ROW_PADDING_RPX * 2 -
    TAB_BAR_CENTER_GAP_RPX
  return availableRpx / 4
}

function computePillTranslateX(index, itemWidth) {
  if (index < 0 || index > 3) return 0
  var gapOffset = index >= 2 ? TAB_BAR_CENTER_GAP_RPX : 0
  return Math.round(index * itemWidth + gapOffset)
}

Component({
  options: {
    addGlobalClass: true,
  },

  // Internal debounce / diff state (not reactive)
  _syncTimer: null,
  _showTimer: null,
  _announceTimer: null,
  _lastBadgesKey: '',
  // Last selection confirmed by syncState (authoritative) — used for rollback
  _confirmedSelected: 0,
  _platform: '',
  _isLowEnd: false,
  _isOffline: false,
  _networkStatusHandler: null,
  // Switch guard: ignore tab taps while a wx.switchTab is already in flight.
  _switchInFlight: false,
  _switchFlightTimer: null,
  // Transition interrupt: disable CSS transition when a new tap arrives while
  // the previous pill animation is still running, so rapid switches snap.
  _transitionRestoreTimer: null,
  _lastPillSetAt: 0,
  // Last sync state; re-applied when network comes back online.
  _lastSyncState: null,
  // Discover-only scroll-responsive collapse: set to true when the component
  // is detached so callers (e.g. pages/discover) can no-op gracefully.
  _isDetached: false,
  // Name lookup for accessibility announcements (re-assigned in attached
  // to guarantee it exists on the instance before any tap callback runs).
  _tabNames: TAB_NAMES,

  data: {
    selected: 0,
    lowEnd: false,
    announcement: '',
    // Guard against the tab bar being attached to a non-tab page.
    // Default to hidden until a tab page explicitly calls setSelected().
    hidden: true,
    // CSS transition toggle for interruptible rapid switching.
    pillTransitionEnabled: true,
    // Discover-only scroll-responsive collapse state (initially expanded).
    collapsed: false,
    // Sliding active pill geometry (in rpx)
    pillWidth: 0,
    pillTranslateX: 0,
    tabItemWidth: 0,
    center: {
      label: '进行中',
      showBadge: false,
      action: {
        kind: 'discover',
        navigation: 'switchTab',
        url: '/pages/center-hub/index',
      },
    },
    leftTabs: [
      {
        key: 'discover',
        index: 0,
        url: '/pages/discover/index',
        text: '发现',
        icon: '../assets/tab-icons/发现 icon_inactive.png',
        selectedIcon: '../assets/tab-icons/发现 icon.png',
        badgeCount: 0,
        badgeCategory: 'discover',
      },
      {
        key: 'events',
        index: 1,
        url: '/pages/events/index',
        text: '足迹',
        icon: '../assets/tab-icons/足迹 icon_inactive.png',
        selectedIcon: '../assets/tab-icons/足迹 icon.png',
        badgeCount: 0,
        badgeCategory: 'activities',
      },
    ],
    rightTabs: [
      {
        key: 'connections',
        index: 2,
        url: '/pages/connections/index',
        text: '连接',
        icon: '../assets/tab-icons/连接 icon_inactive.png',
        selectedIcon: '../assets/tab-icons/连接 icon.png',
        badgeCount: 0,
        badgeCategory: 'chat',
      },
      {
        key: 'profile',
        index: 3,
        url: '/pages/profile/index',
        text: '我的',
        icon: '../assets/tab-icons/我的 icon_inactive.png',
        selectedIcon: '../assets/tab-icons/我的 icon.png',
        badgeCount: 0,
        badgeCategory: null,
      },
    ],
  },

  lifetimes: {
    attached: function () {
      var self = this
      // Reset the detached guard so re-attached instances accept state updates.
      this._isDetached = false
      try {
        var info = wx.getSystemInfoSync ? wx.getSystemInfoSync() : {}
        this._platform = info.platform || 'other'
        this._isLowEnd = this._detectLowEnd(info)
      } catch (_e) {
        this._platform = 'unknown'
        this._isLowEnd = false
      }
      if (this._isLowEnd) {
        this.setData({ lowEnd: true })
      }

      // Determine visibility based on the current page route. This prevents the
      // custom tab bar from rendering on non-tab pages such as the landing page.
      this._updateVisibility()

      // Compute sliding pill geometry from the current screen width.
      // Values are stored in rpx so inline styles can use them directly.
      var windowWidth = info.windowWidth || 375
      var itemWidth = Math.round(computeTabItemWidth(windowWidth))
      // If the component is ever re-attached, keep the pill aligned with the
      // rendered selection instead of snapping back to index 0.
      var currentSelected = Number(this.data.selected) || 0
      this._confirmedSelected = currentSelected
      this.setData({
        tabItemWidth: itemWidth,
        pillWidth: itemWidth,
        pillTranslateX: computePillTranslateX(currentSelected, itemWidth),
      })

      // Re-assign the accessibility map to the instance. Some WeChat runtimes
      // do not reliably copy root-level non-data fields onto custom-tab-bar
      // instances, which left this._tabNames undefined inside _announceTab.
      this._tabNames = TAB_NAMES
      // Detect initial network state for offline guard
      if (wx.getNetworkType) {
        wx.getNetworkType({
          success: function (res) {
            self._isOffline = res.networkType === 'none'
          },
        })
      }
      if (wx.onNetworkStatusChange) {
        this._networkStatusHandler = function (res) {
          var wasOffline = self._isOffline
          self._isOffline = !res.isConnected
          // When reconnecting, replay the last sync state so badges/center
          // don't stay stale while the page's own refetch is still in flight.
          if (wasOffline && !self._isOffline && self._lastSyncState) {
            self.syncState(self._lastSyncState)
          }
        }
        wx.onNetworkStatusChange(this._networkStatusHandler)
      }
    },
    detached: function () {
      this._isDetached = true
      clearTimeout(this._syncTimer)
      clearTimeout(this._showTimer)
      clearTimeout(this._switchFlightTimer)
      clearTimeout(this._transitionRestoreTimer)
      clearTimeout(this._announceTimer)
      if (wx.offNetworkStatusChange && this._networkStatusHandler) {
        wx.offNetworkStatusChange(this._networkStatusHandler)
        this._networkStatusHandler = null
      }
    },
  },

  /**
   * Device-tier detection for the native tab bar.
   * Mirrors apps/mini-program/src/hooks/useDeviceTier.ts so older iPhones
   * without benchmarkLevel still get the degradation-tier animation disable.
   */
  _detectLowEnd: function (info) {
    var benchmarkLevel = info.benchmarkLevel
    if (typeof benchmarkLevel === 'number' && benchmarkLevel > 0) {
      return benchmarkLevel <= 15
    }

    // iOS / unsupported benchmarkLevel: use model + system version heuristics.
    var model = (info.model || '').toLowerCase()
    var system = (info.system || '').toLowerCase()

    // iPhone X/8/7/6/SE (1st gen) and older → degradation.
    // Exclude modern variants that share a prefix: XR, XS, SE2/SE3/2020/2022.
    var isModernSE = /iphone\s*se.*(2|3|2020|2022|2nd|3rd)/i.test(model)
    var oldModel =
      /iphone\s*(x|8|7|6|6s|se)\b/.test(model) &&
      !/iphone\s*(xr|xs|11|12|13|14|15|16)/.test(model) &&
      !isModernSE
    var oldOS =
      system.indexOf('ios ') === 0 &&
      parseFloat(system.replace('ios ', '')) < 15

    return oldModel || oldOS
  },

  pageLifetimes: {
    // Safety net: if an optimistic update left selected in a wrong state
    // after swipe-back, reset to the last confirmed value after syncState
    // has had time to fire (syncState debounce = 50ms).
    show: function () {
      var self = this
      // Re-evaluate visibility whenever the tab bar is shown; this covers
      // navigation between tab and non-tab pages in edge-case routing scenarios.
      this._updateVisibility()
      clearTimeout(this._showTimer)
      this._showTimer = setTimeout(function () {
        var idx = self._confirmedSelected
        var expectedTranslateX = computePillTranslateX(idx, self.data.tabItemWidth)
        // Re-sync both the label/icon highlight and the sliding pill. The pill
        // can drift without `selected` changing (e.g., a failed switchTab
        // rollback only reset `selected`).
        if (self.data.selected !== idx || self.data.pillTranslateX !== expectedTranslateX) {
          self._setPillState(idx, expectedTranslateX)
        }
      }, 100)
    },
  },

  methods: {
    /**
     * Hide the tab bar when attached to a page that is not in tabBar.list.
     * Uses getCurrentPages() because the component has no other way to know
     * the host route.
     */
    _updateVisibility: function () {
      if (typeof getCurrentPages !== 'function') return
      var pages = getCurrentPages()
      var route = pages.length > 0 ? pages[pages.length - 1].route : ''
      // WeChat base libraries differ: some return `pages/discover/index`,
      // others return `/pages/discover/index`. Taro may also append query params
      // (e.g. `$taroTimestamp=...`). Normalize before the allow-list lookup so
      // the tab bar isn't accidentally hidden on valid tab pages.
      route = typeof route === 'string' ? route.replace(/^\/+/, '').split('?')[0] : ''
      // Only hide when we are *certain* this is a non-tab page. The custom tab
      // bar is normally only attached to tab pages; defaulting to hidden and
      // letting setSelected() reveal it avoids the tab bar disappearing when
      // getCurrentPages() is empty or the route format is unexpected.
      if (route && !TAB_BAR_PAGE_PATHS[route]) {
        if (!this.data.hidden) {
          this.setData({ hidden: true })
        }
      }
    },

    /**
     * Set selected + pillTranslateX in one setData, with transition interrupt.
     * If a new selection arrives within the CSS transition window (220 ms),
     * disable the transition so the pill snaps to the new tab instead of
     * animating across intermediate tabs during rapid back-and-forth taps.
     */
    _setPillState: function (selected, translateX) {
      var now = Date.now()
      var transitionEnabled = true
      if (this._lastPillSetAt && now - this._lastPillSetAt < 220) {
        transitionEnabled = false
      }
      this._lastPillSetAt = now

      var self = this
      this.setData({
        selected: selected,
        pillTranslateX: translateX,
        pillTransitionEnabled: transitionEnabled,
      })

      if (!transitionEnabled) {
        clearTimeout(this._transitionRestoreTimer)
        this._transitionRestoreTimer = setTimeout(function () {
          self.setData({ pillTransitionEnabled: true })
        }, 50)
      }
    },

    /**
     * Called by useCustomTabBarSync hook via Taro.getTabBar(page).
     * Accepts: { selected, center, badges? }
     *
     * Debounced (50 ms) + diffed to prevent redundant setData bursts
     * from multiple alive tab pages. Badge updates use path syntax
     * to avoid array reconstruction and icon flicker.
     */
    syncState: function (state) {
      var self = this
      // Always keep the last known state so we can replay it on reconnect.
      this._lastSyncState = state
      // Skip state updates while offline — badge counts are stale without network.
      // The network-status handler will re-call syncState when reconnecting.
      if (this._isOffline) return
      clearTimeout(this._syncTimer)

      this._syncTimer = setTimeout(function () {
        var update = {}
        var hasChange = false

        // Note: `selected` is NEVER passed by the hook.
        // handleTabTap/handleCenterTap are the sole authorities.
        // If selected ever drifts, pageLifetimes.show safety net
        // reverts it to _confirmedSelected.

        // Center: shallow-compare key fields to avoid re-rendering identical state
        if (state.center) {
          var currentCenter = self.data.center
          var centerChanged = false
          if (state.center.label !== currentCenter.label) centerChanged = true
          if (state.center.showBadge !== currentCenter.showBadge) centerChanged = true
          if (state.center.action && state.center.action.url !== currentCenter.action.url) centerChanged = true
          if (state.center.action && state.center.action.kind !== currentCenter.action.kind) centerChanged = true
          if (state.center.action && state.center.action.navigation !== currentCenter.action.navigation) centerChanged = true

          if (centerChanged) {
            update.center = state.center
            hasChange = true
          }
        }

        // Badges: path-based in-place updates; skip if unchanged
        if (state.badges) {
          var badgesKey = JSON.stringify(state.badges)
          if (badgesKey !== self._lastBadgesKey) {
            self._lastBadgesKey = badgesKey
            var leftTabs = self.data.leftTabs
            var rightTabs = self.data.rightTabs
            var badgesChanged = false

            leftTabs.forEach(function (tab, idx) {
              var count = tab.badgeCategory ? (state.badges[tab.badgeCategory] || 0) : 0
              if (tab.badgeCount !== count) {
                update['leftTabs[' + idx + '].badgeCount'] = count
                badgesChanged = true
              }
            })

            rightTabs.forEach(function (tab, idx) {
              var count = tab.badgeCategory ? (state.badges[tab.badgeCategory] || 0) : 0
              if (tab.badgeCount !== count) {
                update['rightTabs[' + idx + '].badgeCount'] = count
                badgesChanged = true
              }
            })

            if (badgesChanged) hasChange = true
          }
        }

        if (hasChange) {
          self.setData(update)
        }
      }, 50)
    },

    setSelected: function (selected) {
      var idx = Number(selected)
      this._confirmedSelected = idx
      var translateX = computePillTranslateX(idx, this.data.tabItemWidth)
      this._setPillState(idx, translateX)
      // A tab page is taking ownership of this instance; make sure it is visible.
      if (this.data.hidden) {
        this.setData({ hidden: false })
      }
    },

    setCenterState: function (center) {
      this.setData({ center: center })
    },

    setBadges: function (badges) {
      this.syncState({ badges: badges })
    },

    /**
     * Discover-only scroll-responsive collapse.
     * Expands/collapses the tab bar surface and center CTA via CSS class.
     * Returns true when the state changed and setData was called.
     * Returns false when detached, hidden, or already in the target state.
     */
    setCollapsed: function (collapsed) {
      if (!this || this._isDetached) return false
      var next = Boolean(collapsed)
      if (this.data.collapsed === next) return false
      // Announce state change for screen-reader users, auto-cleared after 1 s.
      var announcement = next ? '标签栏已收起' : '标签栏已展开'
      this.setData({ collapsed: next, announcement: announcement })
      var self = this
      clearTimeout(this._announceTimer)
      this._announceTimer = setTimeout(function () {
        if (self.data.announcement === announcement) {
          self.setData({ announcement: '' })
        }
      }, 1000)
      return true
    },

    /**
     * Mark a tab switch as in-flight and arm a 2 s safety timeout. We ignore
     * additional taps while a switch is pending so rapid back-and-forth taps
     * cannot queue conflicting wx.switchTab calls.
     */
    _startSwitchFlight: function () {
      var self = this
      this._switchInFlight = true
      clearTimeout(this._switchFlightTimer)
      this._switchFlightTimer = setTimeout(function () {
        self._switchInFlight = false
      }, 2000)
    },

    _endSwitchFlight: function () {
      this._switchInFlight = false
      clearTimeout(this._switchFlightTimer)
    },

    handleTabTap: function (e) {
      var self = this
      // Ignore taps while a previous switch is still pending. The 2 s safety
      // timeout inside _startSwitchFlight ensures we never stay locked if the
      // WeChat runtime fails to call success/fail.
      if (this._switchInFlight) return

      var index = Number(e.currentTarget.dataset.index)
      var url = e.currentTarget.dataset.url
      var tabKey = e.currentTarget.dataset.tab
      var previousSelected = this._confirmedSelected

      // No-op if already on this tab (defensive: dataset may arrive as a string).
      if (index === previousSelected) return

      this.trackTabBarEvent('mini_program_tab_bar_tap', {
        tab: tabKey || 'unknown',
        index: index,
      })

      // Optimistic update: update _confirmedSelected too so the
      // pageLifetimes.show safety net (100ms) doesn't revert it.
      this._confirmedSelected = index
      var translateX = computePillTranslateX(index, this.data.tabItemWidth)
      this._setPillState(index, translateX)
      this._startSwitchFlight()
      wx.switchTab({
        url: url,
        success: function () {
          self._endSwitchFlight()
          self._announceTab(index)
          self.trackTabBarEvent('mini_program_tab_bar_switch_success', {
            tab: tabKey || 'unknown',
            index: index,
          })
        },
        fail: function (err) {
          self._endSwitchFlight()
          console.warn('[TabBar] switchTab failed for tab ' + tabKey + ':', err)
          self._confirmedSelected = previousSelected
          var rollbackTranslateX = computePillTranslateX(previousSelected, self.data.tabItemWidth)
          self._setPillState(previousSelected, rollbackTranslateX)
          self._showSwitchFailToast()
          self.trackTabBarEvent('mini_program_tab_bar_switch_fail', {
            tab: tabKey || 'unknown',
            index: index,
            error: (err && err.errMsg) || 'unknown',
          })
        },
      })

      this._triggerHaptic()
    },

    handleCenterTap: function () {
      var self = this
      if (this._switchInFlight) return

      var action = this.data.center && this.data.center.action
      if (!action || !action.url) return

      var previousSelected = this._confirmedSelected

      // No-op if already on center hub
      if (previousSelected === 4) return

      this.trackTabBarEvent('mini_program_center_button_tap', {
        action_kind: action.kind || 'unknown',
        navigation: action.navigation || 'unknown',
      })

      // Optimistic update: update _confirmedSelected too so the
      // pageLifetimes.show safety net (100ms) doesn't revert it.
      this._confirmedSelected = 4
      // Hide the sliding pill while the center button is selected.
      this._setPillState(4, 0)
      this._startSwitchFlight()
      wx.switchTab({
        url: action.url,
        success: function () {
          self._endSwitchFlight()
          self._announceTab(4)
          self.trackTabBarEvent('mini_program_center_button_switch_success', {
            action_kind: action.kind || 'unknown',
          })
        },
        fail: function (err) {
          self._endSwitchFlight()
          console.warn('[TabBar] switchTab failed for center:', err)
          self._confirmedSelected = previousSelected
          var rollbackTranslateX = computePillTranslateX(previousSelected, self.data.tabItemWidth)
          self._setPillState(previousSelected, rollbackTranslateX)
          self._showSwitchFailToast()
          self.trackTabBarEvent('mini_program_center_button_switch_fail', {
            action_kind: action.kind || 'unknown',
            error: (err && err.errMsg) || 'unknown',
          })
        },
      })

      this._triggerHaptic()
    },

    /**
     * Announce tab switch for screen readers via hidden aria-live region.
     * Auto-clears after 1s to avoid stale announcements.
     */
    _announceTab: function (index) {
      var names = this._tabNames || TAB_NAMES
      var name = names[index] || ''
      if (!name) return
      this.setData({ announcement: '已切换到' + name })
      var self = this
      clearTimeout(this._announceTimer)
      this._announceTimer = setTimeout(function () {
        if (self.data.announcement) self.setData({ announcement: '' })
      }, 1000)
    },

    /**
     * Subtle user-facing feedback when wx.switchTab fails.
     * Analytics + console.warn already fire; this prevents a silent UI rollback.
     */
    _showSwitchFailToast: function () {
      if (!wx.showToast) return
      try {
        wx.showToast({
          title: '切换失败，请重试',
          icon: 'none',
          duration: 2000,
        })
      } catch (_e) {
        // Toast is decorative; ignore devices without support.
      }
    },

    /**
     * Platform-aware haptic feedback.
     * iOS: uses type='light' for refined feedback.
     * Android: plain vibrateShort (type is ignored on many devices).
     * Silently fails on devices without vibration support.
     */
    _triggerHaptic: function () {
      if (!wx.vibrateShort) return
      try {
        if (this._platform === 'ios') {
          wx.vibrateShort({ type: 'light' })
        } else {
          wx.vibrateShort()
        }
      } catch (e) {
        // Silently fail — haptics are decorative, not functional
      }
    },

    trackTabBarEvent: function (eventType, data) {
      try {
        wx.reportAnalytics(eventType, data)
      } catch (err) {
        console.warn('[TabBarAnalytics]', eventType, data)
      }
    },

    /**
     * Observability hook for image load failures in the tab bar.
     * WeChat does not surface broken image URLs by default; logging here
     * lets us distinguish asset bundling/path issues from runtime decoder
     * issues (e.g. WebP decoding failures on certain base-library versions).
     */
    handleIconError: function (e) {
      var dataset = (e && e.currentTarget && e.currentTarget.dataset) || {}
      var detail = (e && e.detail) || {}
      var errorInfo = {
        tab: dataset.tab || 'unknown',
        src: dataset.src || '',
        errMsg: detail.errMsg || 'image load failed',
      }
      console.warn('[TabBar] icon load failed:', errorInfo)
      this.trackTabBarEvent('mini_program_tab_bar_icon_error', errorInfo)
    },


  },
})
