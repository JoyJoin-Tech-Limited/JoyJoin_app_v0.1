import { MINI_PROGRAM_PAGES } from './lib/onboardingRoutes'

export default defineAppConfig({
  lazyCodeLoading: 'requiredComponents',
  pages: [...MINI_PROGRAM_PAGES],
  tabBar: {
    color: '#9CA3AF',
    selectedColor: '#8B5CF6',
    backgroundColor: '#ffffff',
    borderStyle: 'white',
    list: [
      {
        pagePath: 'pages/discover/index',
        text: '发现',
        iconPath: 'assets/tab-icons/发现 icon_inactive.png',
        selectedIconPath: 'assets/tab-icons/发现 icon.png',
      },
      {
        pagePath: 'pages/events/index',
        text: '活动',
        iconPath: 'assets/tab-icons/足迹 icon_inactive.png',
        selectedIconPath: 'assets/tab-icons/足迹 icon.png',
      },
      {
        pagePath: 'pages/connections/index',
        text: '连接',
        iconPath: 'assets/tab-icons/连接 icon_inactive.png',
        selectedIconPath: 'assets/tab-icons/连接 icon.png',
      },
      {
        pagePath: 'pages/profile/index',
        text: '我的',
        iconPath: 'assets/tab-icons/我的 icon_inactive.png',
        selectedIconPath: 'assets/tab-icons/我的 icon.png',
      },
    ],
  },
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#ffffff',
    navigationBarTitleText: 'JoyJoin',
    navigationBarTextStyle: 'black',
    backgroundColor: '#FAFAFA',
  },
})
