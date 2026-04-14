Component({
  options: {
    addGlobalClass: true,
  },

  data: {
    selected: 0,
    center: {
      label: '去参与',
      showBadge: false,
      action: {
        kind: 'discover',
        navigation: 'switchTab',
        url: '/pages/discover/index',
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

  methods: {
    /**
     * Called by useCustomTabBarSync hook via Taro.getTabBar(page).
     * Accepts: { selected, center, badges? }
     */
    syncState: function (state) {
      var update = {}

      if (state.selected !== undefined) {
        update.selected = state.selected
      }

      if (state.center) {
        update.center = state.center
      }

      if (state.badges) {
        var leftTabs = this.data.leftTabs.map(function (tab) {
          var count = tab.badgeCategory ? (state.badges[tab.badgeCategory] || 0) : 0
          return Object.assign({}, tab, { badgeCount: count })
        })

        var rightTabs = this.data.rightTabs.map(function (tab) {
          var count = tab.badgeCategory ? (state.badges[tab.badgeCategory] || 0) : 0
          return Object.assign({}, tab, { badgeCount: count })
        })

        update.leftTabs = leftTabs
        update.rightTabs = rightTabs
      }

      this.setData(update)
    },

    setSelected: function (selected) {
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

      this.setData({ selected: index })
      wx.switchTab({ url: url })
    },

    handleCenterTap: function () {
      var action = this.data.center.action

      if (action.navigation === 'switchTab') {
        wx.switchTab({ url: action.url })
        return
      }

      wx.navigateTo({ url: action.url })
    },
  },
})
