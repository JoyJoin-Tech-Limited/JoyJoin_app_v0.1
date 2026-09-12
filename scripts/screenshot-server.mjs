import express from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { chromium, devices } from 'playwright'

const app = express()
const PORT = process.env.SCREENSHOT_PORT || 9000
const H5_BASE_URL = process.env.H5_BASE_URL || 'http://localhost:5001'
const PLAYWRIGHT_EXECUTABLE_PATH = process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined
const LOCAL_MINI_PROGRAM_ASSETS = path.resolve(
  process.cwd(),
  'apps/mini-program/src/assets',
)

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  next()
})

const generators = new Map()

function register(name, generator) {
  generators.set(name, generator)
}

app.get('/:name.png', async (req, res) => {
  const name = req.params.name
  const generator = generators.get(name)
  if (!generator) {
    const available = Array.from(generators.keys()).map(k => `  - ${k}.png`).join('\n')
    res.status(404).json({
      error: `No generator registered for "${name}.png"`,
      available: available || 'none',
    })
    return
  }
  try {
    const buffer = await generator()
    res.setHeader('Content-Type', 'image/png')
    res.setHeader('Cache-Control', 'no-store')
    res.send(buffer)
  } catch (err) {
    console.error(`[screenshot] ${name} failed`, err)
    res.status(500).json({ error: String(err.message || err) })
  }
})

app.get('/', (req, res) => {
  const links = Array.from(generators.keys())
    .map(k => `<li><a href="/${k}.png">/${k}.png</a></li>`)
    .join('')
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.send(`<h1>Screenshot server</h1><ul>${links || '<li>No generators registered</li>'}</ul>`)
})

// ─── Helpers ─────────────────────────────────────────────────────

async function clearAndSeedStorage(page, extra = {}) {
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
  if (Object.keys(extra).length > 0) {
    await page.evaluate((data) => {
      Object.entries(data).forEach(([k, v]) => {
        localStorage.setItem(k, JSON.stringify(v))
      })
    }, extra)
  }
}

async function waitForContent(page, selector, timeout = 10000) {
  await page.waitForSelector(selector, { state: 'visible', timeout })
  await page.waitForTimeout(800)
}

async function screenshotPage(page) {
  return page.screenshot({ fullPage: true })
}

async function screenshotViewport(page) {
  return page.screenshot({ fullPage: false })
}

async function withBrowserPage(viewport, fn) {
  const browser = await chromium.launch({
    headless: true,
    ...(PLAYWRIGHT_EXECUTABLE_PATH
      ? { executablePath: PLAYWRIGHT_EXECUTABLE_PATH }
      : {}),
  })
  const context = await browser.newContext(viewport)
  const page = await context.newPage()
  try {
    await page.route(/https:\/\/(cdn\.)?joyjoinapp\.com\/static\/assets\/.*/, async (route) => {
      const pathname = new URL(route.request().url()).pathname
      const relativePath = pathname.replace(/^\/static\/assets\//, '')
      const localPath = path.resolve(LOCAL_MINI_PROGRAM_ASSETS, relativePath)
      const staysInAssetRoot = localPath.startsWith(`${LOCAL_MINI_PROGRAM_ASSETS}${path.sep}`)

      if (staysInAssetRoot && fs.existsSync(localPath)) {
        await route.fulfill({ path: localPath })
        return
      }

      await route.continue()
    })
    return await fn(page)
  } finally {
    await browser.close()
  }
}

const DEFAULT_VIEWPORT = {
  viewport: { width: 375, height: 812 },
  deviceScaleFactor: 2,
}

const V17_VIEWPORT = {
  ...devices['iPhone 13'],
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  colorScheme: 'light',
  locale: 'zh-CN',
  reducedMotion: 'reduce',
  timezoneId: 'Asia/Shanghai',
}

const V17_GEO_VIEWPORT = {
  ...V17_VIEWPORT,
  permissions: ['geolocation'],
  // This is the simulated user's position near Shenzhen Science Park. It is
  // not an NPC target; the search page receives only distance from the API.
  geolocation: { latitude: 22.5403, longitude: 113.9345, accuracy: 18 },
}

// ─── Generators ──────────────────────────────────────────────────

async function captureEventsPage() {
  return withBrowserPage(DEFAULT_VIEWPORT, async (page) => {
    await page.goto(`${H5_BASE_URL}/#/pages/events/index`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    })
    await clearAndSeedStorage(page)
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.waitForSelector('.events-page__list', { timeout: 10000 })
    await page.waitForTimeout(1500)
    return screenshotPage(page)
  })
}

async function captureTierSelector() {
  return withBrowserPage(DEFAULT_VIEWPORT, async (page) => {
    await page.goto(
      `${H5_BASE_URL}/#/pages/icebreaker-session/tier-selector/index?sessionId=test-screenshot-123`,
      { waitUntil: 'domcontentloaded', timeout: 60000 }
    )
    await clearAndSeedStorage(page)
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.waitForSelector('.tier-selector__preset-list', { timeout: 10000 })
    await page.waitForTimeout(1000)
    return screenshotPage(page)
  })
}

const POOL_ID = 'pool-screenshot-001'

async function capturePoolRegistration() {
  return withBrowserPage(
    { ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 },
    async (page) => {
      const returnContext = {
        kind: 'pool-registration',
        userId: 'user-screenshot-001',
        poolId: POOL_ID,
        poolTitle: '周末松弛感饭局 · 南山',
        poolArea: '南山',
        poolEventType: '饭局',
        draft: {
          budgetRange: ['150-200'],
          eventIntent: ['friends', 'discussion'],
          preferredLanguages: ['普通话'],
          dietaryRestrictions: [],
        },
        resumeStep: 3,
        handoffCode: 'NO_ACTIVE_ENTITLEMENT',
        paymentStatus: 'payment-required',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      await page.goto(`${H5_BASE_URL}/#/pages/pool-registration/index?id=${POOL_ID}`, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      })
      await clearAndSeedStorage(page, { payment_return_context: returnContext })
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })

      await waitForContent(page, '.pool-reg__title')
      return screenshotPage(page)
    }
  )
}

async function captureEventTicketPayment() {
  return withBrowserPage(
    { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 },
    async (page) => {
      const returnContext = {
        kind: 'pool-registration',
        userId: 'user-screenshot-001',
        poolId: POOL_ID,
        poolTitle: '周末松弛感饭局 · 南山',
        poolArea: '南山',
        poolEventType: '饭局',
        draft: {},
        resumeStep: 3,
        handoffCode: 'NO_ACTIVE_ENTITLEMENT',
        paymentStatus: 'payment-required',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      await page.goto(`${H5_BASE_URL}/#/pages/event-ticket-payment/index?poolId=${POOL_ID}`, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      })
      await clearAndSeedStorage(page, { payment_return_context: returnContext })
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })

      await waitForContent(page, '.ticket-card')
      return screenshotPage(page)
    }
  )
}

