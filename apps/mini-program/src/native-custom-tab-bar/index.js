Component({
  options: {
    addGlobalClass: true,
  },

  // Internal debounce / diff state (not reactive)
  _syncTimer: null,
  _showTimer: null,
  _tapDebounceTimer: null,
  _lastBadgesKey: '',
  _lastSelected: 0,
  _lastCenterUrl: '',
  // Last selection confirmed by syncState (authoritative) — used for rollback
  _confirmedSelected: 0,
  _platform: '',
  _isLowEnd: false,
  _isOffline: false,
  // Name lookup for accessibility announcements
  _tabNames: { 0: '发现', 1: '足迹', 2: '连接', 3: '我的', 4: '中心入口' },

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
        this._isLowEnd = (info.benchmarkLevel || 50) <= 15
      } catch (_e) {
        this._platform = 'unknown'
        this._isLowEnd = false
      }
      if (this._isLowEnd) {
        this.setData({ lowEnd: true })
      }
      // Detect initial network state for offline guard
      if (wx.getNetworkType) {
        wx.getNetworkType({
          success: function (res) {
            self._isOffline = res.networkType === 'none'
          },
        })
      }
      if (wx.onNetworkStatusChange) {
        wx.onNetworkStatusChange(function (res) {
          self._isOffline = !res.isConnected
        })
      }
    },
    detached: function () {
      clearTimeout(this._syncTimer)
      clearTimeout(this._showTimer)
      clearTimeout(this._tapDebounceTimer)
    },
  },

  pageLifetimes: {
    // Safety net: if an optimistic update left selected in a wrong state
    // after swipe-back, reset to the last confirmed value after syncState
    // has had time to fire (syncState debounce = 50ms).
    show: function () {
      var self = this
      clearTimeout(this._showTimer)
      this._showTimer = setTimeout(function () {
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
      // Skip state updates while offline — badge counts are stale without network
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
      this._confirmedSelected = selected
      this.setData({ selected: selected })
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
      }, 300)

      var index = e.currentTarget.dataset.index
      var url = e.currentTarget.dataset.url
      var tabKey = e.currentTarget.dataset.tab
      var previousSelected = this._confirmedSelected

      // No-op if already on this tab
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
      }, 300)

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
      var name = this._tabNames[index] || ''
      if (!name) return
      this.setData({ announcement: '已切换到' + name })
      var self = this
      setTimeout(function () {
        if (self.data.announcement) self.setData({ announcement: '' })
      }, 1000)
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
