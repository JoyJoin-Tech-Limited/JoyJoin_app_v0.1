import { MINI_PROGRAM_PAGES } from './lib/onboardingRoutes'

export default defineAppConfig({
  pages: [...MINI_PROGRAM_PAGES],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#ffffff',
    navigationBarTitleText: 'JoyJoin',
    navigationBarTextStyle: 'black',
    backgroundColor: '#FAFAFA',
  }
})
