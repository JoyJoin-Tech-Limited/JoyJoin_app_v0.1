export type MiniProgramTabKey = 'discover' | 'events' | 'connections' | 'profile' | 'centerHub'

export interface MiniProgramTabItem {
  key: MiniProgramTabKey
  pagePath: string
  url: string
  text: string
  appIconPath: string
  appSelectedIconPath: string
  componentIconPath: string
  componentSelectedIconPath: string
}

export const MINI_PROGRAM_TAB_ITEMS: MiniProgramTabItem[] = [
  {
    key: 'discover',
    pagePath: 'pages/discover/index',
    url: '/pages/discover/index',
    text: '发现',
    appIconPath: 'assets/tab-icons/发现 icon_inactive.png',
    appSelectedIconPath: 'assets/tab-icons/发现 icon.png',
    componentIconPath: '../assets/tab-icons/发现 icon_inactive.png',
    componentSelectedIconPath: '../assets/tab-icons/发现 icon.png',
  },
  {
    key: 'events',
    pagePath: 'pages/events/index',
    url: '/pages/events/index',
    text: '足迹',
    appIconPath: 'assets/tab-icons/足迹 icon_inactive.png',
    appSelectedIconPath: 'assets/tab-icons/足迹 icon.png',
    componentIconPath: '../assets/tab-icons/足迹 icon_inactive.png',
    componentSelectedIconPath: '../assets/tab-icons/足迹 icon.png',
  },
  {
    key: 'connections',
    pagePath: 'pages/connections/index',
    url: '/pages/connections/index',
    text: '连接',
    appIconPath: 'assets/tab-icons/连接 icon_inactive.png',
    appSelectedIconPath: 'assets/tab-icons/连接 icon.png',
    componentIconPath: '../assets/tab-icons/连接 icon_inactive.png',
    componentSelectedIconPath: '../assets/tab-icons/连接 icon.png',
  },
  {
    key: 'profile',
    pagePath: 'pages/profile/index',
    url: '/pages/profile/index',
    text: '我的',
    appIconPath: 'assets/tab-icons/我的 icon_inactive.png',
    appSelectedIconPath: 'assets/tab-icons/我的 icon.png',
    componentIconPath: '../assets/tab-icons/我的 icon_inactive.png',
    componentSelectedIconPath: '../assets/tab-icons/我的 icon.png',
  },
] as const

/** Center hub is not rendered as a regular tab — it is accessed via the center button. */
export const MINI_PROGRAM_CENTER_HUB_TAB_ITEM: MiniProgramTabItem = {
  key: 'centerHub',
  pagePath: 'pages/center-hub/index',
  url: '/pages/center-hub/index',
  text: '进行中',
  appIconPath: '',
  appSelectedIconPath: '',
  componentIconPath: '',
  componentSelectedIconPath: '',
}

export const MINI_PROGRAM_TAB_INDEX: Record<MiniProgramTabKey, number> = {
  discover: 0,
  events: 1,
  connections: 2,
  profile: 3,
  centerHub: 4,
}

/**
 * Tab bar list for WeChat native tab bar config.
 *
 * NOTE: Center hub ("进行中") is intentionally EXCLUDED from this list.
 * It is rendered as a floating center button by the custom tab bar component
 * (`custom-tab-bar/`), not as a standard tab. Including it with empty icon
 * paths causes WeChat 800059 preview/build errors.
 */
export const MINI_PROGRAM_TAB_BAR_CONFIG_ITEMS = MINI_PROGRAM_TAB_ITEMS.map((item) => ({
  pagePath: item.pagePath,
  text: item.text,
  iconPath: item.appIconPath,
  selectedIconPath: item.appSelectedIconPath,
}))