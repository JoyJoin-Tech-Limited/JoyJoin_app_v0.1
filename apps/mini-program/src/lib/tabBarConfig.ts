export type MiniProgramTabKey = 'discover' | 'journey' | 'connections' | 'profile'

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
    key: 'journey',
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

export const MINI_PROGRAM_TAB_INDEX: Record<MiniProgramTabKey, number> = {
  discover: 0,
  journey: 1,
  connections: 2,
  profile: 3,
}

export const MINI_PROGRAM_TAB_BAR_CONFIG_ITEMS = MINI_PROGRAM_TAB_ITEMS.map((item) => ({
  pagePath: item.pagePath,
  text: item.text,
  iconPath: item.appIconPath,
  selectedIconPath: item.appSelectedIconPath,
}))