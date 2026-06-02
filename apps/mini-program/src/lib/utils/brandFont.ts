import Taro from '@tarojs/taro'

import { cdnAsset, localAsset } from './cdnAssets'
import { logInfo, logWarn } from './logger'

/**
 * Must match `$font-cn-display` first family name in `styles/_variables.scss`.
 *
 * Two-tier loading:
 *   1. Minimal subset (66KB, bundled) — instant display on landing + onboarding.
 *   2. Full font (621KB, CDN) — loads in background, overrides when ready.
 *
 * Both use the same family name so the swap is transparent.
 */
export const BRAND_DISPLAY_FONT_FAMILY = 'AlimamaFangYuanTiVF'

// Minimal subset — only characters needed for landing + onboarding.
const BRAND_FONT_MINIMAL_PATH = localAsset('/assets/fonts/Alimama/AlimamaFangYuanTiVF-Thin-minimal.woff2')

// Full font — complete glyph set from CDN.
// ?v=full forces cache bust after uploading the complete glyph set (2026-05-21).
const BRAND_FONT_FULL_PATH = cdnAsset('/assets/fonts/Alimama/AlimamaFangYuanTiVF-Thin.woff2') + '?v=full'

let minimalFontLoaded = false
let fullFontLoaded = false
let englishFontLoaded = false

/**
 * Must match `$font-en-brand` first family name in `styles/_variables.scss`.
 * Quicksand is 124KB — bundled locally for instant load.
 */
export const EN_BRAND_FONT_FAMILY = 'Quicksand'

const EN_BRAND_FONT_SOURCE_PATH = localAsset('/assets/fonts/Quicksand/Quicksand-VariableFont_wght.ttf')

/**
 * Load the minimal Alimama subset (66KB, local bundle).
 * Call this immediately on app launch / landing page mount for instant brand text.
 */
export function loadBrandDisplayFontMinimal(): void {
  if (process.env.TARO_ENV === 'rn' || minimalFontLoaded) {
    return
  }

  minimalFontLoaded = true
  const source = `url("${BRAND_FONT_MINIMAL_PATH}")`

  void Taro.loadFontFace({
    family: BRAND_DISPLAY_FONT_FAMILY,
    global: true,
    source,
  })
    .then(() => {
      logInfo('Brand display font (minimal) loaded', { family: BRAND_DISPLAY_FONT_FAMILY })
    })
    .catch((err: unknown) => {
      minimalFontLoaded = false
      logWarn('Brand display font (minimal) failed', { family: BRAND_DISPLAY_FONT_FAMILY, err })
    })
}

/**
 * Load the full Alimama font (621KB, CDN) in background.
 * Overrides the minimal subset when ready — transparent to the user.
 */
export function loadBrandDisplayFontFull(): void {
  if (process.env.TARO_ENV === 'rn' || fullFontLoaded) {
    return
  }

  fullFontLoaded = true
  const source = `url("${BRAND_FONT_FULL_PATH}")`

  void Taro.loadFontFace({
    family: BRAND_DISPLAY_FONT_FAMILY,
    global: true,
    source,
  })
    .then(() => {
      logInfo('Brand display font (full) loaded', { family: BRAND_DISPLAY_FONT_FAMILY })
    })
    .catch((err: unknown) => {
      fullFontLoaded = false
      logWarn('Brand display font (full) failed', { family: BRAND_DISPLAY_FONT_FAMILY, err })
    })
}

/**
 * Load Quicksand for English wordmarks and branded numerals. Falls back via `$font-en-brand`.
 */
export function loadEnglishBrandFont(): void {
  if (process.env.TARO_ENV === 'rn' || englishFontLoaded) {
    return
  }

  englishFontLoaded = true
  const source = `url("${EN_BRAND_FONT_SOURCE_PATH}")`

  void Taro.loadFontFace({
    family: EN_BRAND_FONT_FAMILY,
    global: true,
    source,
  })
    .then(() => {
      logInfo('English brand font loaded', { family: EN_BRAND_FONT_FAMILY })
    })
    .catch((err: unknown) => {
      englishFontLoaded = false
      logWarn('English brand font failed to load; falling back to system stack', {
        family: EN_BRAND_FONT_FAMILY,
        err,
      })
    })
}

/**
 * Two-tier font loading:
 *   1. Minimal subset instantly (local bundle).
 *   2. Full font deferred by 500ms so it doesn't compete with first paint.
 *
 * Call this on app launch and on every early-stage screen mount.
 * The module-level guards prevent redundant `loadFontFace` calls.
 */
export function loadBrandDisplayFont(): void {
  loadBrandDisplayFontMinimal()
  setTimeout(() => loadBrandDisplayFontFull(), 500)
}

/**
 * Convenience: load both Chinese display and English brand fonts.
 */
export function loadBrandFonts(): void {
  loadBrandDisplayFont()
  loadEnglishBrandFont()
}
