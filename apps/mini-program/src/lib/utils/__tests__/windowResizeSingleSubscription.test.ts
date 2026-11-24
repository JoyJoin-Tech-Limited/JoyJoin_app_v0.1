import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * 2026-11-24 device audit: WeChat logged
 * `[Event] 21 listeners of event WindowInfoChanged have been added, possibly
 * causing memory leak`.
 *
 * Until 2026-09-01 `ResponsiveSpacer` subscribed per mount, and hidden tab
 * pages are never unmounted, so the count only grew. `windowResizeHub` is the
 * one permitted native subscription; this scan keeps it that way.
 */

const SRC_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const HUB = 'lib/utils/windowResizeHub.ts'

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '__tests__' || entry.name === 'node_modules') continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) walk(full, acc)
    else if (/\.(ts|tsx|js)$/.test(entry.name)) acc.push(full)
  }
  return acc
}

const subscriptionsIn = (source: string) => source.match(/(?:Taro|wx)\.onWindowResize\s*\(/g) ?? []

describe('window-resize subscriptions stay single (2026-11-24)', () => {
  const files = walk(SRC_ROOT).filter((file) => !/\.test\.(ts|tsx)$/.test(file))

  it('only the hub calls the native subscription', () => {
    const offenders = files.filter(
      (file) =>
        file !== resolve(SRC_ROOT, HUB) && subscriptionsIn(readFileSync(file, 'utf-8')).length > 0
    )
    expect(offenders).toEqual([])
  })

  it('the hub keeps its module-level single-subscription guard', () => {
    const hub = readFileSync(resolve(SRC_ROOT, HUB), 'utf-8')
    expect(subscriptionsIn(hub)).toHaveLength(1)
    expect(hub).toContain('let nativeSubscribed = false')
    expect(hub).toContain('if (!nativeSubscribed')
  })
})
