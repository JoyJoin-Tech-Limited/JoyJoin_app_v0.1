import { MINI_PROGRAM_PAGES } from './lib/onboardingRoutes'
import { MINI_PROGRAM_TAB_BAR_CONFIG_ITEMS } from './lib/tabBarConfig'

export default defineAppConfig({
  pages: [...MINI_PROGRAM_PAGES],
  usingComponents: {},
  tabBar: {
    custom: true,
    color: '#9CA3AF',
    selectedColor: '#8B5CF6',
    backgroundColor: '#ffffff',
    borderStyle: 'white',
    list: MINI_PROGRAM_TAB_BAR_CONFIG_ITEMS,
  },
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#ffffff',
    navigationBarTitleText: 'JoyJoin',
    navigationBarTextStyle: 'black',
    backgroundColor: '#FAFAFA',
  },
})
