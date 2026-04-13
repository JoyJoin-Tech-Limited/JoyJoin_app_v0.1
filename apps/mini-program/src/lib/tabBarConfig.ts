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
    appIconPath: 'assets/tab-icons/discover.png',
    appSelectedIconPath: 'assets/tab-icons/discover-active.png',
    componentIconPath: '../assets/tab-icons/discover.png',
    componentSelectedIconPath: '../assets/tab-icons/discover-active.png',
  },
  {
    key: 'journey',
    pagePath: 'pages/events/index',
    url: '/pages/events/index',
    text: '足迹',
    appIconPath: 'assets/tab-icons/events.png',
    appSelectedIconPath: 'assets/tab-icons/events-active.png',
    componentIconPath: '../assets/tab-icons/events.png',
    componentSelectedIconPath: '../assets/tab-icons/events-active.png',
  },
  {
    key: 'connections',
    pagePath: 'pages/connections/index',
    url: '/pages/connections/index',
    text: '连接',
    appIconPath: 'assets/tab-icons/connections.png',
    appSelectedIconPath: 'assets/tab-icons/connections-active.png',
    componentIconPath: '../assets/tab-icons/connections.png',
    componentSelectedIconPath: '../assets/tab-icons/connections-active.png',
  },
  {
    key: 'profile',
    pagePath: 'pages/profile/index',
    url: '/pages/profile/index',
    text: '我的',
    appIconPath: 'assets/tab-icons/profile.png',
    appSelectedIconPath: 'assets/tab-icons/profile-active.png',
    componentIconPath: '../assets/tab-icons/profile.png',
    componentSelectedIconPath: '../assets/tab-icons/profile-active.png',
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