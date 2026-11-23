/* globals Component, wx, getCurrentPages */

// Window (ms) after a page-hook selection push during which the push is
// authoritative for this instance. `pageLifetimes.show` fires mid-transition
// and can read a stale `getCurrentPages()`; inside this window it defers.
var PUSH_SETTLE_MS = 400

// Settle delay before each route re-read in the chain this component schedules
// after its own `getCurrentPages()` read (see `_armRouteRecheck`).
//
// WeChat's documented creation order is: component created → component
// attached → component `pageLifetimes.show` → Page.onLoad → Page.onShow, and a
// hidden tab page is kept as a dangling page OUTSIDE the page stack. So both of
// this component's own route reads run BEFORE the incoming page exists in the
// stack, and report the tab the user is leaving — the outgoing highlight. Both
// fire once, at the start of the transition, and never again.
//
// That makes the page hook's push (useCustomTabBarSync) the only corrector, and
// that push is a bounded retry chain that can legitimately go missing (late
// `getTabBar()`, or the platform resolving the outgoing page's instance). The
// route therefore has to be re-read after the transition settles, which is what
// this delay is for. Only one read is pending at a time, a tap or a push
// restarts the chain, and it is always cleared on detach.
//
// 400 ms is the same transition bound PUSH_SETTLE_MS encodes; the two stay
// separate constants because they answer different questions.
var ROUTE_RECHECK_MS = 400

// Rounds in the settle re-read chain (400 ms, then 800 ms).
//
// One round is not provably enough. A read that lands while the transition is
// still running reports the outgoing tab, and that result is indistinguishable
// from a settled read — same index, same 'tab' outcome — so a single round can
// commit the wrong highlight and go quiet, which is the "tap it twice" symptom
// again, just rarer. A later round turns an early read into an intermediate
// state instead of the last word. `_reconcileSelection` is idempotent, so the
// extra rounds cost a sync read and no setData when nothing moved.
var ROUTE_RECHECK_MAX_ATTEMPTS = 2

// The logo settle is an app-entry brand moment, not a per-tab-page one. Each
// tab page builds its own tab-bar instance, so without this flag the animation
// replayed on every first visit.
var hasPlayedLogoEntrance = false

