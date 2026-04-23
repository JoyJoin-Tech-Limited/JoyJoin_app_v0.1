import Taro from '@tarojs/taro'

import { logInfo, logWarn } from './logger'

/**
 * Must match `$font-cn-display` first family name in `styles/_variables.scss`.
 * Font file: `src/assets/fonts/Alimama/AlimamaFangYuanTiVF-Thin.ttf` (copied to `dist/assets/...` via Taro config).
 *
 * Device QA: on real WeChat builds, spot-check the VF Thin master on short primary CTA labels
 * (legibility vs. system fallback on smaller or low-DPI devices).
 */
export const BRAND_DISPLAY_FONT_FAMILY = 'AlimamaFangYuanTiVF'

const BRAND_FONT_SOURCE_PATH = '/assets/fonts/Alimama/AlimamaFangYuanTiVF-Thin.woff2'

/**
 * Must match `$font-en-brand` first family name in `styles/_variables.scss`.
 * Copy from `apps/user-client/src/assets/fonts/Quicksand/Quicksand-VariableFont_wght.ttf` when not vendored here.
 */
export const EN_BRAND_FONT_FAMILY = 'Quicksand'

const EN_BRAND_FONT_SOURCE_PATH = '/assets/fonts/Quicksand/Quicksand-VariableFont_wght.ttf'

/**
 * Loads the brand display face for mini-program and H5. On failure, CSS fallbacks
 * (`PingFang SC`, etc.) still apply via `$font-cn-display`.
 */
export function loadBrandDisplayFont(): void {
  if (process.env.TARO_ENV === 'rn') {
    return
  }

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
  if (process.env.TARO_ENV === 'rn') {
    return
  }

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
      logWarn('English brand font failed to load; falling back to system stack', {
        family: EN_BRAND_FONT_FAMILY,
        err,
      })
    })
}

/** Loads Alimama (Chinese display) and Quicksand (English brand). Call once at app launch. */
export function loadBrandFonts(): void {
  loadBrandDisplayFont()
  loadEnglishBrandFont()
}
