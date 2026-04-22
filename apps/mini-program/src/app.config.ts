import {
  MINI_PROGRAM_MAIN_PACKAGE_PAGES,
  MINI_PROGRAM_PRELOAD_RULES,
  MINI_PROGRAM_SUBPACKAGES,
} from './lib/onboardingRoutes'
import { MINI_PROGRAM_TAB_BAR_CONFIG_ITEMS } from './lib/tabBarConfig'
import {
  COLOR_TAB_INACTIVE,
  COLOR_PRIMARY,
  COLOR_SURFACE,
  COLOR_BACKGROUND,
  COLOR_NAVBAR_BG,
} from './lib/uiConstants'

const MINI_PROGRAM_SUBPACKAGES_CONFIG = MINI_PROGRAM_SUBPACKAGES.map((subpackage) => ({
  ...subpackage,
  pages: [...subpackage.pages],
}))

const MINI_PROGRAM_PRELOAD_RULE_CONFIG = Object.fromEntries(
  Object.entries(MINI_PROGRAM_PRELOAD_RULES).map(([pagePath, rule]) => [
    pagePath,
    {
      ...rule,
      packages: [...rule.packages],
    },
  ]),
)

export default defineAppConfig({
  lazyCodeLoading: 'requiredComponents',
  pages: [...MINI_PROGRAM_MAIN_PACKAGE_PAGES],
  subPackages: MINI_PROGRAM_SUBPACKAGES_CONFIG,
  preloadRule: MINI_PROGRAM_PRELOAD_RULE_CONFIG,
  usingComponents: {},
  tabBar: {
    custom: true,
    color: COLOR_TAB_INACTIVE,
    selectedColor: COLOR_PRIMARY,
    backgroundColor: COLOR_SURFACE,
    borderStyle: 'white',
    list: MINI_PROGRAM_TAB_BAR_CONFIG_ITEMS,
  },
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: COLOR_NAVBAR_BG,
    navigationBarTitleText: 'JoyJoin',
    navigationBarTextStyle: 'black',
    backgroundColor: COLOR_BACKGROUND,
  },
})