async function captureSquadUnboxingReady() {
  return withBrowserPage(
    { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 },
    async (page) => {
      await page.goto(
        `${H5_BASE_URL}/#/pages/squad-unboxing/index?groupId=group-screenshot-001&__story=ready&motion=reduce`,
        { waitUntil: 'domcontentloaded', timeout: 60000 }
      )
      await clearAndSeedStorage(page)
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })

      await page.waitForSelector('#drag-reveal-track', { timeout: 10000 })
      await page.waitForTimeout(1200)
      return page.screenshot({ fullPage: false })
    }
  )
}

async function captureSquadUnboxingShaking() {
  return withBrowserPage(
    { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 },
    async (page) => {
      await page.goto(
        `${H5_BASE_URL}/#/pages/squad-unboxing/index?groupId=group-screenshot-001&__story=shaking&motion=reduce`,
        { waitUntil: 'domcontentloaded', timeout: 60000 }
      )
      await clearAndSeedStorage(page)
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })

      await page.waitForSelector('.squad-unboxing__stage--shaking', { timeout: 10000 })
      await page.waitForTimeout(1200)
      return page.screenshot({ fullPage: false })
    }
  )
}

async function captureSquadUnboxingFocused() {
  return withBrowserPage(
    { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 },
    async (page) => {
      await page.goto(
        `${H5_BASE_URL}/#/pages/squad-unboxing/index?groupId=group-screenshot-001&__story=focused&motion=reduce`,
        { waitUntil: 'domcontentloaded', timeout: 60000 }
      )
      await clearAndSeedStorage(page)
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })

      // Wait for the focused card lift (page-owned focus state; the old
      // on-demand detail panel was retired — narration lives in the dock).
      await page.waitForSelector('.squad-unboxing__deck-card--focused', { timeout: 10000 })
      await page.waitForTimeout(1200)

      // Hide the fixed bottom dock so the viewport shot isn't blocked.
      await page.addStyleTag({ content: '.squad-unboxing__bottom-dock { display: none !important; }' })
      await page.waitForTimeout(400)
      return page.screenshot({ fullPage: false })
    }
  )
}

/**
 * Story-mode revealed captures (tap-to-reveal, AC-09):
 * - `revealed-partial`: me + 2 tablemates face-up, hint chip shows the live
 *   unflipped count and doubles as the reveal-all trigger.
 * - `revealed-allup`: every card face-up (post-burst resting state).
 * - `revealed-overflow`: 9-member roster — the fan caps at 8 cards and the
 *   9th collapses into a "+1" chip on the last card, front AND back (AC-10).
 * Seeds are controller-side (no timers/analytics) so captures are
 * deterministic.
 */
async function captureSquadUnboxingStoryRevealed(storyName, { groupId = 'group-screenshot-001', waitChip = false } = {}) {
  return withBrowserPage(
    { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 },
    async (page) => {
      await page.goto(
        `${H5_BASE_URL}/#/pages/squad-unboxing/index?groupId=${groupId}&__story=${storyName}&motion=reduce`,
        { waitUntil: 'domcontentloaded', timeout: 60000 }
      )
      await clearAndSeedStorage(page)
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })

      await page.waitForSelector('.squad-unboxing__deck-stage', { timeout: 10000 })
      await page.waitForSelector('.squad-unboxing__deck-card', { timeout: 10000 })
      if (waitChip) {
        await page.waitForSelector('.squad-unboxing__reveal-chip', { timeout: 10000 })
      }
      // Give archetype images time to load over the CDN.
      await page.waitForTimeout(2500)

      await page.addStyleTag({ content: '.squad-unboxing__action-zone { display: none !important; }' })
      await page.waitForTimeout(200)

      await page.evaluate(() => {
        const deck = document.querySelector('.squad-unboxing__deck-stage')
        if (deck) deck.scrollIntoView({ behavior: 'instant', block: 'start', inline: 'nearest' })
      })
      await page.waitForTimeout(400)

      return page.screenshot({ fullPage: false })
    }
  )
}

/**
 * Pocketed-phase capture (2026-07-15 audit CONCERN-3): `__story=revealed-pocketed`
 * jumps straight to the settled pocketed phase with partial flip seeds. The
 * deck stage stays mounted but `visibility:hidden` (instant re-fan), so this
 * capture waits on the pill instead of the deck. The bottom dock is kept
 * visible on purpose — pill-vs-dock geometry is part of what this verifies.
 */
async function captureSquadUnboxingStoryPocketed({ groupId = 'group-screenshot-001' } = {}) {
  return withBrowserPage(
    { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 },
    async (page) => {
      await page.goto(
        `${H5_BASE_URL}/#/pages/squad-unboxing/index?groupId=${groupId}&__story=revealed-pocketed&motion=reduce`,
        { waitUntil: 'domcontentloaded', timeout: 60000 }
      )
      await clearAndSeedStorage(page)
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })

      await page.waitForSelector('.squad-unboxing__deck-pill', { timeout: 10000 })
      // Spoiler gating check: back-chips for unflipped members must be in the
      // strip (audit CONCERN-3 — this is the state the old pipeline could not
      // render at all).
      await page.waitForSelector('.squad-unboxing__deck-pill-mini--back', { timeout: 10000 })
      // Give archetype images time to load over the CDN.
      await page.waitForTimeout(2500)
      await page.waitForTimeout(400)

      return page.screenshot({ fullPage: false })
    }
  )
}

async function captureSquadUnboxingRevealed(groupId = 'group-screenshot-001') {
  return withBrowserPage(
    { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 },
    async (page) => {
      await page.goto(
        `${H5_BASE_URL}/#/pages/squad-unboxing/index?groupId=${groupId}&motion=reduce`,
        { waitUntil: 'domcontentloaded', timeout: 60000 }
      )
      await clearAndSeedStorage(page)
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })

      // Wait for the blind-box card / drag ribbon to render in ready state.
      await page.waitForSelector('#drag-reveal-track', { timeout: 10000 })
      await page.waitForTimeout(600)

      // Tap fallback is active because motion=reduce. Click the track to reveal.
      await page.click('#drag-reveal-track')

      // With reduced motion, shaking -> revealed takes ~220ms; wait for deck.
      await page.waitForSelector('.squad-unboxing__deck-stage', { timeout: 10000 })
      await page.waitForTimeout(1200)

      // Wait for the analysis chapter to render (progressive reveal in stages).
      await page.waitForSelector('.squad-unboxing__analysis-bubble', { timeout: 10000 })
      // Give archetype images time to load over the CDN.
      await page.waitForTimeout(2500)

      // The action zone is fixed-position; hide it so the viewport shot isn't
      // blocked by the bottom dock when we scroll to the deck.
      await page.addStyleTag({ content: '.squad-unboxing__action-zone { display: none !important; }' })
      await page.waitForTimeout(200)

      // Scroll to the card deck so the screenshot centers on the new UI.
      await page.evaluate(() => {
        const deck = document.querySelector('.squad-unboxing__deck-stage')
        if (deck) {
          deck.scrollIntoView({ behavior: 'instant', block: 'start', inline: 'nearest' })
        }
      })
      await page.waitForTimeout(400)

      return page.screenshot({ fullPage: false })
    }
  )
}

