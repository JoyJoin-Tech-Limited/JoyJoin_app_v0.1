import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

// Recurrence lock (2026-10-05): the full Alimama font must register under a
// DISTINCT family from the minimal subset. A same-family loadFontFace override
// is unreliable on device, so glyphs outside the minimal subset fell back to
// PingFang mid-string — the "irregular bold" bug on dynamic text (坪山区还在筹备中).
const here = dirname(fileURLToPath(import.meta.url))
const brandFontSrc = readFileSync(resolve(here, '../brandFont.ts'), 'utf8')
const variablesSrc = readFileSync(resolve(here, '../../../styles/_variables.scss'), 'utf8')

describe('brand font two-tier family contract', () => {
  it('declares a distinct full-font family', () => {
    expect(brandFontSrc).toContain("BRAND_DISPLAY_FONT_FAMILY = 'AlimamaFangYuanTiVF'")
    expect(brandFontSrc).toContain("BRAND_DISPLAY_FONT_FULL_FAMILY = 'AlimamaFangYuanTiVF-Full'")
  })

  it('loads minimal and full tiers under their own families', () => {
    const minimalBody = brandFontSrc.slice(
      brandFontSrc.indexOf('loadBrandDisplayFontMinimal'),
      brandFontSrc.indexOf('loadBrandDisplayFontFull'),
    )
    const fullBody = brandFontSrc.slice(
      brandFontSrc.indexOf('loadBrandDisplayFontFull'),
      brandFontSrc.indexOf('loadEnglishBrandFont'),
    )
    expect(minimalBody).toContain('family: BRAND_DISPLAY_FONT_FAMILY')
    expect(fullBody).toContain('family: BRAND_DISPLAY_FONT_FULL_FAMILY')
    expect(fullBody).not.toContain('family: BRAND_DISPLAY_FONT_FAMILY,')
  })

  it('$font-cn-display prefers the full family, then the minimal subset', () => {
    const stackLine = variablesSrc
      .split('\n')
      .find((line) => line.startsWith('$font-cn-display:'))
    expect(stackLine).toBeDefined()
    const fullIdx = stackLine!.indexOf("'AlimamaFangYuanTiVF-Full'")
    const minimalIdx = stackLine!.indexOf("'AlimamaFangYuanTiVF'")
    const pingfangIdx = stackLine!.indexOf("'PingFang SC'")
    expect(fullIdx).toBeGreaterThanOrEqual(0)
    expect(minimalIdx).toBeGreaterThan(fullIdx)
    expect(pingfangIdx).toBeGreaterThan(minimalIdx)
  })
})
