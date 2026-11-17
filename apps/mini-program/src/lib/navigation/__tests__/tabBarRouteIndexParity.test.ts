import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { TAB_BAR_ROUTE_INDEX } from '../tabBarRouteIndex'

/**
 * The native custom tab bar is copied verbatim to `dist/custom-tab-bar/` and
 * cannot import TypeScript, so its `_routeToIndex` map duplicates
 * `TAB_BAR_ROUTE_INDEX`. A one-sided edit silently breaks selection for the
 * affected route (the bar hides, or lights the wrong tab) with no other test
 * failing — this parity check is the guard.
 */
const COMPONENT_SOURCE = readFileSync(
  resolve(__dirname, '../../../native-custom-tab-bar/index.js'),
  'utf8'
)

function extractRouteMaps(source: string): Array<Record<string, number>> {
  const maps: Array<Record<string, number>> = []
  // Matches BOTH declarations: the module-level property (`_routeToIndex: {`)
  // and the defensive re-seed inside attached (`this._routeToIndex = {`).
  // Matching only one of them let a one-sided edit to the map that actually
  // serves every instance pass silently.
  const pattern = /_routeToIndex\s*[:=]\s*\{([\s\S]*?)\}/g
  for (const match of source.matchAll(pattern)) {
    const entries: Record<string, number> = {}
    for (const pair of match[1].matchAll(/'([^']+)'\s*:\s*(\d+)/g)) {
      entries[pair[1]] = Number(pair[2])
    }
    maps.push(entries)
  }
  return maps
}

describe('tab bar route map parity', () => {
  const maps = extractRouteMaps(COMPONENT_SOURCE)

  it('finds both native route maps (guards against a silently empty scan)', () => {
    // 1) the module-level `_routeToIndex:` property, 2) the `attached` re-seed.
    expect(maps.length).toBe(2)
    expect(Object.keys(maps[0]).length).toBeGreaterThan(0)
  })

  it.each(maps.map((map, index) => [index, map] as const))(
    'native _routeToIndex #%i matches the shared TS map',
    (_index, nativeMap) => {
      const shared = Object.fromEntries(TAB_BAR_ROUTE_INDEX)
      expect(nativeMap).toEqual(shared)
    }
  )

  it('keeps the pool-registration Discover alias on both sides', () => {
    const shared = Object.fromEntries(TAB_BAR_ROUTE_INDEX)
    expect(shared['pages/pool-registration/index']).toBe(0)
    expect(maps.every((map) => map['pages/pool-registration/index'] === 0)).toBe(true)
  })
})