async function captureProfileReview() {
  const fs = await import('node:fs')
  fs.appendFileSync('/tmp/profile-review-screenshot-debug.log', '[captureProfileReview] invoked\n')
  return withBrowserPage(
    { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 },
    async (page) => {
      const log = (msg) => {
        const line = `[screenshot] profile-review: ${JSON.stringify(msg)}\n`
        fs.appendFileSync('/tmp/profile-review-screenshot-debug.log', line)
      }
      log({ step: 'enter' })
      const url = `${H5_BASE_URL}/#/pages/onboarding/profile-review/index?motion=reduce`
      log({ step: 'goto', url })
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
      await clearAndSeedStorage(page)
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })
      log({ step: 'reloaded' })

      // Wait for the profile-review shell and the welcome gift card to render.
      await page.waitForSelector('.profile-review__shell', { timeout: 10000 })
      await page.waitForTimeout(800)
      log({ step: 'shell-visible' })

      // Debug: capture page state before waiting for gift card.
      const hasGiftCard = await page.locator('.welcome-gift-card').count()
      const hasCouponError = await page.locator('.profile-review__error').count()
      const html = await page.content()
      log({ hasGiftCard, hasCouponError, htmlLength: html.length })

      await page.waitForSelector('.welcome-gift-card', { timeout: 10000 })
      await page.waitForTimeout(1200)

      return page.screenshot({ fullPage: true })
    }
  )
}

async function captureMatchingStatusPuzzlePrelude() {
  return withBrowserPage(
    { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 },
    async (page) => {
      const url =
        `${H5_BASE_URL}/#/pages/matching-status/index` +
        '?registrationId=reg-screenshot-001&__story=puzzle&motion=reduce'
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
      await clearAndSeedStorage(page)
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })

      await page.waitForSelector('.abstract-puzzle-table__grid', { timeout: 10000 })
      // Allow the overlay card and puzzle pieces to settle (reduced motion => static grid).
      await page.waitForTimeout(1200)

      return page.screenshot({ fullPage: true })
    }
  )
}

async function captureProfileV17() {
  return withBrowserPage(V17_VIEWPORT, async (page) => {
    await page.goto(`${H5_BASE_URL}/#/pages/profile/index?motion=reduce`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    })
    await clearAndSeedStorage(page)
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })

    await waitForContent(page, '.profile-page__identity-stage--entered')
    await page.waitForSelector('.profile-page__story-card', { state: 'visible', timeout: 10000 })
    await page.waitForFunction(() => {
      const growth = document.querySelector('.profile-page__growth-value')?.textContent?.trim()
      const stats = Array.from(document.querySelectorAll('.profile-page__stat-value'))
        .map((element) => element.textContent?.trim())
      const storyCta = document.querySelector('.profile-page__story-cta')?.textContent?.trim()
      return growth === '260' && stats.includes('4') && stats.includes('11') && storyCta === '进入我的故事'
    }, undefined, { timeout: 10000 })

    return screenshotViewport(page)
  })
}

async function captureDiscoverAlangV17() {
  return withBrowserPage(V17_VIEWPORT, async (page) => {
    await page.goto(`${H5_BASE_URL}/#/pages/discover/index?motion=reduce`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    })
    await clearAndSeedStorage(page, {
      discover_last_location: {
        clusterId: 'nanshan',
        districtId: 'keji',
        timestamp: Date.now(),
      },
    })
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })

    await waitForContent(page, '.alang-discover-card')
    await page.waitForFunction(() => {
      const title = document.querySelector('.alang-discover-card__title')?.textContent ?? ''
      const cta = document.querySelector('.alang-discover-card__cta-text')?.textContent ?? ''
      return title.includes('阿浪') && cta === '继续这段故事'
    }, undefined, { timeout: 10000 })
    const card = page.locator('.alang-discover-card')
    await card.scrollIntoViewIfNeeded()
    await page.waitForTimeout(300)

    // Keep the Alang card in context and use the same 390×844 viewport as the
    // other V1.7 captures so the five-page acceptance set is directly comparable.
    return screenshotViewport(page)
  })
}

async function captureAlangSearchV17() {
  return withBrowserPage(V17_GEO_VIEWPORT, async (page) => {
    await page.goto(
      `${H5_BASE_URL}/#/pages/alang/search/index?slug=${encodeURIComponent('meet-alang')}&motion=reduce`,
      { waitUntil: 'domcontentloaded', timeout: 60000 }
    )
    await clearAndSeedStorage(page)
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })

    await waitForContent(page, '.alang-search__radar-card')
    await page.waitForFunction(() => {
      const distance = document.querySelector('.alang-search__distance-value')?.textContent?.trim()
      const privacy = document.querySelector('.alang-search__map-subtitle')?.textContent ?? ''
      return distance === '118' && privacy.includes('不显示阿浪坐标或路线')
    }, undefined, { timeout: 15000 })

    return screenshotViewport(page)
  })
}

async function capturePersonalStoryV17() {
  return withBrowserPage(V17_VIEWPORT, async (page) => {
    await page.goto(`${H5_BASE_URL}/#/pages/profile-linked/personal-story/index?motion=reduce`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    })
    await clearAndSeedStorage(page)
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })

    await waitForContent(page, '.personal-story__cover')
    await page.waitForSelector('.personal-story__timeline', { state: 'visible', timeout: 10000 })
    await page.waitForFunction(() => {
      const title = document.querySelector('.personal-story__title')?.textContent ?? ''
      const chapters = document.querySelectorAll('.personal-story__chapter').length
      return title.includes('你的故事') && chapters === 2
    }, undefined, { timeout: 10000 })

    return screenshotViewport(page)
  })
}

