import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, it, expect } from 'vitest'

const tabBarDir = resolve(__dirname, '..')

function read(file: string): string {
  return readFileSync(resolve(tabBarDir, file), 'utf-8')
}

/**
 * Extract all icon paths from the hardcoded leftTabs/rightTabs data in index.js.
 * We scan for `icon: '...'` and `selectedIcon: '...'` values that look like
 * file references (contain / or .) to avoid catching WeChat API params like
 * `wx.showToast({ icon: 'none' })`.
 */
function extractIconPathsFromJS(js: string): string[] {
  const re = /(?:icon|selectedIcon):\s*'([^']+)'/g
  const paths: string[] = []
  let match
  while ((match = re.exec(js)) !== null) {
    const val = match[1]
    // Only keep values that look like file paths (contain / or .)
    // This excludes WeChat API params like `icon: 'none'`.
    if (val.includes('/') || val.includes('.')) {
      paths.push(val)
    }
  }
  return paths
}

/**
 * "resolves" a relative component path (../assets/...) to absolute source path.
 */
function resolveIconRef(relativePath: string): string {
  // index.js uses paths like ../assets/tab-icons/xxx.png
  // relative to src/native-custom-tab-bar/
  const resolved = resolve(tabBarDir, relativePath)
  return resolved
}

describe('native custom tab bar structure', () => {
  const wxml = read('index.wxml')

  it('does not use cover-view or cover-image tags (outside comments)', () => {
    // Strip XML comments before checking tags.
    const withoutComments = wxml.replace(/<!--[\s\S]*?-->/g, '')

    expect(withoutComments).not.toMatch(/<cover-view[\s>]/i)
    expect(withoutComments).not.toMatch(/<\/cover-view\s*>/i)
    expect(withoutComments).not.toMatch(/<cover-image[\s>]/i)
    expect(withoutComments).not.toMatch(/<\/cover-image\s*>/i)
  })

  it('uses a plain <view> root with nested <view>/<image>', () => {
    expect(wxml.trim()).toMatch(/^<view\s+/)
  })

  it('keeps the anti-regression comment about cover-view pitfalls', () => {
    expect(wxml).toContain('Do NOT wrap children in <cover-view>/<cover-image>')
    expect(wxml).toContain('causing blank tab icons')
  })
})

describe('native custom tab bar icon format (2026-06-18 regression guard)', () => {
  const js = read('index.js')

  it('hardcodes all tab icon paths as .png (never .webp) in index.js', () => {
    const iconPaths = extractIconPathsFromJS(js)
    expect(iconPaths.length).toBeGreaterThanOrEqual(8) // 4 tabs × 2 states

    for (const p of iconPaths) {
      expect(p).toMatch(/\.png$/)
      expect(p).not.toMatch(/\.webp$/)
    }
  })

  it('all icon files referenced from index.js exist on disk', () => {
    const iconPaths = extractIconPathsFromJS(js)
    for (const p of iconPaths) {
      const abs = resolveIconRef(p)
      expect(existsSync(abs), `Missing icon file: ${p} (resolved to ${abs})`).toBe(true)
    }
  })
})

describe('tab bar config component icon format (kept in sync with index.js)', () => {
  const configPath = resolve(__dirname, '..', '..', 'lib', 'navigation', 'tabBarConfig.ts')
  const config = readFileSync(configPath, 'utf-8')

  it('all componentIconPath values use .png (never .webp)', () => {
    const re = /component(?:IconPath|SelectedIconPath):\s*'([^']+)'/g
    let match
    while ((match = re.exec(config)) !== null) {
      expect(match[1]).toMatch(/\.png$/)
      expect(match[1]).not.toMatch(/\.webp$/)
    }
  })
})
