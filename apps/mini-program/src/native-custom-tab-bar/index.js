/* globals Component, wx, getCurrentPages */
Component({
  options: {
    addGlobalClass: true,
  },

  // Internal debounce / diff state (not reactive)
  _syncTimer: null,
  _showTimer: null,
  _lastBadgesKey: '',
  _lastSelected: -1,
  _lastCenterUrl: '',
  // Last selection confirmed by syncState (authoritative) — used for rollback
  _confirmedSelected: 0,
  _platform: '',
  _isLowEnd: false,
  // Network + lifecycle
  _isOnline: true,
  _networkStatusHandler: null,
  _pendingSyncState: null,
  _isDetached: false,
  // Tab switch in-flight guard
  _switchInFlight: false,
  _switchTimer: null,
  // Screen-reader announcement timer
  _announcementTimer: null,
  _routeToIndex: {
    'pages/discover/index': 0,
    'subpackages/pool-registration/index': 0,
    'pages/events/index': 1,
    'pages/connections/index': 2,
    'pages/profile/index': 3,
    'pages/center-hub/index': 4,
  },

  data: {
    selected: 0,
    lowEnd: false,
    hidden: true,
    collapsed: false,
    sheetOpen: false,
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
      // Some WeChat runtimes do not copy top-level non-data properties to the
      // instance before attached fires. Re-initialize the route map here as a
      // defensive fallback to prevent `_shouldHideOnPage` crashes.
      if (!this._routeToIndex) {
        this._routeToIndex = {
          'pages/discover/index': 0,
          'subpackages/pool-registration/index': 0,
          'pages/events/index': 1,
          'pages/connections/index': 2,
          'pages/profile/index': 3,
          'pages/center-hub/index': 4,
        }
      }

      var info = wx.getSystemInfoSync ? wx.getSystemInfoSync() : {}
      this._platform = info.platform || 'other'
      // benchmarkLevel: 1–50. <= 15 is low-end (budget Android / old iOS).
      // iOS devices without benchmarkLevel are treated as low-end because
      // modern iPhones reliably expose this field.
      var hasBenchmark = typeof info.benchmarkLevel === 'number'
      this._isLowEnd = (hasBenchmark && info.benchmarkLevel <= 15) ||
        (!hasBenchmark && this._platform === 'ios')
      if (this._isLowEnd) {
        this.setData({ lowEnd: true })
      }

      // Preserve selection across re-attachment (e.g., tab bar re-created).
      this._confirmedSelected = Number(this.data.selected) || 0

      // Hide by default; setSelected will reveal on tab pages.
      var shouldHide = this._shouldHideOnPage()
      if (shouldHide) {
        this.setData({ hidden: true })
      }

      // Network awareness for deferred badge updates.
      var self = this
      this._isDetached = false
      this._networkStatusHandler = function (res) {
        self._isOnline = res.isConnected
        if (res.isConnected && self._pendingSyncState) {
          var pending = self._pendingSyncState
          self._pendingSyncState = null
          self.syncState(pending)
        }
      }
      if (wx.getNetworkType) {
        wx.getNetworkType({
          success: function (res) {
            self._isOnline = res.networkType !== 'none'
          },
        })
      }
      if (wx.onNetworkStatusChange) {
        wx.onNetworkStatusChange(this._networkStatusHandler)
      }
    },

    detached: function () {
      this._isDetached = true
      clearTimeout(this._syncTimer)
      clearTimeout(this._showTimer)
      clearTimeout(this._switchTimer)
      clearTimeout(this._announcementTimer)
      if (this._networkStatusHandler && wx.offNetworkStatusChange) {
        wx.offNetworkStatusChange(this._networkStatusHandler)
      }
    },
  },

  pageLifetimes: {
    // Safety net: if an optimistic update left selected in a wrong state
    // after swipe-back, reset to the last confirmed value after syncState
    // has had time to fire (syncState debounce = 50ms).
    show: function () {
      var self = this
      clearTimeout(this._showTimer)
      this._syncSelectionWithCurrentRoute()
      this._showTimer = setTimeout(function () {
        self._syncSelectionWithCurrentRoute()
        if (self.data.selected !== self._confirmedSelected) {
          self.setData({ selected: self._confirmedSelected })
        }
      }, 100)
    },
  },

  methods: {
    /**
     * Called by useCustomTabBarSync hook via Taro.getTabBar(page).
     * Accepts: { selected, center, badges? }
     *
     * Debounced (50 ms) + diffed to prevent redundant setData bursts
     * from multiple alive tab pages. Badge updates use path syntax
     * to avoid array reconstruction and cover-image flicker.
     */
    syncState: function (state) {
      var self = this
      clearTimeout(this._syncTimer)

      // Defer updates while offline; replay on reconnect.
      if (!this._isOnline) {
        this._pendingSyncState = state
        return
      }
      this._pendingSyncState = null

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

          if (centerChanged) {
            update.center = state.center
            self._lastCenterUrl = state.center.action ? state.center.action.url : ''
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
      var n = Number(selected)
      this._confirmedSelected = n
      this.setData({ selected: n, hidden: false })
    },

    setCenterState: function (center) {
      this.setData({ center: center })
    },

    setBadges: function (badges) {
      this.syncState({ badges: badges })
    },

    /**
     * Hides or shows the entire tab bar. Used by the Discover page to
     * hide the tab bar when a bottom sheet (area filter / city picker)
     * is open. Independent of the page-route logic so sheets fully
     * cover the viewport without native-layer bleed-through.
     * When the page re-shows (tab switch), _syncSelectionWithCurrentRoute
     * may set hidden:false but does not touch sheetOpen, so the bar
     * stays hidden until the sheet closes.
     */
    setSheetOpen: function (open) {
      this.setData({ sheetOpen: !!open })
    },

    /**
     * Collapses or expands the tab bar surface.
     * Returns true when the state changed, false when already in target
     * state or when the component is detached.
     */
    setCollapsed: function (collapsed) {
      if (this._isDetached) return false
      if (this.data.collapsed === collapsed) return false
      this._setAnnouncement(collapsed ? '标签栏已收起' : '标签栏已展开')
      this.setData({ collapsed: collapsed })
      return true
    },

    handleTabTap: function (e) {
      var index = Number(e.currentTarget.dataset.index)
      var url = e.currentTarget.dataset.url
      var tabKey = e.currentTarget.dataset.tab
      var previousSelected = this._confirmedSelected
      var self = this

      // Ignore re-taps on the current tab and rapid taps while switching.
      if (index === this._confirmedSelected || this._switchInFlight) {
        return
      }

      // Optimistic UI update: highlight the tapped tab immediately.
      this._confirmedSelected = index
      this.setData({ selected: index, hidden: false })

      this._switchInFlight = true
      clearTimeout(this._switchTimer)
      this._switchTimer = setTimeout(function () {
        self._switchInFlight = false
      }, 2000)

      wx.switchTab({
        url: url,
        success: function () {
          self._releaseSwitchGuard()
          self._confirmedSelected = index
          self._setAnnouncement(self._getTabAnnouncement(index))
        },
        fail: function (err) {
          self._releaseSwitchGuard()
          console.warn('[TabBar] switchTab failed for tab ' + tabKey + ':', err)
          self._confirmedSelected = previousSelected
          self.setData({ selected: previousSelected })
          self.trackTabBarEvent('mini_program_tab_bar_switch_fail', {
            tab: tabKey || 'unknown',
            index: index,
          })
          if (wx.showToast) {
            wx.showToast({ title: '切换失败，请重试', icon: 'none' })
          }
        },
      })

      this.trackTabBarEvent('mini_program_tab_bar_tap', {
        tab: tabKey || 'unknown',
        index: index,
      })

      this._triggerHaptic()
    },

    handleCenterTap: function () {
      var action = this.data.center.action
      var previousSelected = this._confirmedSelected
      var self = this

      // Ignore re-taps and rapid taps while switching.
      if (this._confirmedSelected === 4 || this._switchInFlight) {
        return
      }

      // Optimistic UI update.
      this._confirmedSelected = 4
      this.setData({ selected: 4, hidden: false })

      this._switchInFlight = true
      clearTimeout(this._switchTimer)
      this._switchTimer = setTimeout(function () {
        self._switchInFlight = false
      }, 2000)

      wx.switchTab({
        url: action.url,
        success: function () {
          self._releaseSwitchGuard()
          self._confirmedSelected = 4
          self._setAnnouncement('已切换到中心入口')
        },
        fail: function (err) {
          self._releaseSwitchGuard()
          console.warn('[TabBar] switchTab failed for center:', err)
          self._confirmedSelected = previousSelected
          self.setData({ selected: previousSelected })
          self.trackTabBarEvent('mini_program_center_button_switch_fail', {
            action_kind: action.kind || 'unknown',
            navigation: action.navigation || 'unknown',
          })
          if (wx.showToast) {
            wx.showToast({ title: '切换失败，请重试', icon: 'none' })
          }
        },
      })

      this.trackTabBarEvent('mini_program_center_button_tap', {
        action_kind: action.kind || 'unknown',
        navigation: action.navigation || 'unknown',
      })

      this._triggerHaptic()
    },

    _releaseSwitchGuard: function () {
      this._switchInFlight = false
      clearTimeout(this._switchTimer)
      this._switchTimer = null
    },

    _setAnnouncement: function (text) {
      var self = this
      clearTimeout(this._announcementTimer)
      this.setData({ announcement: text })
      this._announcementTimer = setTimeout(function () {
        self.setData({ announcement: '' })
      }, 1000)
    },

    _getTabAnnouncement: function (index) {
      var names = this._tabNames
      if (!names) {
        names = {}
        this.data.leftTabs.forEach(function (tab) { names[tab.index] = tab.text })
        this.data.rightTabs.forEach(function (tab) { names[tab.index] = tab.text })
        names[4] = '中心入口'
      }
      return '已切换到' + (names[index] || '')
    },

    _getCurrentRoute: function () {
      var pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
      var currentPage = pages[pages.length - 1] || pages[0]
      var route = (currentPage && currentPage.route) || ''
      return route.replace(/^\//, '').split('?')[0]
    },

    _syncSelectionWithCurrentRoute: function () {
      var route = this._getCurrentRoute()
      var nextSelected = this._routeToIndex[route]
      if (typeof nextSelected !== 'number') {
        if (this.data.hidden !== true) {
          this.setData({ hidden: true })
        }
        return
      }

      this._confirmedSelected = nextSelected
      if (this.data.selected !== nextSelected || this.data.hidden) {
        this.setData({ selected: nextSelected, hidden: false })
      }
    },

    _shouldHideOnPage: function () {
      return typeof this._routeToIndex[this._getCurrentRoute()] !== 'number'
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