async function captureMyImageV17() {
  return withBrowserPage(V17_VIEWPORT, async (page) => {
    await page.goto(`${H5_BASE_URL}/#/pages/profile-linked/my-image/index?motion=reduce`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    })
    await clearAndSeedStorage(page)
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })

    await waitForContent(page, '.my-image__stage')
    await page.waitForSelector('.my-image__tabs', { state: 'visible', timeout: 10000 })
    await page.waitForFunction(() => {
      const body = document.querySelector('.pixel-avatar-composite__body')?.getAttribute('src') ?? ''
      const layers = document.querySelectorAll('.pixel-avatar-composite__layer').length
      const fragment = document.querySelector('.my-image__balance-value')?.textContent ?? ''
      const baseNote = document.querySelector('.my-image__base-note')?.textContent ?? ''
      const hotspots = document.querySelectorAll('.pixel-avatar-composite__hotspot').length
      // Complete starter set → approved full-starter look (zero per-slot layers).
      const approvedLook = /full-starter-v2\.[a-f0-9]{12}\.webp/.test(body) && layers === 0
      // Partial outfit → body + independent layers.
      const layeredLook = /body-front-v2\.[a-f0-9]{12}\.webp/.test(body) && layers > 0
      return (approvedLook || layeredLook)
        && hotspots === 4
        && fragment.includes('70')
        && baseNote.includes('基础内搭不可脱')
    }, undefined, { timeout: 10000 })

    return screenshotViewport(page)
  })
}

async function captureProfileSettingsV17() {
  return withBrowserPage(V17_VIEWPORT, async (page) => {
    await page.goto(`${H5_BASE_URL}/#/pages/profile-linked/settings/index?motion=reduce`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    })
    await clearAndSeedStorage(page)
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })

    await waitForContent(page, '.profile-settings__intro')
    await page.waitForSelector('.profile-settings__card', { state: 'visible', timeout: 10000 })
    await page.waitForFunction(() => {
      const title = document.querySelector('.profile-settings__title')?.textContent?.trim()
      const rows = document.querySelectorAll('.profile-settings__row').length
      const logout = document.querySelector('.profile-settings__logout-text')?.textContent?.trim()
      return title === '设置与服务' && rows === 6 && logout === '退出登录'
    }, undefined, { timeout: 10000 })

    return screenshotViewport(page)
  })
}

// ─── Social Icebreaker (PhaseHeroCard revamp visual review) ─────

function captureIcebreaker(sessionId, waitSelector = '.phase-hero-card', extraWaitMs = 1200) {
  return withBrowserPage(DEFAULT_VIEWPORT, async (page) => {
    await page.goto(`${H5_BASE_URL}/#/pages/icebreaker-session/index?sessionId=${sessionId}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    })
    await clearAndSeedStorage(page)
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })
    await waitForContent(page, waitSelector)
    await page.waitForTimeout(extraWaitMs)
    return screenshotPage(page)
  })
}

// ─── Landing (Blind-box City hero, 2026-07-26) ──────────────────────
// Guest-state capture: the mock server auths as MOCK_USER by default, which
// would trigger the landing's unified redirect to nextStep — force 401 on
// /api/auth/user so the page stays on the landing in new-user mode.
async function captureLandingBlindBox() {
  return withBrowserPage(
    { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 },
    async (page) => {
      await page.route('**/api/auth/user', (route) =>
        route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, error: 'unauthenticated' }),
        }),
      )
      await page.goto(`${H5_BASE_URL}/#/pages/index/index`, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      })
      await clearAndSeedStorage(page)
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })

      // BoxLogoEntryScreen finishes first; then LandingPage mounts and the
      // ~1.4s entrance choreography (box land → halo bloom → sprite stagger →
      // Xiaoyue peek → copy rise → CTA) plays out.
      await page.waitForSelector('.landing-page', { state: 'visible', timeout: 20000 })
      await page.waitForSelector('.hero-stage__hero-img--in', { state: 'attached', timeout: 15000 })
      // Let the entrance settle and the hero/sprites decode via the asset proxy.
      await page.waitForTimeout(2800)

      // Accept the legal checkbox so the capture shows the primary CTA fully
      // lit (one-tap reachable state; also exercises the checkbox visual).
      await page.click('.landing-page__legal-checkbox')
      await page.waitForTimeout(400)

      return screenshotViewport(page)
    }
  )
}

register('landing-blind-box', captureLandingBlindBox)

// Legal-gate hint variant: tap the primary CTA WITHOUT accepting the legal
// checkbox → shake + floating hint pill (PM review 2026-07-28).
async function captureLandingLegalHint() {
  return withBrowserPage(
    { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 },
    async (page) => {
      await page.route('**/api/auth/user', (route) =>
        route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, error: 'unauthenticated' }),
        }),
      )
      await page.goto(`${H5_BASE_URL}/#/pages/index/index`, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      })
      await clearAndSeedStorage(page)
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })
      await page.waitForSelector('.landing-page', { state: 'visible', timeout: 20000 })
      await page.waitForSelector('.hero-stage__hero-img--in', { state: 'attached', timeout: 15000 })
      await page.waitForTimeout(2800)
      await page.click('.landing-page__cta--primary')
      await page.waitForSelector('.landing-page__legal-hint', { state: 'visible', timeout: 5000 })
      await page.waitForTimeout(300)
      return screenshotViewport(page)
    }
  )
}
register('landing-legal-hint', captureLandingLegalHint)
register('icebreaker-micro-challenge', () => captureIcebreaker('mock-micro_challenge'))
register('icebreaker-lie-detective', () => captureIcebreaker('mock-lie_detective'))
register('icebreaker-auction', () => captureIcebreaker('mock-auction'))
register('icebreaker-personality-dice', () => captureIcebreaker('mock-personality_dice'))
register('icebreaker-speed-friending', () => captureIcebreaker('mock-speed_friending'))
register('icebreaker-fuse', () => captureIcebreaker('mock-fuse', '.icebreaker__fuse-banner'))
register('icebreaker-stall', () => captureIcebreaker('mock-stall', '.icebreaker__stall-nudge'))
register('icebreaker-recap', () => captureIcebreaker('mock-recap', '.icebreaker__recap-hero'))
register('icebreaker-warmup-mood', () => captureIcebreaker('mock-warmup-mood', '.warmup-card-slot__mood-grid'))
register('icebreaker-warmup-topic', () => captureIcebreaker('mock-warmup-topic', '.warmup-card-slot__foil-shell', 5000))

// Interactive warmup captures: tap a mood, then screenshot the resulting state.
function captureIcebreakerWarmupInteraction(sessionId, waitSelector, settleMs = 800) {
  return withBrowserPage(DEFAULT_VIEWPORT, async (page) => {
    await page.goto(`${H5_BASE_URL}/#/pages/icebreaker-session/index?sessionId=${sessionId}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    })
    await clearAndSeedStorage(page)
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })
    await waitForContent(page, '.warmup-card-slot__mood-grid')
    await page.click('.warmup-card-slot__mood-option')
    await page.waitForSelector(waitSelector, { state: 'visible', timeout: 15000 })
    await page.waitForTimeout(settleMs)
    return screenshotPage(page)
  })
}

// Reduce-motion variant: the H5 preview cannot complete the CardFlip CSS
// transition reliably, so the settled topic-card layout is verified with
// motion=reduce (deal/flip resolve instantly, final face shown).
register('icebreaker-warmup-topic-settled', () =>
  withBrowserPage(DEFAULT_VIEWPORT, async (page) => {
    await page.goto(`${H5_BASE_URL}/#/pages/icebreaker-session/index?sessionId=mock-warmup-topic&motion=reduce`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    })
    await clearAndSeedStorage(page)
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })
    await waitForContent(page, '.warmup-card-slot__foil-shell')
    await page.waitForTimeout(2500)
    return screenshotPage(page)
  }))

