#!/usr/bin/env node
// 街头盲盒 teaser-mode preview generators (sprint_20261009_flash_teaser_mode).
// Three surfaces: Discover teaser card, static teaser page, hero banner
// variant D. Requires the mock H5 server to run with MOCK_FLASH_TEASER=true
// (fixture flips alangEnabled=false + flashTeaserHeroEnabled=true).
// `ctx` is supplied by screenshot-server.mjs.

export function registerFlashTeaserGenerators(ctx) {
  const {
    register,
    withBrowserPage,
    clearAndSeedStorage,
    screenshotViewport,
    DEFAULT_VIEWPORT,
    H5_BASE_URL,
  } = ctx

  async function openDiscover(page) {
    await page.goto(`${H5_BASE_URL}/#/pages/discover/index`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    })
    await clearAndSeedStorage(page)
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.waitForSelector('.discover-auth__location-pill', { timeout: 15000 })
    await page.waitForTimeout(1200)
  }

  // Discover with the 内测中 teaser card scrolled into view.
  async function captureFlashTeaserCard() {
    return withBrowserPage(DEFAULT_VIEWPORT, async (page) => {
      await openDiscover(page)
      await page.waitForSelector('.alang-discover-card--teaser', { timeout: 15000 })
      await page.evaluate(() => {
        document
          .querySelector('.alang-discover-card--teaser')
          ?.scrollIntoView({ block: 'center', behavior: 'instant' })
      })
      await page.waitForTimeout(900) // sheen/halo mid-cycle, fonts settle
      return screenshotViewport(page)
    })
  }

  // Hero banner variant D takeover at the top of Discover.
  async function captureFlashTeaserBanner() {
    return withBrowserPage(DEFAULT_VIEWPORT, async (page) => {
      await openDiscover(page)
      await page.waitForSelector('.hero-promo-banner--teaser', { timeout: 15000 })
      await page.waitForTimeout(900) // image reveal + stagger settle
      return screenshotViewport(page)
    })
  }

  // Static teaser page (CDN hero is intercepted and served from src/assets).
  async function captureFlashTeaserPage() {
    return withBrowserPage(DEFAULT_VIEWPORT, async (page) => {
      await page.goto(`${H5_BASE_URL}/#/pages/alang/teaser/index`, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      })
      await clearAndSeedStorage(page)
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })
      await page.waitForSelector('.flash-teaser__title', { timeout: 15000 })
      await page.waitForSelector('.flash-teaser__hero--revealed', { timeout: 15000 })
      await page.waitForTimeout(900)
      return screenshotViewport(page)
    })
  }

  register('flash-teaser-card', captureFlashTeaserCard)
  register('flash-teaser-banner', captureFlashTeaserBanner)
  register('flash-teaser-page', captureFlashTeaserPage)
}
