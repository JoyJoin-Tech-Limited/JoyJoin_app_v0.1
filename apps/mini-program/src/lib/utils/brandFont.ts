import Taro from '@tarojs/taro'

import { localAsset } from './cdnAssets'
import { logInfo, logWarn } from './logger'

/**
 * Must match `$font-cn-display` first family name in `styles/_variables.scss`.
 * Font file: `src/assets/fonts/Alimama/AlimamaFangYuanTiVF-Thin.ttf` (copied to `dist/assets/...` via Taro config).
 *
 * Device QA: on real WeChat builds, spot-check the VF Thin master on short primary CTA labels
 * (legibility vs. system fallback on smaller or low-DPI devices).
 */
export const BRAND_DISPLAY_FONT_FAMILY = 'AlimamaFangYuanTiVF'

// ?v=full forces cache bust after uploading the complete glyph set (2026-05-21).
// Remove or increment if the font file is regenerated.
const BRAND_FONT_SOURCE_PATH = localAsset('/assets/fonts/Alimama/AlimamaFangYuanTiVF-Thin.woff2') + '?v=full'

let displayFontLoaded = false
let englishFontLoaded = false

/**
 * Must match `$font-en-brand` first family name in `styles/_variables.scss`.
 * Copy from `apps/user-client/src/assets/fonts/Quicksand/Quicksand-VariableFont_wght.ttf` when not vendored here.
 */
export const EN_BRAND_FONT_FAMILY = 'Quicksand'

const EN_BRAND_FONT_SOURCE_PATH = localAsset('/assets/fonts/Quicksand/Quicksand-VariableFont_wght.ttf')

/**
 * Loads the brand display face for mini-program and H5. On failure, CSS fallbacks
 * (`PingFang SC`, etc.) still apply via `$font-cn-display`.
 */
export function loadBrandDisplayFont(): void {
  if (process.env.TARO_ENV === 'rn' || displayFontLoaded) {
    return
  }

  displayFontLoaded = true
  const source = `url("${BRAND_FONT_SOURCE_PATH}")`

  void Taro.loadFontFace({
    family: BRAND_DISPLAY_FONT_FAMILY,
    global: true,
    source,
  })
    .then(() => {
      logInfo('Brand display font loaded', { family: BRAND_DISPLAY_FONT_FAMILY })
    })
    .catch((err: unknown) => {
      displayFontLoaded = false
      logWarn('Brand display font failed to load; falling back to system stack', {
        family: BRAND_DISPLAY_FONT_FAMILY,
        err,
      })
    })
}

/**
 * Loads Quicksand for English wordmarks and branded numerals. Falls back via `$font-en-brand`.
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
 * Loads Alimama (Chinese display) and Quicksand (English brand).
 * Previously called at app launch; now each font is loaded on-demand by the
 * first screen that needs it (display → LandingPage, English → future screen).
 * The module-level guards prevent redundant `loadFontFace` calls.
 */
export function loadBrandFonts(): void {
  loadBrandDisplayFont()
  loadEnglishBrandFont()
}
