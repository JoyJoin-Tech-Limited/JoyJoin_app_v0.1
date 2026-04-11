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
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#ffffff',
    navigationBarTitleText: 'JoyJoin',
    navigationBarTextStyle: 'black',
    backgroundColor: '#FAFAFA',
  }
})