register('icebreaker-warmup-generating', () =>
  captureIcebreakerWarmupInteraction('mock-warmup-generating', '.warmup-card-slot__generating-text', 1200))
register('icebreaker-warmup-error', () =>
  captureIcebreakerWarmupInteraction('mock-warmup-error', '.warmup-card-slot__error-text'))
register('events-footprint-oracle-card', captureEventsPage)
register('tier-selector-preset-cards', captureTierSelector)
register('pool-registration-step-0-brief', capturePoolRegistration)
register('event-ticket-payment', captureEventTicketPayment)
register('squad-unboxing-ready', captureSquadUnboxingReady)
register('squad-unboxing-shaking', captureSquadUnboxingShaking)
register('squad-unboxing-focused', captureSquadUnboxingFocused)
register('squad-unboxing-revealed', () => captureSquadUnboxingRevealed())
register('squad-unboxing-revealed-6', () => captureSquadUnboxingRevealed('group-screenshot-006'))
register('squad-unboxing-revealed-partial', () => captureSquadUnboxingStoryRevealed('revealed-partial', { waitChip: true }))
register('squad-unboxing-revealed-allup', () => captureSquadUnboxingStoryRevealed('revealed-allup'))
register('squad-unboxing-revealed-overflow', () => captureSquadUnboxingStoryRevealed('revealed-partial', { groupId: 'group-screenshot-009', waitChip: true }))
register('squad-unboxing-revealed-pocketed', () => captureSquadUnboxingStoryPocketed())
register('profile-review-welcome-coupon', captureProfileReview)

// Completion ceremony (Phase 3 开盒仪式, 2026-07-31): tap the completion CTA,
// then capture the UnboxingCeremony overlay once the lid has lifted and the
// entry card has risen, but before the 2.4s auto-advance routes onward.
async function captureProfileReviewCeremony() {
  return withBrowserPage(
    { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 },
    async (page) => {
      // motion=reduce fast-forwards the PAGE's own reveal (router param),
      // but the ceremony reads OS-level reduced-motion only, so its lid-lift
      // choreography still plays in the capture browser.
      await page.goto(`${H5_BASE_URL}/#/pages/onboarding/profile-review/index?motion=reduce`, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      })
      await clearAndSeedStorage(page)
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })
      await page.waitForSelector('.profile-review__submit', { timeout: 15000 })
      await page.waitForTimeout(600)
      await page.click('.profile-review__submit')
      // 500ms celebration beat + ceremony choreography (~1.5s) → settled
      // overlay; still ahead of the 3.2s auto-advance (2026-08-18 retune).
      await page.waitForSelector('.unboxing-ceremony__card', { timeout: 10000 })
      await page.waitForTimeout(1600)
      return screenshotViewport(page)
    }
  )
}

// ─── Onboarding 丝滑度 wave visual checks (2026-08-18) ───────────
// The essential-data wizard gates on server-driven nextStep, so the captures
// intercept /api/auth/user and pin nextStep='essential-data' (guard match).
// Motion is intentionally ENABLED (no ?motion=reduce) so the direction-aware
// step exit animation is exercised, not skipped.

async function interceptAuthUserOverrides(page, overrides) {
  // Static fulfill: fetch the mock user once and apply overrides. (Do not call
  // the route fetch method and then fulfill with both a response object and a
  // json body — mixing them does not reliably override the body.)
  let base
  try {
    const res = await fetch(`${H5_BASE_URL}/api/auth/user`)
    if (!res.ok) {
      throw new Error(`auth/user returned ${res.status}`)
    }
    base = await res.json()
  } catch (err) {
    console.error('[screenshot-server] failed to fetch auth/user mock base', err)
    throw err
  }
  const merged = { ...base, ...overrides }
  if (overrides.features) {
    merged.features = { ...(base.features || {}), ...overrides.features }
  }
  await page.route('**/api/auth/user', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(merged),
    })
  )
}

async function interceptAuthNextStep(page, nextStep) {
  return interceptAuthUserOverrides(page, { nextStep })
}

async function captureEssentialData({ captureExitFrame = false } = {}) {
  return withBrowserPage(
    { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 },
    async (page) => {
      await page.goto(`${H5_BASE_URL}/#/pages/onboarding/essential-data/index`, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      })
      await interceptAuthNextStep(page, 'essential-data')
      await clearAndSeedStorage(page)
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })

      // The mock user's displayName prefills the name field, so the CTA is
      // already enabled — no typing needed (Taro H5 renders taro-input-core,
      // which Playwright's fill cannot target).
      await page.waitForSelector('.essential-data__card', { timeout: 15000 })
      await page.waitForSelector('.essential-data__submit:not([disabled])', { timeout: 10000 })
      await page.waitForTimeout(500)
      if (!captureExitFrame) {
        return screenshotViewport(page)
      }

      await page.click('.essential-data__submit')
      // The outgoing card must carry the forward-exit class while the 140ms
      // exit plays — proves the direction-aware animation is live in the
      // compiled CSS, not just present in source.
      await page.waitForFunction(
        () => document.querySelector('.essential-data__card--exit-forward') !== null,
        undefined,
        { timeout: 500 },
      )
      await page.waitForTimeout(60)
      return screenshotViewport(page)
    }
  )
}

async function captureEssentialDataStep2() {
  return withBrowserPage(
    { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 },
    async (page) => {
      await page.goto(`${H5_BASE_URL}/#/pages/onboarding/essential-data/index`, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      })
      await interceptAuthNextStep(page, 'essential-data')
      await clearAndSeedStorage(page)
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })

      await page.waitForSelector('.essential-data__submit:not([disabled])', { timeout: 15000 })
      await page.click('.essential-data__submit')
      // 140ms exit + 300ms entry settle → intent grid fully in.
      await page.waitForSelector('.essential-data__intent-grid', { timeout: 5000 })
      // P4b (2026-09-11): 3×2 compact grid + full-width 随缘 strip below it.
      await page.waitForSelector('.intent-card--strip', { state: 'visible', timeout: 5000 })
      await page.waitForFunction(
        () => document.querySelectorAll('.essential-data__intent-grid .intent-card--compact').length === 6,
        undefined,
        { timeout: 5000 },
      )
      await page.waitForTimeout(500)
      return screenshotViewport(page)
    }
  )
}