Component({
  options: {
    addGlobalClass: true,
  },

  // Internal debounce / diff state (not reactive)
  _syncTimer: null,
  _lastBadgesKey: '',
  _lastDotsKey: '',
  _lastSelected: -1,
  _lastCenterUrl: '',
  // Last selection confirmed by the visible route — used only as a fallback
  // when the runtime cannot expose a route during a failed switch.
  _confirmedSelected: 0,
  _platform: '',
  _isLowEnd: false,
  // Network + lifecycle
  _isOnline: true,
  _networkStatusHandler: null,
  _pendingSyncState: null,
  _isDetached: false,
  // Latest-intent switching: one active native request plus one replaceable
  // pending destination. A bounded watchdog releases a callback-less request.
  _switchInFlight: false,
  _switchRequestId: 0,
  _activeSwitchRequestId: 0,
  _pendingSwitch: null,
  _switchTimer: null,
  // Route-to-highlight reconciliation.
  //
  // INVARIANT: the visible route is the only durable selection authority.
  // Every instance converges to `_routeToIndex[visibleRoute]` at attach and on
  // every show; convergence is idempotent (no setData when already correct).
  // An optimistic tap highlight may pre-empt route truth, but it is provisional
  // and is overwritten by the next settle. No writer may set `selected` for a
  // page it is not currently showing.
  //
  // `_lastPushAt` marks the last selection push from the page hook. `show` runs
  // during the switchTab transition, when `getCurrentPages()` may still report
  // the outgoing route; a push that just landed is fresher than that read, so
  // show must not overwrite it.
  _lastPushAt: 0,
  // Registered by useCustomTabBarSync: (index) => { action, atTop } | void.
  // The page owns what a re-tap means; the chrome only guarantees feedback.
  _retapHandler: null,
  _settleTimer: null,
  // Armed by attached/show, disarmed by a tap, a route-truth push, or detach.
  _routeRecheckTimer: null,
  // Screen-reader announcement timer
  _announcementTimer: null,
  _routeToIndex: {
    'pages/discover/index': 0,
    'pages/pool-registration/index': 0,
    'pages/events/index': 1,
    'pages/connections/index': 2,
    'pages/profile/index': 3,
    'pages/center-hub/index': 4,
  },

  data: {
    selected: 0,
    lowEnd: false,
    hidden: true,
    // Logo settle plays once per app session (see hasPlayedLogoEntrance).
    settle: false,
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
        badgeDot: false,
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
        badgeDot: false,
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
        badgeDot: false,
      },
      {
        key: 'profile',
        index: 3,
        url: '/pages/profile/index',
        text: '我的',
        icon: '../assets/tab-icons/我的 icon_inactive.png',
        selectedIcon: '../assets/tab-icons/我的 icon.png',
        badgeCount: 0,
        // P0-5 (2026-10-22): pending equipment draws surface as the 我的 tab
        // badge, same number-pill system as the sibling tabs.
        badgeCategory: 'profile',
        badgeDot: false,
      },
    ],
  },

  lifetimes: {
    attached: function () {
      // Some WeChat runtimes do not copy top-level non-data properties to the
      // instance before attached fires. Re-initialize the route map here as a
      // defensive fallback to prevent `_reconcileSelection` crashes.
      if (!this._routeToIndex) {
        this._routeToIndex = {
          'pages/discover/index': 0,
          'pages/pool-registration/index': 0,
          'pages/events/index': 1,
          'pages/connections/index': 2,
          'pages/profile/index': 3,
          'pages/center-hub/index': 4,
        }
      }

      // wx.getSystemInfoSync is deprecated; getDeviceInfo carries both
      // platform and benchmarkLevel. Fall back for ancient base libraries.
      var info = {}
      try {
        if (wx.getDeviceInfo) {
          info = wx.getDeviceInfo()
        } else if (wx.getSystemInfoSync) {
          info = wx.getSystemInfoSync()
        }
      } catch (e) {
        info = {}
      }
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
      this._switchInFlight = false
      this._switchRequestId = 0
      this._activeSwitchRequestId = 0
      this._pendingSwitch = null
      clearTimeout(this._switchTimer)
      this._lastPushAt = 0

      // Seed selection + visibility from the route as the instance mounts, so a
      // tab page never renders an invisible bar waiting for a later callback.
      // `data.hidden` stays `true` by default, so this cannot leak the bar onto
      // non-tab routes: reconcile hides it there and leaves an unresolvable
      // stack untouched. Trade-off vs. the old hide-only attach: attach runs
      // BEFORE the page's own onLoad/onShow (see ROUTE_RECHECK_MS), so this read
      // reports the tab the user is leaving and paints it for one transition.
      // The page's own publish is the fast correction; `_armRouteRecheck` is the
      // one that still lands when that publish never reaches this instance.
      this._reconcileSelection()
      this._armRouteRecheck()

      // Brand moment: first tab-bar instance of the session only.
      if (!hasPlayedLogoEntrance) {
        hasPlayedLogoEntrance = true
        this.setData({ settle: true })
        // Clear once the 400ms settle has finished. The root sits behind
        // `wx:if`, so without this a later teardown/rebuild (closing Discover's
        // area-filter sheet rebuilds the subtree) would replay the animation on
        // a screen the user never left.
        this._settleTimer = setTimeout(this._clearSettle.bind(this), 450)
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
      clearTimeout(this._announcementTimer)
      clearTimeout(this._switchTimer)
      clearTimeout(this._settleTimer)
      clearTimeout(this._routeRecheckTimer)
      this._routeRecheckTimer = null
      this._switchRequestId += 1
      this._activeSwitchRequestId = 0
      this._pendingSwitch = null
      this._switchInFlight = false
      if (this._networkStatusHandler && wx.offNetworkStatusChange) {
        wx.offNetworkStatusChange(this._networkStatusHandler)
      }
    },
  },

  pageLifetimes: {
    // Backstop only. The page's own useDidShow publishes route truth for this
    // instance and is fresher than anything readable here mid-transition, so a
    // recent push wins. With no recent push this covers swipe-back, deep links,
    // and re-attach, where no hook runs at all.
    show: function () {
      // A recent push proves SOME instance was published, not that this one was:
      // the hook resolves its tab bar from a page that may still be
      // mid-transition. So it skips the immediate read only — never the settle
      // re-read, which is what converges an instance the push missed.
      if (Date.now() - (this._lastPushAt || 0) >= PUSH_SETTLE_MS) {
        this._reconcileSelection()
      }
      // `show` also runs BEFORE the page's onShow, and a hidden tab page is a
      // dangling page outside the stack, so this read can belong to the
      // transition too. Re-read once it has settled.
      this._armRouteRecheck()
    },
    hide: function () {
      // A pending settle re-read must not land while this page is hidden: by
      // then the stack reports the tab the user moved to, and painting it here
      // would only poison this instance's fallback selection.
      this._disarmRouteRecheck()
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

        // Note: `selected` is NEVER passed by syncState. Selection is
        // optimistic during a tap, then reconciled from the visible route
        // by setSelected/pageLifetimes.show.

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

        // Dots: a boolean state per tab, kept in a separate channel so a dot
        // never renders as a "1" pill. Same path-based, diffed write as badges.
        if (state.dots) {
          var dotsKey = JSON.stringify(state.dots)
          if (dotsKey !== self._lastDotsKey) {
            self._lastDotsKey = dotsKey
            var leftDotTabs = self.data.leftTabs
            var rightDotTabs = self.data.rightTabs

            leftDotTabs.forEach(function (tab, idx) {
              var dot = tab.badgeCategory ? !!state.dots[tab.badgeCategory] : false
              if (!!tab.badgeDot !== dot) {
                update['leftTabs[' + idx + '].badgeDot'] = dot
                hasChange = true
              }
            })

            rightDotTabs.forEach(function (tab, idx) {
              var dot = tab.badgeCategory ? !!state.dots[tab.badgeCategory] : false
              if (!!tab.badgeDot !== dot) {
                update['rightTabs[' + idx + '].badgeDot'] = dot
                hasChange = true
              }
            })
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
      // Marks route truth as fresh for this instance: `pageLifetimes.show`
      // defers to it instead of re-reading a possibly-stale page stack.
      this._lastPushAt = Date.now()
      // A push usually IS route truth, but the hook resolves its tab bar from a
      // page that can still be mid-transition, so the index that lands here can
      // be stale for this instance. Cancelling the settle re-read made that
      // stale index permanent — the icon stayed unlit on the page the user was
      // already sitting on until they tapped that tab again (2026-11-22).
      // Re-arming keeps the read: it is derived from the route, so it can only
      // be as stale as the page stack, never staler than the push.
      this._armRouteRecheck()
      // No-op guard: tab switches already set selected optimistically in
      // handleTabTap/handleCenterTap. Skipping the redundant setData avoids
      // an extra native re-render (icon flicker) on every switch.
      if (this.data.selected === n && !this.data.hidden) return
      this.setData({ selected: n, hidden: false })
    },

    /**
     * Registers the visible page's re-tap behaviour (scroll-to-top vs refresh).
     * The page owns what "already here" means; the component only guarantees
     * the tap is acknowledged (haptics + analytics) and never re-navigates.
     */
    setRetapHandler: function (handler) {
      this._retapHandler = typeof handler === 'function' ? handler : null
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
     * When the page re-shows (tab switch), _reconcileSelection
     * may set hidden:false but does not touch sheetOpen, so the bar
     * stays hidden until the sheet closes.
     */
    setSheetOpen: function (open) {
      this.setData({ sheetOpen: !!open })
    },

    handleTabTap: function (e) {
      this._switchToIndex(
        Number(e.currentTarget.dataset.index),
        e.currentTarget.dataset.url,
        { tabKey: e.currentTarget.dataset.tab }
      )
    },

    handleCenterTap: function () {
      var action = this.data.center.action
      if (!action) return
      // Contextual destinations leave the tab world, so they must not use the
      // tab-switch queue (which only understands `switchTab`) and must not
      // optimistically paint the center slot as selected — the hub is not
      // where the user is going.
      if (action.navigation === 'navigateTo' && action.url) {
        this._openCenterDestination(action)
        return
      }
      // A switchTab destination is not necessarily the hub: the idle
      // destination is 发现, and painting index 4 for it would light the wrong
      // slot. Resolve the index from the URL and fall back to the hub.
      var route = String(action.url || '').replace(/^\//, '').split('?')[0]
      var targetIndex = this._routeToIndex[route]
      if (typeof targetIndex !== 'number') targetIndex = 4
      this._switchToIndex(targetIndex, action.url, { isCenter: true, action: action })
    },

    /**
     * Opens a resolved center destination as a pushed page.
     *
     * Deliberately outside `_switchInFlight`: a navigateTo is not a tab switch,
     * and queueing it as one would block the next tab tap behind the 400ms
     * watchdog for no reason.
     */
    _openCenterDestination: function (action) {
      var self = this
      this._triggerHaptic()
      this.trackTabBarEvent('mini_program_center_button_tap', {
        action_kind: (action && action.kind) || 'unknown',
        navigation: 'navigateTo',
      })
      wx.navigateTo({
        url: action.url,
        fail: function (err) {
          console.warn('[TabBar] center navigateTo failed:', err)
          self.trackTabBarEvent('mini_program_center_button_switch_fail', {
            action_kind: (action && action.kind) || 'unknown',
            navigation: 'navigateTo',
            stale: false,
          })
          if (wx.showToast) {
            wx.showToast({ title: '打开失败，请重试', icon: 'none' })
          }
        },
      })
    },

    /** Registered by useCustomTabBarSync; see _retapHandler. */
    setRetapHandler: function (handler) {
      this._retapHandler = typeof handler === 'function' ? handler : null
    },

    /**
     * Re-tap of the tab the user is already on. The page owns the outcome
     * (scroll to top / silent refresh); the chrome guarantees a haptic and a
     * measurable event, and NEVER issues a second switchTab — a re-tap must not
     * re-run the destination page's onShow for no visible change.
     */
    _handleRetap: function (index, meta) {
      var result = null
      if (typeof this._retapHandler === 'function') {
        try {
          result = this._retapHandler(index)
        } catch (err) {
          result = null
        }
      } else if (wx.pageScrollTo) {
        // Default for pages that supply no handler: a page-level scroll to the
        // top is the only outcome chrome can guarantee alone. Inside a
        // ScrollView this is a no-op, so those pages pass their own handler.
        wx.pageScrollTo({ scrollTop: 0, duration: 200 })
        result = { action: 'scroll-top' }
      }
      this._triggerHaptic()
      this.trackTabBarEvent('mini_program_tab_bar_retap', {
        tab: (meta && meta.tabKey) || (index === 4 ? 'center' : 'unknown'),
        at_top: result && result.atTop ? 1 : 0,
        action: (result && result.action) || 'none',
      })
    },

    _switchToIndex: function (index, url, meta) {
      if (!url || !Number.isFinite(index)) return

      // A tap is newer intent than any armed settle re-read: that read would
      // sample the tab the user is leaving while this switch is in flight. The
      // switch's own success/watchdog path reconciles afterwards.
      this._disarmRouteRecheck()

      var currentRouteIndex = this._routeToIndex[this._getCurrentRoute()]
      if (currentRouteIndex === index && !this._switchInFlight) {
        // Re-tap: the destination is already visible, so there is nothing to
        // navigate to. Give the tap an outcome instead of silently repainting
        // the same highlight — but never a second switchTab and never a toast.
        // The single implementation (handler, haptic, analytics) is _handleRetap.
        this.setSelected(index)
        this._handleRetap(index, meta)
        return
      }

      var request = {
        requestId: ++this._switchRequestId,
        index: index,
        url: url,
        meta: meta,
        previousSelected: typeof currentRouteIndex === 'number'
          ? currentRouteIndex
          : this._confirmedSelected,
      }
      var isCenter = !!(meta && meta.isCenter)
      var tabKey = meta && meta.tabKey
      var action = meta && meta.action

      // Every tap updates the intended color immediately, but native requests
      // are bounded: only the newest destination waits behind the active one.
      this.setData({ selected: index, hidden: false })
      this.trackTabBarEvent(
        isCenter ? 'mini_program_center_button_tap' : 'mini_program_tab_bar_tap',
        isCenter
          ? {
              action_kind: (action && action.kind) || 'unknown',
              navigation: (action && action.navigation) || 'unknown',
            }
          : { tab: tabKey || 'unknown', index: index }
      )
      this._triggerHaptic()

      if (this._switchInFlight) {
        this._pendingSwitch = request
        return
      }
      this._startSwitch(request)
    },

    _startSwitch: function (request) {
      var self = this
      var requestId = request.requestId
      var index = request.index
      var meta = request.meta
      var isCenter = !!(meta && meta.isCenter)
      var tabKey = meta && meta.tabKey
      var action = meta && meta.action

      this._switchInFlight = true
      this._activeSwitchRequestId = requestId
      clearTimeout(this._switchTimer)
      this._switchTimer = setTimeout(function () {
        if (self._activeSwitchRequestId !== requestId || self._isDetached) return
        // Some native runtimes never invoke either callback. Expire only the
        // platform wait, then release the newest pending intent; never drop it.
        self._activeSwitchRequestId = 0
        self._switchInFlight = false
        self._switchTimer = null
        if (self._pendingSwitch) {
          self._flushPendingSwitch()
        } else {
          self._reconcileSelection()
        }
      }, 400)

      wx.switchTab({
        url: request.url,
        success: function () {
          if (!self._settleSwitch(requestId) || self._isDetached) return
          if (requestId === self._switchRequestId) {
            self._reconcileSelection()
            if (self._routeToIndex[self._getCurrentRoute()] === index) {
              self._setAnnouncement(isCenter ? '已切换到中心入口' : self._getTabAnnouncement(index))
            }
          }
          self._flushPendingSwitch()
        },
        fail: function (err) {
          var isLatest = requestId === self._switchRequestId
          console.warn('[TabBar] switchTab failed for ' + (isCenter ? 'center' : 'tab ' + tabKey) + ':', err)
          self.trackTabBarEvent(
            isCenter ? 'mini_program_center_button_switch_fail' : 'mini_program_tab_bar_switch_fail',
            isCenter
              ? {
                  action_kind: (action && action.kind) || 'unknown',
                  navigation: (action && action.navigation) || 'unknown',
                  stale: !isLatest,
                }
              : { tab: tabKey || 'unknown', index: index, stale: !isLatest }
          )
          if (!self._settleSwitch(requestId) || self._isDetached) return

          if (isLatest) {
            // Route truth first: a failed switch normally means the user never
            // left the previous page, which the route read already reflects.
            var outcome = self._reconcileSelection()
            if (outcome === 'unknown') {
              // Unreadable stack: fall back to where we came from rather than
              // leaving the optimistic highlight on a page we never reached.
              self._confirmedSelected = request.previousSelected
              self.setData({ selected: request.previousSelected, hidden: false })
            }
            if (wx.showToast) {
              wx.showToast({ title: '切换失败，请重试', icon: 'none' })
            }
          }
          self._flushPendingSwitch()
        },
      })
    },

    _settleSwitch: function (requestId) {
      if (this._activeSwitchRequestId !== requestId) return false
      clearTimeout(this._switchTimer)
      this._switchTimer = null
      this._activeSwitchRequestId = 0
      this._switchInFlight = false
      return true
    },

    _flushPendingSwitch: function () {
      if (this._switchInFlight || this._isDetached || !this._pendingSwitch) return
      var pending = this._pendingSwitch
      this._pendingSwitch = null
      // The route already advanced to this destination while we waited (a fast
      // platform callback or a second tap that matched the active target).
      // Re-issuing switchTab would be a redundant native hop that re-runs the
      // destination page's onShow for no visible change.
      // A stale read can only report the OUTGOING route, so it can equal
      // `pending.index` only when the user re-tapped the tab they were already
      // on — exactly the case where dropping the intent is correct.
      if (this._routeToIndex[this._getCurrentRoute()] === pending.index) {
        this._reconcileSelection()
        return
      }
      this._startSwitch(pending)
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

    /**
     * Ends the one-time logo settle so a later subtree rebuild does not replay
     * it (see hasPlayedLogoEntrance).
     */
    _clearSettle: function () {
      this._settleTimer = null
      if (this._isDetached) return
      this.setData({ settle: false })
    },

    /**
     * Cancels a pending settle re-read.
     *
     * Called by every writer whose intent is newer than the armed read (a route
     * push, a tab tap) and on detach, so no timer can outlive the instance or
     * repaint a route the user has already left.
     */
    _disarmRouteRecheck: function () {
      clearTimeout(this._routeRecheckTimer)
      this._routeRecheckTimer = null
    },

    /**
     * Arms the bounded settle re-read chain (see ROUTE_RECHECK_MS).
     *
     * `attached` and `pageLifetimes.show` both run before their page's onShow,
     * so their `getCurrentPages()` read can still report the outgoing tab. The
     * page hook's push normally corrects that immediately; this is what still
     * converges when the push never lands on this instance.
     *
     * Always re-read, even if a push landed after this was armed: `selected` is
     * derived from the route, so this read can never be older truth than a push.
     * Skipping it let a stale push become permanent — the icon stayed unlit on a
     * page the user was already sitting on until they tapped that tab again
     * (2026-11-22 report).
     *
     * `attempt` is the 0-based round index. One round is not provably enough: a
     * read that lands mid-transition reports the outgoing tab, which looks
     * identical to steady state, so it can commit the wrong highlight and go
     * quiet. Each round re-arms once more with a doubled wait, making an early
     * read an intermediate state rather than the last word.
     * `_reconcileSelection` is idempotent, so extra rounds are free when the
     * selection has already converged.
     */
    _armRouteRecheck: function (attempt) {
      var self = this
      var round = attempt || 0
      this._disarmRouteRecheck()
      this._routeRecheckTimer = setTimeout(function () {
        self._routeRecheckTimer = null
        if (self._isDetached) return
        self._reconcileSelection()
        if (round < ROUTE_RECHECK_MAX_ATTEMPTS - 1) {
          self._armRouteRecheck(round + 1)
        }
      }, ROUTE_RECHECK_MS * (round + 1))
    },

    /**
     * Resolves selection + visibility from the visible route.
     *
     * The ONLY writer of `selected`/`hidden` that is derived from routing.
     * Idempotent: when the instance already matches the route it performs no
     * setData at all, so calling it on every show is free.
     *
     * Returns:
     *   'tab'     — a mapped tab route; the bar is revealed and lit
     *   'hidden'  — a mapped non-tab route; the bar must not exist here
     *   'unknown' — empty/unreadable page stack; nothing was changed
     */
    _reconcileSelection: function () {
      var pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
      if (!pages || pages.length === 0) return 'unknown'

      var route = this._getCurrentRoute()
      var nextSelected = this._routeToIndex[route]
      if (typeof nextSelected !== 'number') {
        if (this.data.hidden !== true) {
          this.setData({ hidden: true })
        }
        return 'hidden'
      }

      this._confirmedSelected = nextSelected
      if (this.data.selected !== nextSelected || this.data.hidden) {
        this.setData({ selected: nextSelected, hidden: false })
      }
      return 'tab'
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
