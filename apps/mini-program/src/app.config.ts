import { MINI_PROGRAM_PAGES } from './lib/onboardingRoutes'

export default defineAppConfig({
  lazyCodeLoading: 'requiredComponents',
  pages: [
    'pages/discover/index',
    'pages/blind-box-payment/index',
    'pages/payment-verification/index',
    'pages/events/index',
    'pages/my-events/index',
    'pages/chats/index',
    'pages/journey/index',
    'pages/profile/index',
    'pages/login/index',
  ],
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
        iconPath: 'assets/tab-icons/discover.png',
        selectedIconPath: 'assets/tab-icons/discover-active.png',
      },
      {
        pagePath: 'pages/events/index',
        text: '活动',
        iconPath: 'assets/tab-icons/events.png',
        selectedIconPath: 'assets/tab-icons/events-active.png',
      },
      {
        pagePath: 'pages/connections/index',
        text: '连接',
        iconPath: 'assets/tab-icons/connections.png',
        selectedIconPath: 'assets/tab-icons/connections-active.png',
      },
      {
        pagePath: 'pages/profile/index',
        text: '我的',
        iconPath: 'assets/tab-icons/profile.png',
        selectedIconPath: 'assets/tab-icons/profile-active.png',
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