async function captureWelcomeBack() {
  return withBrowserPage(
    { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 },
    async (page) => {
      await page.goto(`${H5_BASE_URL}/#/pages/onboarding/welcome-back/index`, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      })
      // extended-data → 已完成 3/4 progress row + admission thumbnail render.
      await interceptAuthNextStep(page, 'extended-data')
      await clearAndSeedStorage(page)
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })

      await page.waitForSelector('.welcome-back__step-card', { timeout: 15000 })
      // Staggered entrances settle before capture.
      await page.waitForTimeout(900)
      return screenshotViewport(page)
    }
  )
}

// ─── Gathering room (集结房间, 2026-08-15) ──────────────────────
// Presence arrives over the mock WS endpoint (/ws on the mock server): after
// USER_JOINED the mock replies ROOM_PRESENCE_STATE with five of the six fixture
// members (the owl is absent), so the header must reach 已到 5/6 before we
// capture. Every member's avatar renders at their own seat — the absent owl
// shows as a muted seat-anchored silhouette (占位剪影) with its held-place
// name card (fixed 2026-09-10: absent members previously rendered no avatar
// at all, so on device every offline/unconfirmed tablemate was a blank seat).
// Avatar art resolves to the approved full-starter composites via the
// CDN-intercept in withBrowserPage (served from apps/mini-program/src/assets).
async function captureGatheringRoom(viewport = V17_VIEWPORT) {
  return withBrowserPage(viewport, async (page) => {
    await page.goto(
      `${H5_BASE_URL}/#/pages/gathering-room/index?groupId=group-screenshot-001&motion=reduce`,
      { waitUntil: 'domcontentloaded', timeout: 60000 }
    )
    await clearAndSeedStorage(page)
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })

    await page.waitForSelector('.gathering-room__action-bar', { state: 'visible', timeout: 15000 })
    // All six seats mount — five live members at full color, the absent owl
    // as a muted silhouette at its own seat.
    await page.waitForFunction(
      () => document.querySelectorAll('.gathering-room-scene__seat').length === 6,
      undefined,
      { timeout: 10000 }
    )
    await page.waitForFunction(
      () => document.querySelectorAll('.gathering-room-scene__seat-body--absent').length === 1,
      undefined,
      { timeout: 10000 }
    )
    // WS presence applied: the floating pill carries the shared countdown
    // clock + full attendance (header strip was removed in the 2026-08-27
    // polish — its absence is part of the gate).
    // Whitespace-tolerant: the count Texts use a non-breaking space.
    await page.waitForFunction(() => {
      const pill = document.querySelector('.gathering-room__pill')
      if (!pill) return false
      if (document.querySelector('.gathering-room__header') || document.querySelector('.gathering-room__header-subtitle')) return false
      if (!pill.querySelector('.segmented-countdown-clock__digits')) return false
      const text = pill.textContent ?? ''
      return /已到\s*5\/6/.test(text) && /已确认\s*2\/6/.test(text)
    }, undefined, { timeout: 15000 })
    // Universal name plates: all six members render a plate, always in the
    // seated hang below the feet (avatars — or the absent silhouette — are at
    // every anchor). The own member's plate carries the 我 chip.
    await page.waitForFunction(
      () => document.querySelectorAll('.gathering-room-scene__name-card').length === 6,
      undefined,
      { timeout: 10000 }
    )
    await page.waitForFunction(
      () => document.querySelectorAll('.gathering-room-scene__name-card--seated').length === 6,
      undefined,
      { timeout: 10000 }
    )
    await page.waitForFunction(
      () => document.querySelectorAll('.gathering-room-scene__me-chip').length === 1,
      undefined,
      { timeout: 10000 }
    )
    // Every rendered avatar (including the absent silhouette) resolved to its
    // approved full-starter composite.
    await page.waitForFunction(() => {
      const bodies = Array.from(document.querySelectorAll('.pixel-avatar-composite__body'))
      return bodies.length === 6 && bodies.every((el) =>
        /full-starter-v2\.[a-f0-9]{12}\.webp/.test(el.getAttribute('src') ?? ''))
    }, undefined, { timeout: 10000 })
    // No avatar fell back to the error/placeholder state.
    await page.waitForFunction(
      () => document.querySelectorAll('.pixel-avatar-composite__asset-warning').length === 0,
      undefined,
      { timeout: 10000 }
    )
    // Give the room art + six composites time to decode via the asset proxy.
    await page.waitForTimeout(2500)

    return screenshotViewport(page)
  })
}

register('gathering-room', captureGatheringRoom)

// Compact-device variant (360×640) — verifies seat anchors hold on short
// viewports (scene is 960rpx max-height with %-anchored seats).
register('gathering-room-compact', () => captureGatheringRoom({
  ...V17_VIEWPORT,
  viewport: { width: 360, height: 640 },
}))
register('profile-review-ceremony', captureProfileReviewCeremony)
register('onboarding-essential-step1', () => captureEssentialData())
register('onboarding-essential-exit', () => captureEssentialData({ captureExitFrame: true }))
register('onboarding-essential-step2', captureEssentialDataStep2)
register('onboarding-welcome-back', captureWelcomeBack)
register('matching-status-puzzle-prelude', captureMatchingStatusPuzzlePrelude)
register('profile-v17', captureProfileV17)
register('discover-alang-v17', captureDiscoverAlangV17)
register('alang-search-v17', captureAlangSearchV17)
register('personal-story-v17', capturePersonalStoryV17)
register('my-image-v17', captureMyImageV17)
register('profile-settings-v17', captureProfileSettingsV17)

// ─── Personality test slider question (2026-09 custom track polish) ───
// Auth override: nextStep 'personality-test' so the page gate keeps us on
// the quiz; /api/assessment/v4/start mocked to a slider question. Stages:
//   neutral  — untouched grey state (hint + neutral badge/thumb/fill)
//   drag     — mid-drag at ~85% (badge tracking, temperature fill, 1.15× thumb)
//   settled  — released at ~85% (spring-settled touched state)
const PERSONALITY_TEST_SLIDER_AUTH = {
  id: 'user-screenshot-001',
  displayName: '悦仔测试',
  nickname: '悦仔测试',
  appMode: 'production',
  archetype: null,
  primaryArchetype: null,
  nextStep: 'personality-test',
  hasCompletedOnboarding: false,
  profileEssentialComplete: true,
  profileExtendedComplete: false,
  activeAssessmentSessionId: null,
  paymentsEnabled: true,
  pendingReferralCode: '',
  features: {},
}

