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

  data: {
    selected: 0,
    lowEnd: false,
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
      var info = wx.getSystemInfoSync ? wx.getSystemInfoSync() : {}
      this._platform = info.platform || 'other'
      // benchmarkLevel: 1–50. <= 15 is low-end (budget Android / old iOS).
      this._isLowEnd = (info.benchmarkLevel || 50) <= 15
      if (this._isLowEnd) {
        this.setData({ lowEnd: true })
      }
    },
    detached: function () {
      clearTimeout(this._syncTimer)
      clearTimeout(this._showTimer)
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
      clearTimeout(this._syncTimer)

      this._syncTimer = setTimeout(function () {
        var update = {}
        var hasChange = false

        // Selected: only update if changed
        if (state.selected !== undefined && state.selected !== self._lastSelected) {
          update.selected = state.selected
          self._lastSelected = state.selected
          self._confirmedSelected = state.selected
          hasChange = true
        }

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
      var index = e.currentTarget.dataset.index
      var url = e.currentTarget.dataset.url
      var tabKey = e.currentTarget.dataset.tab
      var previousSelected = this._confirmedSelected
      var self = this

      this.trackTabBarEvent('mini_program_tab_bar_tap', {
        tab: tabKey || 'unknown',
        index: index,
      })

      // Optimistic update with rollback on failure
      this.setData({ selected: index })
      wx.switchTab({
        url: url,
        fail: function (err) {
          console.warn('[TabBar] switchTab failed for tab ' + tabKey + ':', err)
          self.setData({ selected: previousSelected })
        },
      })

      this._triggerHaptic()
    },

    handleCenterTap: function () {
      var action = this.data.center.action
      var previousSelected = this._confirmedSelected
      var self = this

      this.trackTabBarEvent('mini_program_center_button_tap', {
        action_kind: action.kind || 'unknown',
        navigation: action.navigation || 'unknown',
      })

      // Optimistic update with rollback on failure
      this.setData({ selected: 4 })
      wx.switchTab({
        url: action.url,
        fail: function (err) {
          console.warn('[TabBar] switchTab failed for center:', err)
          self.setData({ selected: previousSelected })
        },
      })

      this._triggerHaptic()
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
