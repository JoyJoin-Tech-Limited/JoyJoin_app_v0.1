export default defineAppConfig({
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
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#ffffff',
    navigationBarTitleText: 'JoyJoin',
    navigationBarTextStyle: 'black',
    backgroundColor: '#FAFAFA',
  },
  tabBar: {
    color: '#6B7280',
    selectedColor: '#8B5CF6',
    backgroundColor: '#ffffff',
    borderStyle: 'white',
    list: [
      { pagePath: 'pages/discover/index', text: '发现' },
      { pagePath: 'pages/events/index', text: '活动' },
      { pagePath: 'pages/my-events/index', text: '悦聚' },
      { pagePath: 'pages/chats/index', text: '圈子' },
      { pagePath: 'pages/profile/index', text: '我的' },
    ],
  },
})