const PERSONALITY_TEST_SLIDER_START = {
  sessionId: 'mock-slider-session-001',
  phase: 'testing',
  // Mirrors the production Q_PLAYFUL_SLIDER bank entry (5 semantic buckets,
  // incl. the 12-glyph slider_100 label that stress-tests badge width).
  nextQuestion: {
    id: 'Q_PLAYFUL_SLIDER',
    category: '能量感知',
    scenarioText: '周五下班，终于自由了——',
    questionText: '拖动滑条，找到你现在最接近的感觉',
    questionType: 'slider',
    sliderConfig: { leftLabel: '想一个人待着', rightLabel: '快叫上朋友！' },
    options: [
      { value: 'slider_0', text: '完全想一个人待着' },
      { value: 'slider_25', text: '更偏向自己充电' },
      { value: 'slider_50', text: '看心情，居中就好' },
      { value: 'slider_75', text: '有点想约人出去' },
      { value: 'slider_100', text: '超想热闹一下，快叫上朋友！' },
    ],
  },
  progress: { answered: 4, estimatedRemaining: 6, minQuestions: 8, softMaxQuestions: 12, hardMaxQuestions: 16 },
  currentMatches: [],
  isComplete: false,
}

async function capturePersonalityTestSlider(stage) {
  return withBrowserPage(V17_VIEWPORT, async (page) => {
    await page.route('**/api/auth/user', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(PERSONALITY_TEST_SLIDER_AUTH),
      }),
    )
    await page.route('**/api/assessment/v4/start', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(PERSONALITY_TEST_SLIDER_START),
      }),
    )
    await page.goto(`${H5_BASE_URL}/#/pages/onboarding/personality-test/index?motion=reduce`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    })
    await clearAndSeedStorage(page)
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })

    await page.waitForSelector('.personality-test__start-btn', { state: 'visible', timeout: 20000 })
    await page.click('.personality-test__start-btn')
    await page.waitForSelector('.answer-area__slider-thumb', { state: 'visible', timeout: 15000 })
    // Let the entrance stagger + track-width measurement settle.
    await page.waitForTimeout(1200)

    if (stage === 'neutral') {
      return screenshotViewport(page)
    }

    // Drag the (H5-rendered) slider thumb from center toward ~85% using CDP
    // touch events — Taro H5 slider only listens to touch, mouse is ignored.
    const sliderBox = await page.locator('.answer-area__slider').boundingBox()
    if (!sliderBox) {
      return screenshotViewport(page)
    }
    const midY = sliderBox.y + sliderBox.height / 2
    const startX = sliderBox.x + sliderBox.width * 0.5
    const endX = sliderBox.x + sliderBox.width * 0.85
    const client = await page.context().newCDPSession(page)
    const touch = (type, x) =>
      client.send('Input.dispatchTouchEvent', {
        type,
        touchPoints: type === 'touchEnd' ? [] : [{ x, y: midY, id: 1 }],
      })
    await touch('touchStart', startX)
    for (let i = 1; i <= 12; i++) {
      await touch('touchMove', startX + ((endX - startX) * i) / 12)
      await page.waitForTimeout(40)
    }
    // Best-effort: the % readout only renders once touched; if the H5 slider
    // ignored the gesture, capture whatever is on screen anyway.
    await page.waitForSelector('.answer-area__slider-live-badge-value', {
      state: 'visible',
      timeout: 4000,
    }).catch(() => {})

    if (stage === 'drag') {
      return screenshotViewport(page)
    }
    await touch('touchEnd')
    await page.waitForTimeout(700)
    return screenshotViewport(page)
  })
}

register('personality-test-slider-neutral', () => capturePersonalityTestSlider('neutral'))
register('personality-test-slider-drag', () => capturePersonalityTestSlider('drag'))
register('personality-test-slider-settled', () => capturePersonalityTestSlider('settled'))

// ─── 2026-09-11 staging UI batch verification captures ─────────────

// H5-only divergence (NOT app source — do not "fix" app code for this): the
// guidance queue's tab-route gate reads `Taro.getCurrentInstance().router.path`,
// which on H5 carries the runtime's `?stamp=XX` query suffix, so
// `isTabPageRoute()` refuses and the queue never fires in the H5 harness.
// WeChat-native paths have no query, so production is unaffected. This patch
// rewrites the gate in the served JS chunk (network-layer only) to strip the
// query before matching — visually equivalent to device behaviour.
async function installGuidanceH5RouteGatePatch(page) {
  await page.route('**/js/common.*.js', async (route) => {
    try {
      const response = await route.fetch()
      const body = await response.text()
      // Minified shape: function fX(e){const t=e.replace(/^\//,"");return Object.values(routes).includes(t)}
      const gatePattern = /(function [A-Za-z_$][\w$]*\(e\)\{const t=e\.replace\(\/\^\\\/\/,""\))(;return Object\.values\([A-Za-z_$][\w$]*\)\.includes\(t\)\})/
      if (gatePattern.test(body)) {
        const patched = body.replace(gatePattern, '$1.split("?")[0]$2')
        console.log('[screenshot-server] guidance H5 route-gate patch applied')
        await route.fulfill({ response, body: patched })
        return
      }
      await route.fulfill({ response, body })
    } catch (err) {
      console.warn('[screenshot-server] guidance chunk patch failed (fail-open)', err)
      await route.continue()
    }
  })
}

// P6: profile first-visit guidance tip (C4 queue). The mock user lacks
// features.guidanceQueueEnabled, so force it on via the auth intercept and
// stub /api/guidance/** so the seen-write / queue never fail-closed. The tip
// auto-dismisses after a 6s dwell — capture as soon as the card is visible.
async function captureProfileGuidanceTip() {
  return withBrowserPage(V17_VIEWPORT, async (page) => {
    await installGuidanceH5RouteGatePatch(page)
    await page.route('**/api/guidance/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, recorded: true }),
      }),
    )
    await page.goto(`${H5_BASE_URL}/#/pages/profile/index?motion=reduce`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    })
    await interceptAuthUserOverrides(page, {
      nextStep: 'discover',
      features: { guidanceQueueEnabled: true },
    })
    await clearAndSeedStorage(page)
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })

    await waitForContent(page, '.profile-page__identity-stage--entered')
    // The dock + card mount on the queue's first evaluate; capture well
    // inside the 6s dwell window before the auto-dismiss fires.
    await page.waitForSelector('.profile-page__guidance-dock .guidance-tip-card', {
      state: 'visible',
      timeout: 8000,
    })
    await page.waitForTimeout(600)
    return screenshotViewport(page)
  })
}
register('profile-guidance-tip', captureProfileGuidanceTip)

