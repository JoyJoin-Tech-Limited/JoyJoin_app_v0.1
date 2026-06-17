// Accessibility name lookup for tab-switch announcements.
// Kept as a file-scoped constant so _announceTab can fall back even if a
// WeChat runtime fails to attach root-level properties to the custom-tab-bar
// instance (observed on iPhone / iOS 26.1 / WeChat 8.0.74 as
// "undefined is not an object (evaluating 'this._tabNames[e]')").
var TAB_NAMES = { 0: '发现', 1: '足迹', 2: '连接', 3: '我的', 4: '中心入口' }

var TAB_TAP_DEBOUNCE_MS = 80
var ROUTE_TO_SELECTED = {
  'pages/discover/index': 0,
  'pages/events/index': 1,
  'pages/connections/index': 2,
  'pages/profile/index': 3,
  'pages/center-hub/index': 4,
}

function getCurrentRouteSelected() {
  try {
    var pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
    var current = pages && pages.length ? pages[pages.length - 1] : null
    var route = current && current.route
    return ROUTE_TO_SELECTED[route]
  } catch (_e) {
    return undefined
  }
}

Component({
  options: {
    addGlobalClass: true,
  },

  // Internal debounce / diff state (not reactive)
  _syncTimer: null,
  _showTimer: null,
  _tapDebounceTimer: null,
  _announceTimer: null,
  _lastBadgesKey: '',
  // Last selection confirmed by syncState (authoritative) — used for rollback
  _confirmedSelected: 0,
  _platform: '',
  _isLowEnd: false,
  _isOffline: false,
  _networkStatusHandler: null,
  // Last sync state; re-applied when network comes back online.
  _lastSyncState: null,
  // Name lookup for accessibility announcements (re-assigned in attached
  // to guarantee it exists on the instance before any tap callback runs).
  _tabNames: TAB_NAMES,

  data: {
    selected: 0,
    lowEnd: false,
    announcement: '',
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

      var routeSelected = getCurrentRouteSelected()
      if (routeSelected !== undefined) {
        this._applySelected(routeSelected)
      }

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
      clearTimeout(this._syncTimer)
      clearTimeout(this._showTimer)
      clearTimeout(this._tapDebounceTimer)
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
    // Safety net: route is the final authority for visible tab state.
    show: function () {
      var self = this
      clearTimeout(this._showTimer)
      this._showTimer = setTimeout(function () {
        var routeSelected = getCurrentRouteSelected()
        var idx = routeSelected !== undefined ? routeSelected : self._confirmedSelected
        if (self.data.selected !== idx) {
          self._applySelected(idx)
        }
      }, 0)
    },
  },

  methods: {
    _applySelected: function (selected) {
      var idx = Number(selected)
      if (Number.isNaN(idx)) return
      this._confirmedSelected = idx
      if (this.data.selected !== idx) {
        this.setData({ selected: idx })
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
      if (state && state.selected !== undefined) {
        this._applySelected(state.selected)
      }
      // Skip state updates while offline — badge counts are stale without network.
      // The network-status handler will re-call syncState when reconnecting.
      if (this._isOffline) return
      clearTimeout(this._syncTimer)

      this._syncTimer = setTimeout(function () {
        var update = {}
        var hasChange = false

        // Center: shallow-compare key fields to avoid re-rendering identical state
        if (state.center) {
          var currentCenter = self.data.center
          var centerChanged = false
          if (state.center.label !== currentCenter.label) centerChanged = true
          if (state.center.showBadge !== currentCenter.showBadge) centerChanged = true
          if (state.center.action && state.center.action.url !== currentCenter.action.url) centerChanged = true

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
      this._applySelected(selected)
    },

    setCenterState: function (center) {
      this.setData({ center: center })
    },

    setBadges: function (badges) {
      this.syncState({ badges: badges })
    },

    handleTabTap: function (e) {
      var self = this
      if (this._tapDebounceTimer) return
      this._tapDebounceTimer = setTimeout(function () {
        self._tapDebounceTimer = null
      }, TAB_TAP_DEBOUNCE_MS)

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
      this.setData({ selected: index })
      wx.switchTab({
        url: url,
        success: function () {
          self._announceTab(index)
          self.trackTabBarEvent('mini_program_tab_bar_switch_success', {
            tab: tabKey || 'unknown',
            index: index,
          })
        },
        fail: function (err) {
          console.warn('[TabBar] switchTab failed for tab ' + tabKey + ':', err)
          self._confirmedSelected = previousSelected
          self.setData({ selected: previousSelected })
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
      if (this._tapDebounceTimer) return
      this._tapDebounceTimer = setTimeout(function () {
        self._tapDebounceTimer = null
      }, TAB_TAP_DEBOUNCE_MS)

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
      this.setData({ selected: 4 })
      wx.switchTab({
        url: action.url,
        success: function () {
          self._announceTab(4)
          self.trackTabBarEvent('mini_program_center_button_switch_success', {
            action_kind: action.kind || 'unknown',
          })
        },
        fail: function (err) {
          console.warn('[TabBar] switchTab failed for center:', err)
          self._confirmedSelected = previousSelected
          self.setData({ selected: previousSelected })
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


  },
})
