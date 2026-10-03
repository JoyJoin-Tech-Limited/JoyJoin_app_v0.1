#!/usr/bin/env node
// Discover 偏好区域 drawer preview generators (2026-09-30 coverage-map
// redesign). Extracted from screenshot-server.mjs to keep the server under
// the harness file-size warn line. `ctx` is supplied by screenshot-server.mjs.

export function registerDiscoverAreaGenerators(ctx) {
  const {
    register,
    withBrowserPage,
    clearAndSeedStorage,
    screenshotViewport,
    DEFAULT_VIEWPORT,
    H5_BASE_URL,
  } = ctx

  async function openDiscoverAreaDrawer(page) {
    await page.goto(`${H5_BASE_URL}/#/pages/discover/index`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    })
    await clearAndSeedStorage(page)
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.waitForSelector('.discover-auth__location-pill', { timeout: 15000 })
    await page.waitForTimeout(1200)
    await page.click('.discover-auth__location-pill')
    await page.waitForSelector('.location-drawer__district-grid', { state: 'visible', timeout: 10000 })
    await page.waitForTimeout(900) // entrance stagger settle
  }

  async function captureDiscoverAreaDrawer() {
    return withBrowserPage(DEFAULT_VIEWPORT, async (page) => {
      await openDiscoverAreaDrawer(page)
      return screenshotViewport(page)
    })
  }

  async function captureDiscoverAreaPending() {
    return withBrowserPage(DEFAULT_VIEWPORT, async (page) => {
      await openDiscoverAreaDrawer(page)
      await page.click('.location-drawer__pending-toggle')
      await page.waitForSelector('.location-drawer__pending-chip', { state: 'visible', timeout: 5000 })
      await page.waitForTimeout(400)
      return screenshotViewport(page)
    })
  }

  async function captureDiscoverAreaRescue() {
    return withBrowserPage(DEFAULT_VIEWPORT, async (page) => {
      await openDiscoverAreaDrawer(page)
      await page.click('.location-drawer__pending-toggle')
      await page.waitForSelector('.location-drawer__pending-chip', { state: 'visible', timeout: 5000 })
      await page.click('.location-drawer__pending-chip')
      await page.waitForSelector('.location-drawer__rescue-card', { state: 'visible', timeout: 5000 })
      await page.waitForTimeout(500) // rescue entrance settle
      return screenshotViewport(page)
    })
  }

  register('discover-area-drawer', captureDiscoverAreaDrawer)
  register('discover-area-pending', captureDiscoverAreaPending)
  register('discover-area-rescue', captureDiscoverAreaRescue)
}