// P9: post-onboarding archetype-holder retake interstitial. Auth intercept:
// primaryArchetype held AND nextStep null (fully past onboarding) → the page
// renders the explicit choice instead of the legacy silent bounce.
async function capturePersonalityTestReturnInterstitial() {
  return withBrowserPage(V17_VIEWPORT, async (page) => {
    await page.goto(`${H5_BASE_URL}/#/pages/onboarding/personality-test/index?motion=reduce`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    })
    await interceptAuthUserOverrides(page, {
      archetype: 'dolphin_calm',
      primaryArchetype: 'dolphin_calm',
      nextStep: null,
    })
    await clearAndSeedStorage(page)
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })

    await page.waitForSelector('.personality-test__return-title', { state: 'visible', timeout: 15000 })
    await page.waitForFunction(() => {
      const title = document.querySelector('.personality-test__return-title')?.textContent ?? ''
      const primary = document.querySelector('.personality-test__return-primary')?.textContent ?? ''
      const secondary = document.querySelector('.personality-test__return-secondary')?.textContent ?? ''
      return title.includes('你已经解锁了氛围命格')
        && primary.includes('查看我的结果')
        && secondary.includes('重新测一次')
    }, undefined, { timeout: 10000 })
    await page.waitForTimeout(800)
    return screenshotViewport(page)
  })
}
register('personality-test-return-interstitial', capturePersonalityTestReturnInterstitial)

// P1/P2: expanded personality-results detail sheet (mascot analysis bubble +
// 氛围画像 bars + 默契搭档 strip). Seeds a completed replay snapshot so the
// page jumps straight to the result stage (no slot animation, no result
// fetch), then intercepts the Xiaoyue analysis call so the hero CTA renders.
const RESULTS_SESSION_SNAPSHOT = {
  sessionId: 'mock-results-session-001',
  phase: 'completed',
  timestamp: Date.now(),
  completedAt: new Date().toISOString(),
  result: {
    primaryArchetype: 'dolphin_calm',
    secondaryArchetype: 'corgi',
    traitScores: { A: 82, O: 64, C: 58, E: 76, X: 42, P: 88 },
    topMatches: [
      { archetype: 'dolphin_calm', score: 92, confidence: 0.9 },
      { archetype: 'corgi', score: 78, confidence: 0.7 },
      { archetype: 'fox', score: 61, confidence: 0.5 },
    ],
    totalQuestionsAnswered: 12,
    archetypeConfidence: 0.9,
    isDecisive: true,
  },
  topArchetypes: [
    { archetype: 'dolphin_calm', score: 92, confidence: 0.9 },
    { archetype: 'corgi', score: 78, confidence: 0.7 },
    { archetype: 'fox', score: 61, confidence: 0.5 },
  ],
  // Replay fast-path: skips the slot animation entirely.
  resultSequenceCompletedAt: new Date().toISOString(),
}

const RESULTS_XIAOYUE_ANALYSIS = {
  headline: '你把气氛调到了刚刚好的温度',
  analysis: '你身上有一种很稳的松弛感——不是冷，也不是热，而是让一桌人都慢慢放松下来的那种温度。你不太抢话，但你接得住别人的话头，也懂得在冷场前递一个台阶。跟你待在一起，人会不自觉地多说一点真心话。',
  socialRole: '氛围稳定器',
  bestScene: '五六个人的深聊小局',
  microAction: '下次聚会，试着先问一个轻一点的问题',
  shareLine: '我是机灵海豚，氛围里的定海神针',
  stateLabel: '松弛在线',
  whyThisFits: '你的稳定感和亲和力都偏高，外向度适中——你不是点燃场子的人，你是让场子一直暖着的人。',
  blendLine: '隐约还有一点社牛柯基的影子，关键时刻你也会主动破冰。',
  expressionTags: ['松弛感', '接得住话', '稳定输出'],
  shareVariants: {
    selfIntro: '我是机灵海豚，负责让一桌人舒服',
    friendCallout: '这个人就是传说中的氛围稳定器',
    socialInvite: '要不要一起来测测你的氛围命格',
  },
  cached: true,
}

async function capturePersonalityResultsDetail() {
  return withBrowserPage(V17_VIEWPORT, async (page) => {
    await page.route('**/api/xiaoyue/analysis', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(RESULTS_XIAOYUE_ANALYSIS),
      }),
    )
    // Safety net only — the replay fast-path never fetches the result.
    await page.route('**/api/assessment/v4/*/result', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          sessionId: RESULTS_SESSION_SNAPSHOT.sessionId,
          completedAt: RESULTS_SESSION_SNAPSHOT.completedAt,
          result: RESULTS_SESSION_SNAPSHOT.result,
          topArchetypes: RESULTS_SESSION_SNAPSHOT.topArchetypes,
        }),
      }),
    )
    await page.goto(`${H5_BASE_URL}/#/pages/onboarding/personality-test/results/index?motion=reduce`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    })
    // Taro H5 getStorageSync only returns values written via Taro.setStorage —
    // the raw localStorage entry must carry the {"data": ...} wrapper or the
    // app reads '' and falls back to the auth user's archetype.
    await page.evaluate((snapshot) => {
      localStorage.clear()
      sessionStorage.clear()
      localStorage.setItem(
        'joyjoin_v4_assessment_session',
        JSON.stringify({ data: JSON.stringify(snapshot) }),
      )
    }, RESULTS_SESSION_SNAPSHOT)
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })

    // Replay fast-path lands on the result stage; the hero CTA (查看悦仔完整
    // 解读) renders once the intercepted analysis resolves.
    await page.waitForSelector('.personality-results__hero-xiaoyue-cta', {
      state: 'visible',
      timeout: 20000,
    })
    await page.waitForTimeout(1000)
    await page.click('.personality-results__hero-xiaoyue-cta')

    await page.waitForSelector('.personality-results__detail-sheet', {
      state: 'visible',
      timeout: 10000,
    })
    // 350ms slide-up + deferred bubble sentence stagger — let it fully settle.
    await page.waitForFunction(() => {
      const sheet = document.querySelector('.personality-results__detail-sheet')
      const traits = document.querySelectorAll('.personality-results__trait-row').length
      const partners = document.querySelectorAll('.personality-results__detail-partner').length
      return Boolean(sheet) && traits === 6 && partners === 3
    }, undefined, { timeout: 10000 })
    await page.waitForTimeout(2000)
    return screenshotViewport(page)
  })
}
register('personality-results-detail', capturePersonalityResultsDetail)


const server = app.listen(PORT, '127.0.0.1', () => {
  console.log(`[screenshot-server] listening on http://localhost:${PORT}`)
  console.log(`[screenshot-server] available URLs:`)
  Array.from(generators.keys()).forEach(k => {
    console.log(`  http://localhost:${PORT}/${k}.png`)
  })
})

process.on('SIGTERM', () => server.close())
process.on('SIGINT', () => server.close())
