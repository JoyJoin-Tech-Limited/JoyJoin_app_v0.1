import { MINI_PROGRAM_CENTER_HUB_TAB_ITEM, MINI_PROGRAM_TAB_INDEX, MINI_PROGRAM_TAB_ITEMS } from './tabBarConfig'

/**
 * Route → tab index, shared by every writer of the tab-bar selection.
 *
 * This map is duplicated inside `src/native-custom-tab-bar/index.js`
 * (`_routeToIndex`) because the native component is copied verbatim to
 * `dist/custom-tab-bar/` and cannot import TypeScript. The duplication is
 * locked by `lib/navigation/__tests__/tabBarRouteIndexParity.test.ts` — change
 * both in the same commit or that test fails.
 */
export const TAB_BAR_ROUTE_INDEX: ReadonlyMap<string, number> = new Map<string, number>([
  ...MINI_PROGRAM_TAB_ITEMS.map((item) => [item.pagePath, MINI_PROGRAM_TAB_INDEX[item.key]] as const),
  [MINI_PROGRAM_CENTER_HUB_TAB_ITEM.pagePath, MINI_PROGRAM_TAB_INDEX.centerHub],
  // Discover alias. `pages/pool-registration/index` is deliberately NOT in
  // `tabBar.list`, so WeChat attaches no tab bar there and `getTabBar()` is
  // undefined — the alias is inert defence for runtimes that do attach one.
  // Do not "fix" it by adding the route to `tabBar.list`: switchTab validation
  // and the 5-entry tab model depend on that list staying as-is.
  ['pages/pool-registration/index', MINI_PROGRAM_TAB_INDEX.discover],
])

/** Normalizes `pages/x/index`, `/pages/x/index`, and `...?$taroTimestamp=…`. */
export function normalizeTabRoute(route: string | null | undefined): string {
  return String(route ?? '').replace(/^\//, '').split('?')[0]
}

/**
 * Route truth for a page: the ONLY authority the tab bar may be revealed with.
 * Returns undefined for non-tab routes and for an empty/unresolved route.
 */
export function resolveTabIndexForRoute(route: string | null | undefined): number | undefined {
  return TAB_BAR_ROUTE_INDEX.get(normalizeTabRoute(route))
}
