import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, it, expect } from 'vitest'

/**
 * Structural regression tests for the native WeChat custom tab bar.
 *
 * The tab bar must remain a plain <view>/<image> tree. WeChat's <cover-view>
 * overlay only reliably renders <cover-view>/<cover-image> children; mixing
 * plain <view>/<image> inside a <cover-view> causes blank icons/labels.
 *
 * See commit history: 0f3f8361c (original fix), 2f9a71b3a (accidental hybrid
 * regression that this test prevents).
 */

describe('native custom tab bar structure', () => {
  const wxmlPath = resolve(__dirname, '..', 'index.wxml')
  const wxml = readFileSync(wxmlPath, 'utf-8')

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
