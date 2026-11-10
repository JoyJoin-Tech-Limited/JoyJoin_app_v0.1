import express from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { chromium, devices } from 'playwright'
import { registerSocialGenerators } from './screenshot/generators-social.mjs'
import { registerDiscoverAreaGenerators } from './screenshot/generators-discover-area.mjs'
import { registerFlashTeaserGenerators } from './screenshot/generators-flash-teaser.mjs'
import { registerEventFeedbackGenerators } from './screenshot/generators-event-feedback.mjs'
import { registerEventDetailGenerators } from './screenshot/generators-event-detail.mjs'
import { registerCheckoutConversionGenerators } from './screenshot/generators-checkout-conversion.mjs'
import { registerSubtractionPoolRegistrationGenerators } from './screenshot/generators-subtraction-pool-registration.mjs'

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

// ─── Feature generator modules (extracted 2026-09-30) ─────────────
// Helpers are function declarations (hoisted), so the factories can run here
// even though interceptAuthUserOverrides is defined further down.
const generatorCtx = {
  register,
  withBrowserPage,
  clearAndSeedStorage,
  waitForContent,
  screenshotPage,
  screenshotViewport,
  interceptAuthUserOverrides,
  DEFAULT_VIEWPORT,
  V17_VIEWPORT,
  H5_BASE_URL,
}
registerSocialGenerators(generatorCtx)
registerDiscoverAreaGenerators(generatorCtx)
registerFlashTeaserGenerators(generatorCtx)
registerEventFeedbackGenerators(generatorCtx)
registerEventDetailGenerators(generatorCtx)
registerCheckoutConversionGenerators(generatorCtx)
registerSubtractionPoolRegistrationGenerators(generatorCtx)

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
    // Capture the matched card: it is the densest state (status, absolute
    // date/time, countdown, assigned table, price) and the one users see
    // right after 排桌完成.
    await page.getByRole('tab', { name: '进行中' }).click()
    await page.waitForFunction(() => {
      const titles = Array.from(document.querySelectorAll('.footprint-oracle-card__title'))
      return titles.some((title) => title.textContent?.includes('微醺夜话'))
    }, undefined, { timeout: 10000 })
    await page.waitForFunction(() => {
      const images = Array.from(document.querySelectorAll('.footprint-oracle-card__type-corner img'))
      return images.length > 0 && images.every((image) => image.complete)
    }, undefined, { timeout: 10000 })
    await page.waitForTimeout(1500)
    return screenshotPage(page)
  })
}

async function captureEventsTerminal() {
  return withBrowserPage(DEFAULT_VIEWPORT, async (page) => {
    await page.goto(`${H5_BASE_URL}/#/pages/events/index`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    })
    await clearAndSeedStorage(page)
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.waitForSelector('.events-page__list', { timeout: 10000 })
    await page.getByRole('tab', { name: '已结束' }).click()
    await page.waitForSelector('.footprint-oracle-card--terminal', { timeout: 10000 })
    await page.waitForTimeout(1200)
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

// Wave A F3 fixture (2026-10-23): explicit badge-ledger seeds. The mock user
// has eventsJoined=4 → unlocked badge keys are firstEvent + streak3.
// Taro H5 storage entries carry the {"data": ...} wrapper (same convention as
// the assessment-session seed below) or getStorageSync reads ''.
const PROFILE_BADGE_LEDGER_KEY = 'joyjoin_profile_badges_seen:user-screenshot-001'
const PROFILE_BADGES_ALL_UNLOCKED = { data: ['firstEvent', 'streak3'] }
const PROFILE_BADGES_STREAK_FRESH = { data: ['firstEvent'] }

async function captureProfileV17() {
  return withBrowserPage(V17_VIEWPORT, async (page) => {
    await page.goto(`${H5_BASE_URL}/#/pages/profile/index?motion=reduce`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    })
    // Settled baseline: every unlocked badge already in the ledger → no
    // just-unlocked ring, no auto-expand, no poster glow.
    await clearAndSeedStorage(page, {
      [PROFILE_BADGE_LEDGER_KEY]: PROFILE_BADGES_ALL_UNLOCKED,
    })
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })

    await waitForContent(page, '.profile-page__identity-stage--entered')
    // The stage shell enters before its scene/content reveal deadline (1.5s).
    // Waiting only for the shell can capture a structurally valid but blank card.
    await page.waitForSelector('.identity-stage__viewport--revealed', { state: 'visible', timeout: 5000 })
    await page.waitForFunction(() => {
      const stage = document.querySelector('.profile-page__identity-stage')
      const images = Array.from(stage?.querySelectorAll('img') ?? [])
      const avatar = stage?.querySelector('.pixel-avatar-composite__body img')
      return Boolean(avatar?.complete) && images.every((image) => image.complete)
    }, undefined, { timeout: 10000 })
    await page.waitForSelector('.profile-page__story-card', { state: 'visible', timeout: 10000 })
    await page.waitForFunction(() => {
      const growth = document.querySelector('.profile-page__growth-value')?.textContent?.trim()
      const stats = Array.from(document.querySelectorAll('.profile-page__data-band-value'))
        .map((element) => element.textContent?.trim())
      const storyCta = document.querySelector('.profile-page__story-cta')?.textContent?.trim()
      return growth === '260' && stats.includes('4') && stats.includes('11') && storyCta?.endsWith('进入我的故事')
    }, undefined, { timeout: 10000 })
    // Wave A render guards (2026-10-23): the mock fixtures are designed so the
    // streak continuation line (lastActivityDate in the previous ISO week) and
    // the next-event row (matched event later today) both render. Asserting
    // them here catches fixture drift before a human F3 pass does.
    await page.waitForFunction(() => {
      const streakHint = document.querySelector('.profile-page__streak-hint')?.textContent?.trim() ?? ''
      const nextEvent = document.querySelector('.profile-page__next-event-text')?.textContent?.trim() ?? ''
      return streakHint.includes('续到') && nextEvent.includes('今天')
    }, undefined, { timeout: 10000 })

    return screenshotViewport(page)
  })
}

// Wave A F3 state: fresh-badge capture. The ledger knows firstEvent only, so
// streak3 (unlocked at eventsJoined=4 ≥ threshold 3) diffs as newly unlocked →
// just-unlocked ring + one-shot wall auto-expand + poster-pill glow latch +
// 「新徽章到手，存下这张卡」 copy.
async function captureProfileFreshBadge() {
  return withBrowserPage(V17_VIEWPORT, async (page) => {
    await page.goto(`${H5_BASE_URL}/#/pages/profile/index?motion=reduce`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    })
    await clearAndSeedStorage(page, {
      [PROFILE_BADGE_LEDGER_KEY]: PROFILE_BADGES_STREAK_FRESH,
    })
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })

    await waitForContent(page, '.profile-page__identity-stage--entered')
    // Auto-expand opens the wall on the fresh diff; the ring marks streak3 and
    // the poster pill latches its glow + new-badge copy.
    await page.waitForSelector('.profile-page__milestone--just-unlocked', {
      state: 'visible',
      timeout: 10000,
    })
    await page.waitForFunction(() => {
      const posterPill = document.querySelector('.profile-page__poster-pill')
      const posterText = document.querySelector('.profile-page__poster-pill-text')?.textContent?.trim() ?? ''
      return Boolean(posterPill?.classList.contains('profile-page__poster-pill--glow'))
        && posterText.includes('新徽章到手')
    }, undefined, { timeout: 10000 })
    // Let the just-unlocked ring animation settle into its visible state.
    await page.waitForTimeout(800)

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

async function captureDiscoverOracleCards() {
  return withBrowserPage(DEFAULT_VIEWPORT, async (page) => {
    await page.goto(`${H5_BASE_URL}/#/pages/discover/index?motion=reduce`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    })
    await clearAndSeedStorage(page)
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })

    await waitForContent(page, '.oracle-card')
    const card = page.locator('.oracle-card').first()
    await card.scrollIntoViewIfNeeded()
    await page.waitForTimeout(800)

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
register('events-footprint-oracle-card', captureEventsPage)
register('events-footprint-terminal', captureEventsTerminal)
register('discover-oracle-cards', captureDiscoverOracleCards)
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

// Inline completion (2026-10-30): capture the unified entry card during its
// 720ms confirmed state, before server-nextStep navigation replaces the page.
async function captureProfileReviewCompletion() {
  return withBrowserPage(
    { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 },
    async (page) => {
      await page.goto(`${H5_BASE_URL}/#/pages/onboarding/profile-review/index`, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      })
      await clearAndSeedStorage(page)
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })
      await page.waitForSelector('.profile-review__submit', { timeout: 15000 })
      await page.waitForTimeout(1500)
      await page.click('.profile-review__submit')
      await page.waitForSelector('.profile-review__completion', { timeout: 10000 })
      await page.waitForTimeout(250)
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
// members (the owl is absent), so the header must reach 在房间 5/6 before we
// capture. "在房间" is live WS presence only; confirmed/late are persistent
// attendance facts and must never be folded into that counter. Every member's
// avatar renders at their own seat — the absent owl shows as a muted
// seat-anchored silhouette (占位剪影) with its held-place name card (fixed
// 2026-09-10: absent members previously rendered no avatar at all, so on
// device every offline/unconfirmed tablemate was a blank seat).
// Avatar art resolves to the approved full-starter composites via the
// CDN-intercept in withBrowserPage (served from apps/mini-program/src/assets).
async function captureGatheringRoom(
  viewport = V17_VIEWPORT,
  {
    forceRoomArtFailure = false,
    longNickname = false,
    ended = false,
    openRearPoke = false,
    disconnectPoke = false,
    timing = 'default',
    ownStatus = 'confirmed',
    timeTbd = false,
    venueTbd = false,
    disconnectRoom = false,
    allConfirmed = false,
  } = {}
) {
  return withBrowserPage(viewport, async (page) => {
    let compactInteractions = false
    const disconnectedPokeEvents = []
    if (disconnectPoke || disconnectRoom) {
      await page.addInitScript(() => {
        const NativeWebSocket = window.WebSocket
        window.__gatheringRoomSockets = []
        window.__gatheringRoomDisconnect = false
        window.WebSocket = class extends NativeWebSocket {
          constructor(...args) {
            if (window.__gatheringRoomDisconnect) throw new Error('Screenshot-forced disconnect')
            super(...args)
            window.__gatheringRoomSockets.push(this)
          }
        }
      })
      page.on('request', (request) => {
        if (request.url().includes('/api/analytics/gathering-room')
          && request.postData()?.includes('"room_poke"')) {
          disconnectedPokeEvents.push(request.postData())
        }
      })
    }
    // Confirmed-own fixture: the original mock still supplies one late member,
    // one absent owl and five WS-present members. Only REST attendance is
    // overridden so the success state is exercised without pretending
    // pending == confirmed.
    await page.route('**/api/pool-groups/*/room-state', async (route) => {
      const response = await route.fetch()
      const roomState = await response.json()
      roomState.members = roomState.members.map((member) => {
        if (member.userId === 'user-screenshot-001') {
          return {
            ...member,
            attendanceStatus: ownStatus,
            ...(longNickname
              ? { displayName: '爱在黄昏散步喜欢看海听现场音乐的超长昵称' }
              : {}),
          }
        }
        return member
      })
      if (allConfirmed) {
        roomState.members = roomState.members.map((member) => ({
          ...member,
          attendanceStatus: member.attendanceStatus === 'late' ? 'late' : 'confirmed',
        }))
      }
      if (openRearPoke && roomState.members.length >= 2) {
        // Put a present tablemate on the rear seat so its below-bubble path
        // can be exercised without long-pressing the viewer's own avatar.
        ;[roomState.members[0], roomState.members[1]] = [roomState.members[1], roomState.members[0]]
      }
      roomState.confirmedCount = roomState.members.filter(
        (member) => member.attendanceStatus === 'confirmed'
          || member.attendanceStatus === 'late').length
      roomState.arrivingLateCount = roomState.members.filter(
        (member) => member.attendanceStatus === 'late').length
      if (ended || timing === 'ended') {
        roomState.eventPhase = 'ended'
        roomState.eventDateTime = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
      } else if (timing === 'live') {
        roomState.eventPhase = 'live'
        roomState.eventDateTime = new Date(Date.now() - 30 * 60 * 1000).toISOString()
      } else if (timing === 'today') {
        roomState.eventPhase = 'upcoming'
        roomState.eventDateTime = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
      }
      if (timeTbd) {
        roomState.eventPhase = 'upcoming'
        roomState.eventDateTime = null
      }
      if (venueTbd) roomState.venue = null
      await route.fulfill({ response, json: roomState })
    })
    if (forceRoomArtFailure) {
      await page.route('**/pages/gathering-room/assets/room-composite-v2.webp', (route) => route.abort())
    }

    await page.goto(
      `${H5_BASE_URL}/#/pages/gathering-room/index?groupId=group-screenshot-001&motion=reduce`,
      { waitUntil: 'domcontentloaded', timeout: 60000 }
    )
    await clearAndSeedStorage(page)
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })
    if (disconnectRoom) {
      await page.waitForFunction(() => (window.__gatheringRoomSockets?.length ?? 0) > 0, undefined, { timeout: 10000 })
      // Cache the first real presence snapshot before cutting the socket.
      await page.waitForFunction(
        () => document.querySelector('.gathering-room__room-summary')?.textContent?.includes('5 人在房间'),
        undefined,
        { timeout: 10000 }
      )
      const closed = await page.evaluate(() => {
        const sockets = window.__gatheringRoomSockets ?? []
        window.__gatheringRoomDisconnect = true
        sockets.forEach((socket) => { try { socket.close() } catch { /* already closed */ } })
        return sockets.length
      })
      if (!closed) throw new Error('Disconnected-room fixture did not capture a real WebSocket')
      await page.waitForTimeout(300)
    }
    const expectedConfirmedCount = ended
      ? 3
      : allConfirmed
        ? 6
        : ownStatus === 'confirmed' || ownStatus === 'late' ? 3 : 2
    const expectedAbsentCount = allConfirmed ? 0 : 1
    const expectedOwnStatusLabel = ended
      ? '已确认出席'
      : ownStatus === 'pending'
        ? '待确认'
        : ownStatus === 'late'
          ? '已登记会晚到'
          : ownStatus === 'absent' ? '已告知无法出席' : '已确认出席'

    await page.waitForSelector('.gathering-room__action-bar', { state: 'visible', timeout: 15000 })
    await page.waitForSelector('.gathering-room__appointment-status', { state: 'visible', timeout: 10000 })
    await page.waitForSelector(
      '.gathering-room-scene__name-card, .gathering-room-scene__compact-roster-item',
      { state: 'visible', timeout: 10000 }
    )
    compactInteractions = await page.locator('.gathering-room-scene__compact-layer').count() > 0
    if (ended || timing === 'ended') {
      await page.waitForSelector('.gathering-room__memory-btn', { state: 'visible', timeout: 10000 })
      await page.waitForFunction(() => {
        const summary = document.querySelector('.gathering-room__room-summary')
        const status = document.querySelector('.gathering-room__appointment-status')
        return Boolean(summary?.textContent?.includes('活动已结束 · 这一桌已定格'))
          && Boolean(status?.textContent?.includes('已确认出席'))
          && !document.querySelector('.gathering-room__fact-meta')?.textContent?.includes('还有')
      }, undefined, { timeout: 10000 })
    } else if (timing === 'today' || timing === 'live') {
      const expected = timing === 'today' ? '还有' : '活动进行中'
      await page.waitForFunction((copy) =>
        document.querySelector('.gathering-room__fact-meta')?.textContent?.includes(copy),
      expected, { timeout: 10000 })
    }
    await page.waitForFunction(({ confirmedCount, disconnected, ended }) => {
      const summary = document.querySelector('.gathering-room__room-summary')
      if (!summary) return false
      const text = summary.textContent ?? ''
      if (ended) {
        return text.includes('活动已结束 · 这一桌已定格')
          && !/5\s*人在房间/.test(text)
          && !/已到/.test(text)
          && !/周三见/.test(text)
      }
      return text.includes(`这桌已确认 ${confirmedCount}/6`)
        && (disconnected ? text.includes('房间连接已断开') && !/5\s*人在房间/.test(text) : /5\s*人在房间/.test(text))
        && !/已到/.test(text)
        && !/周三见/.test(text)
    }, {
      confirmedCount: expectedConfirmedCount,
      disconnected: disconnectRoom,
      ended: ended || timing === 'ended',
    }, { timeout: 15000 })
    await page.waitForFunction((expected) => {
      const compact = expected.compact
      const cards = document.querySelectorAll(compact
        ? '.gathering-room-scene__compact-roster-item'
        : '.gathering-room-scene__name-card')
      const placedCards = document.querySelectorAll(
        '.gathering-room-scene__name-card--above,' +
        '.gathering-room-scene__name-card--left,' +
        '.gathering-room-scene__name-card--right,' +
        '.gathering-room-scene__name-card--below')
      const ownMarkerCount = compact
        ? document.querySelectorAll('.gathering-room-scene__compact-roster-own').length
        : document.querySelectorAll('.gathering-room-scene__me-chip').length
      const ownStatusText = document.querySelector('.gathering-room__appointment-status')?.textContent ?? ''
      const timeText = document.querySelector('.gathering-room__fact-time')?.textContent ?? ''
      const timeMetaText = document.querySelector('.gathering-room__fact-meta')?.textContent ?? ''
      const venueText = document.querySelector('.gathering-room__fact-venue')?.textContent ?? ''
      const addressText = document.querySelector('.gathering-room__fact-address')?.textContent ?? ''
      const actionText = document.querySelector('.gathering-room__appointment-actions')?.textContent ?? ''
      const celebrationText = document.querySelector('.gathering-room-scene__celebration')?.textContent ?? ''
      return document.querySelectorAll('.gathering-room-scene__seat').length === 6
        && cards.length === 6
        && (compact || placedCards.length === 6)
        && document.querySelectorAll('.gathering-room-scene__seat-body--absent').length === expected.absentCount
        && ownMarkerCount === 1
        && document.querySelectorAll('.gathering-room__confirm-btn').length === expected.confirmCtaCount
        && ownStatusText.includes(expected.ownStatusLabel)
        && (!expected.timeTbd || (timeText.includes('时间待定') && timeMetaText.includes('时间确定后在这里更新')))
        && (!expected.venueTbd || (venueText.includes('地点待定')
          && addressText.includes('地点确定后在这里更新') && !actionText.includes('复制地址')))
        && (!expected.allConfirmed || celebrationText.includes('这桌齐了'))
        && document.querySelectorAll('.gathering-room__pill').length === 0
        && document.querySelectorAll('.gathering-room-scene__name-card--seated').length === 0
    }, {
      compact: compactInteractions,
      absentCount: expectedAbsentCount,
      confirmCtaCount: ownStatus === 'pending' && !ended ? 1 : 0,
      ownStatusLabel: expectedOwnStatusLabel,
      timeTbd,
      venueTbd,
      allConfirmed,
    }, { timeout: 10000 })
    await page.waitForFunction(() => {
      const bodies = Array.from(document.querySelectorAll('.pixel-avatar-composite__body'))
      return bodies.length === 6 && bodies.every((el) =>
        /full-starter-v2\.[a-f0-9]{12}\.webp/.test(el.getAttribute('src') ?? ''))
        && document.querySelectorAll('.pixel-avatar-composite__asset-warning').length === 0
    }, undefined, { timeout: 10000 })

    if (forceRoomArtFailure) {
      await page.waitForFunction(() => {
        const fallback = document.querySelector('.gathering-room-scene__layer--fallback-room')
        const scene = document.querySelector('.gathering-room-scene')
        return fallback && scene
          && getComputedStyle(fallback).opacity === '1'
          && getComputedStyle(scene).visibility === 'visible'
      }, undefined, { timeout: 10000 })
    } else {
      // A SPA-fallback HTML response is not art: require a decoded bitmap and
      // the visible composite layer, not merely a 200 response or an <img> node.
      await page.waitForFunction(() => {
        const visibleDecoded = (selector) => {
          const layer = document.querySelector(selector)
          if (!layer || getComputedStyle(layer).opacity !== '1') return false
          const image = layer.tagName === 'IMG'
            ? layer
            : layer.querySelector('img') ?? layer.shadowRoot?.querySelector('img')
          return Boolean(image?.complete && image.naturalWidth > 0)
        }
        return visibleDecoded('.gathering-room-scene__layer--composite')
          && visibleDecoded('.gathering-room-scene__layer--table-overlay')
      }, undefined, { timeout: 15000 })
    }

    await page.waitForTimeout(1200)
    const geometry = await page.evaluate(({ expectTableOverlay, compactInteractions, expectCompactRoster }) => {
      const toRect = (element) => {
        const rect = element.getBoundingClientRect()
        return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height }
      }
      const overlapArea = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
        * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))
      const viewportClip = (rect) => Math.max(0, -rect.left) + Math.max(0, -rect.top)
        + Math.max(0, rect.right - innerWidth) + Math.max(0, rect.bottom - innerHeight)
      const scene = document.querySelector('.gathering-room-scene')
      const status = document.querySelector('.gathering-room__status-stack')
      const cards = compactInteractions
        ? []
        : Array.from(document.querySelectorAll('.gathering-room-scene__name-card')).map(toRect)
      const rosterItems = expectCompactRoster
        ? Array.from(document.querySelectorAll('.gathering-room-scene__compact-roster-item'))
        : []
      const cardPairs = []
      for (let i = 0; i < cards.length; i += 1) {
        for (let j = i + 1; j < cards.length; j += 1) {
          const area = overlapArea(cards[i], cards[j])
          if (area !== 0) cardPairs.push({ i, j, area })
        }
      }
      const sceneRect = toRect(scene)
      const statusRect = toRect(status)
      const sceneScale = sceneRect.width / 750
      const factTime = document.querySelector('.gathering-room__fact-time')
      const factTimeFontRpx = factTime
        ? parseFloat(getComputedStyle(factTime).fontSize) / (innerWidth / 750)
        : 0
      const cardEdges = cards.map((rect) => ({
        left: (rect.left - sceneRect.left) / sceneScale,
        right: (sceneRect.right - rect.right) / sceneScale,
        top: (rect.top - sceneRect.top) / sceneScale,
        bottom: (sceneRect.bottom - rect.bottom) / sceneScale,
      }))
      const cardEdgeRpx = cardEdges.map((edges) => Math.min(edges.left, edges.right, edges.top, edges.bottom))
      const rpxScale = innerWidth / 750
      const compactRoster = {
        count: rosterItems.length,
        minTargetHeightRpx: Math.min(Infinity, ...rosterItems.map((item) => item.getBoundingClientRect().height / rpxScale)),
        minNameFontRpx: Math.min(Infinity, ...rosterItems.map((item) => {
          const name = item.querySelector('.gathering-room-scene__compact-roster-name')
          return name ? parseFloat(getComputedStyle(name).fontSize) / rpxScale : 0
        })),
        clipped: rosterItems.map((item, index) => ({ index, pixels: viewportClip(item.getBoundingClientRect()) }))
          .filter((item) => item.pixels !== 0),
      }
      const overlay = expectTableOverlay
        ? document.querySelector('.gathering-room-scene__layer--table-overlay')
        : null
      const overlayRect = overlay ? toRect(overlay) : null
      const nameCardOpaqueTableOverlaps = []
      const overlayImage = overlay
        ? (overlay.tagName === 'IMG'
          ? overlay
          : overlay.querySelector('img') ?? overlay.shadowRoot?.querySelector('img'))
        : null
      if (overlayImage && overlayRect && cards.length > 0) {
        const canvas = document.createElement('canvas')
        canvas.width = overlayImage.naturalWidth
        canvas.height = overlayImage.naturalHeight
        const context = canvas.getContext('2d', { willReadFrequently: true })
        context.drawImage(overlayImage, 0, 0)
        cards.forEach((card, index) => {
          const left = Math.max(card.left, overlayRect.left)
          const top = Math.max(card.top, overlayRect.top)
          const right = Math.min(card.right, overlayRect.right)
          const bottom = Math.min(card.bottom, overlayRect.bottom)
          if (right <= left || bottom <= top) return
          const x = Math.max(0, Math.floor((left - overlayRect.left) * canvas.width / overlayRect.width))
          const y = Math.max(0, Math.floor((top - overlayRect.top) * canvas.height / overlayRect.height))
          const width = Math.min(canvas.width - x, Math.ceil((right - left) * canvas.width / overlayRect.width))
          const height = Math.min(canvas.height - y, Math.ceil((bottom - top) * canvas.height / overlayRect.height))
          if (width <= 0 || height <= 0) return
          const pixels = context.getImageData(x, y, width, height).data
          let opaquePixels = 0
          for (let offset = 3; offset < pixels.length; offset += 4) {
            if (pixels[offset] > 0) opaquePixels += 1
          }
          if (opaquePixels > 0) nameCardOpaqueTableOverlaps.push({ index, opaquePixels })
        })
      }
      const seat0 = document.querySelector('.gathering-room-scene__seat')
      const seat0Body = seat0.querySelector('.gathering-room-scene__seat-body')
      const seat0BodyRect = toRect(seat0Body)
      const cardLayer = document.querySelector('.gathering-room-scene__name-card-layer')
      return {
        sceneRatio: sceneRect.width / sceneRect.height,
        expectedRatio: 750 / 960,
        ratioError: Math.abs(sceneRect.width / sceneRect.height - 750 / 960),
        cardPairs,
        clippedCards: cards.map((rect, index) => ({ index, pixels: viewportClip(rect) })).filter((item) => item.pixels !== 0),
        statusOverlaps: cards.map((rect, index) => ({ index, area: overlapArea(statusRect, rect) })).filter((item) => item.area !== 0),
        minCardEdgeRpx: Math.min(...cardEdgeRpx),
        factTimeFontRpx,
        cardEdgeRpx,
        cardEdges,
        compactRoster,
        nameCardOpaqueTableOverlaps,
        tableOverlayZ: overlay ? Number(getComputedStyle(overlay).zIndex) : null,
        seat0Z: Number(getComputedStyle(seat0).zIndex),
        cardLayerZ: cardLayer ? Number(getComputedStyle(cardLayer).zIndex) : null,
        compactLayerZ: compactInteractions
          ? Number(getComputedStyle(document.querySelector('.gathering-room-scene__compact-layer')).zIndex)
          : null,
        seat0BodyBottomPx: seat0BodyRect.bottom,
        tableOverlayTopPx: overlayRect?.top ?? null,
        seat0TableOverlapPx: overlayRect
          ? Math.max(0, seat0BodyRect.bottom - Math.max(seat0BodyRect.top, overlayRect.top))
          : null,
        sceneVisibility: getComputedStyle(scene).visibility,
      }
    }, {
      expectTableOverlay: !forceRoomArtFailure,
      compactInteractions,
      expectCompactRoster: compactInteractions && !openRearPoke,
    })
    if (geometry.ratioError > 0.002 || geometry.cardPairs.length > 0
      || geometry.clippedCards.length > 0 || geometry.statusOverlaps.length > 0
      || geometry.nameCardOpaqueTableOverlaps.length > 0
      || geometry.factTimeFontRpx < 35.5 || geometry.seat0Z !== 49
      || (!compactInteractions && (geometry.minCardEdgeRpx < 15.5 || geometry.cardLayerZ !== 90))
      || (compactInteractions && geometry.compactLayerZ !== 95)
      || (compactInteractions && !openRearPoke && (
        geometry.compactRoster.count !== 6
        || geometry.compactRoster.minTargetHeightRpx < 100
        || geometry.compactRoster.minNameFontRpx < 30
        || geometry.compactRoster.clipped.length > 0
      ))
      || geometry.sceneVisibility !== 'visible'
      || (!forceRoomArtFailure && (
        geometry.tableOverlayZ !== 52 || geometry.seat0TableOverlapPx <= 0
      ))) {
      throw new Error(`Gathering-room rendered geometry failed: ${JSON.stringify(geometry)}`)
    }

    if (openRearPoke) {
      const rearInteraction = compactInteractions
        ? page.locator('.gathering-room-scene__compact-roster-item').first()
        : page.locator('.gathering-room-scene__seat').first()
          .locator('.gathering-room-scene__seat-body')
      const rect = await rearInteraction.boundingBox()
      if (!rect) throw new Error('Rear interaction target has no rendered bounds')
      await rearInteraction.evaluate((element) => {
        element.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, cancelable: true }))
      })
      try {
        await page.waitForSelector(
          compactInteractions
            ? '.gathering-room-scene__compact-poke-panel'
            : '.gathering-room-scene__quick-poke',
          { state: 'visible', timeout: 5000 }
        )
        if (compactInteractions) {
          await page.waitForFunction(() => {
            const actions = Array.from(document.querySelectorAll('.gathering-room-scene__compact-poke-action'))
            const scale = innerWidth / 750
            return actions.length === 4 && !document.querySelector('.tablemate-sheet')
              && actions.every((action) => {
                const text = action.querySelector('.gathering-room-scene__compact-poke-action-text')
                return action.getBoundingClientRect().height / scale >= 100
                  && text && parseFloat(getComputedStyle(text).fontSize) / scale >= 30
              })
          }, undefined, { timeout: 5000 })
        } else {
          const bubbleClass = await page.locator('.gathering-room-scene__quick-poke').getAttribute('class')
          if (!bubbleClass?.includes('gathering-room-scene__quick-poke--below')) {
            throw new Error(`Rear quick-poke opened with wrong placement: ${bubbleClass ?? 'none'}`)
          }
        }
        if (!compactInteractions) await page.waitForFunction(() => {
          const bubble = document.querySelector('.gathering-room-scene__quick-poke--below')
          const scene = document.querySelector('.gathering-room-scene')
          if (!bubble || !scene || document.querySelector('.tablemate-sheet')) return false
          const bubbleRect = bubble.getBoundingClientRect()
          const sceneRect = scene.getBoundingClientRect()
          const scale = sceneRect.width / 750
          const marginRpx = Math.min(
            bubbleRect.left - sceneRect.left,
            sceneRect.right - bubbleRect.right,
            bubbleRect.top - sceneRect.top,
            sceneRect.bottom - bubbleRect.bottom,
          ) / scale
          return marginRpx >= 15.5
        }, undefined, { timeout: 5000 })
        if (disconnectPoke) {
          const closedSockets = await page.evaluate(() => {
            const sockets = window.__gatheringRoomSockets ?? []
            window.__gatheringRoomDisconnect = true
            sockets.forEach((socket) => socket.close())
            return sockets.length
          })
          if (closedSockets === 0) throw new Error('No real room WebSocket was captured for disconnect test')
          await page.waitForFunction(() =>
            document.body.textContent?.includes('房间连接已断开'), undefined, { timeout: 5000 })
          const remainingActionCount = await page.locator(
            compactInteractions
              ? '.gathering-room-scene__compact-poke-action'
              : '.gathering-room-scene__quick-poke-chip'
          ).count()
          const successCopy = await page.locator('body').evaluate((body) =>
            (body.textContent?.includes('招呼已发出') ?? false)
            || (body.textContent?.includes('招呼已经发出啦') ?? false))
          if (remainingActionCount !== 0) {
            throw new Error(`Disconnected poke left ${remainingActionCount} live actions visible`)
          }
          if (successCopy || disconnectedPokeEvents.length !== 0) {
            throw new Error(`Disconnected poke produced fake success: ${JSON.stringify({
              successCopy,
              roomPokeEvents: disconnectedPokeEvents.length,
            })}`)
          }
        }
        return await screenshotViewport(page)
      } finally {
        await rearInteraction.evaluate((element) => {
          element.dispatchEvent(new TouchEvent('touchend', { bubbles: true, cancelable: true }))
        })
      }
    }

    return screenshotViewport(page)
  })
}

async function captureGatheringRoomConfirmInteraction(viewport = V17_VIEWPORT) {
  return withBrowserPage({ ...viewport, reducedMotion: 'no-preference' }, async (page) => {
    let confirmSucceeded = false
    await page.route('**/api/pool-groups/*/confirm-attendance', async (route) => {
      confirmSucceeded = true
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, status: 'confirmed' }),
      })
    })
    await page.route('**/api/pool-groups/*/room-state', async (route) => {
      let roomState
      try {
        const response = await route.fetch()
        roomState = await response.json()
      } catch (error) {
        console.warn('[screenshot-server] room-state fixture passthrough:', error.message)
        await route.continue()
        return
      }
      roomState.members = roomState.members.map((member) => {
        if (member.userId !== 'user-screenshot-001') return member
        return { ...member, attendanceStatus: confirmSucceeded ? 'confirmed' : 'pending' }
      })
      roomState.confirmedCount = roomState.members.filter(
        (member) => member.attendanceStatus === 'confirmed' || member.attendanceStatus === 'late'
      ).length
      await route.fulfill({ response, json: roomState })
    })

    await page.goto(
      `${H5_BASE_URL}/#/pages/gathering-room/index?groupId=group-screenshot-001&motion=full`,
      { waitUntil: 'domcontentloaded', timeout: 60000 }
    )
    await clearAndSeedStorage(page)
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.waitForSelector('.gathering-room__confirm-btn', { state: 'visible', timeout: 15000 })
    await page.locator('.gathering-room__confirm-btn').click()
    // The seat pulse is a 480ms flourish layered on the seat body; Playwright's
    // visibility check can race the keyframe (sub-pixel/transform box), so wait
    // for attachment (proof the success signal fired) and let the seat settle.
    await page.waitForSelector(
      '.gathering-room-scene__seat-body--own-confirmation-pulse',
      { state: 'attached', timeout: 6000 }
    )
    await page.waitForFunction(() => {
      const seal = document.querySelector('.gathering-room-scene__confirmed-seal--own-pulse')
      const status = document.querySelector('.gathering-room__appointment-status')
      return Boolean(seal && status?.textContent?.includes('已确认出席'))
        && !document.querySelector('.gathering-room__confirm-btn')
    }, undefined, { timeout: 5000 })
    await page.waitForTimeout(600)
    return screenshotViewport(page)
  })
}

async function captureGatheringRoomAllConfirmedInteraction(viewport = V17_VIEWPORT) {
  return withBrowserPage({ ...viewport, reducedMotion: 'no-preference' }, async (page) => {
    let allConfirmedPersisted = false
    await page.addInitScript(() => {
      const NativeWebSocket = window.WebSocket
      window.__gatheringRoomSockets = []
      window.WebSocket = function (url, protocols) {
        const socket = protocols
          ? new NativeWebSocket(url, protocols)
          : new NativeWebSocket(url)
        window.__gatheringRoomSockets.push(socket)
        return socket
      }
      window.WebSocket.CONNECTING = NativeWebSocket.CONNECTING
      window.WebSocket.OPEN = NativeWebSocket.OPEN
      window.WebSocket.CLOSING = NativeWebSocket.CLOSING
      window.WebSocket.CLOSED = NativeWebSocket.CLOSED
      const nativeSetTimeout = window.setTimeout
      window.setTimeout = (handler, timeout, ...args) =>
        nativeSetTimeout(handler, timeout === 1760 ? 60000 : timeout, ...args)
    })
    await page.route('**/api/pool-groups/*/room-state', async (route) => {
      let roomState
      try {
        const response = await route.fetch()
        roomState = await response.json()
      } catch (error) {
        console.warn('[screenshot-server] room-state fixture passthrough:', error.message)
        await route.continue()
        return
      }
      roomState.members = roomState.members.map((member) => ({
        ...member,
        attendanceStatus: member.userId === 'user-screenshot-006'
          ? 'pending'
          : member.userId === 'user-screenshot-003' ? 'late' : 'confirmed',
      }))
      roomState.confirmedCount = allConfirmedPersisted ? 6 : 5
      roomState.arrivingLateCount = 1
      if (allConfirmedPersisted) {
        roomState.members = roomState.members.map((member) =>
          member.userId === 'user-screenshot-006'
            ? { ...member, attendanceStatus: 'confirmed' }
            : member
        )
      }
      await route.fulfill({ response, json: roomState })
    })

    await page.goto(
      `${H5_BASE_URL}/#/pages/gathering-room/index?groupId=group-screenshot-001&motion=full`,
      { waitUntil: 'domcontentloaded', timeout: 60000 }
    )
    await clearAndSeedStorage(page)
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.waitForSelector('.gathering-room__action-bar', { state: 'visible', timeout: 15000 })
    await page.waitForFunction(() => {
      const summary = document.querySelector('.gathering-room__room-summary')
      return summary?.textContent?.includes('这桌已确认 5/6')
        && (window.__gatheringRoomSockets?.length ?? 0) > 0
    }, undefined, { timeout: 10000 })
    await page.waitForTimeout(750)
    const sent = await page.evaluate(() => {
      const socket = window.__gatheringRoomSockets?.find((candidate) => candidate.readyState === 1)
      if (!socket) return false
      socket.send(JSON.stringify({
        type: 'MOCK_ROOM_ALL_CONFIRMED',
        eventId: 'blindbox-event-screenshot-001',
        userId: 'user-screenshot-006',
        displayName: '小禾',
        data: {},
      }))
      return true
    })
    if (!sent) throw new Error('No live mock room socket for the all-confirmed interaction')
    allConfirmedPersisted = true
    await page.waitForFunction(() => {
      const celebration = document.querySelector('.gathering-room-scene__celebration')
      if (!celebration) return false
      const className = celebration.className || ''
      const card = celebration.querySelector('.gathering-room-scene__celebration-card') ?? celebration
      const style = getComputedStyle(card)
      return celebration.textContent?.includes('这桌齐了')
        && celebration.textContent?.includes('悦仔先偷笑一下，现场见')
        && !className.includes('--static')
        && !className.includes('--leaving')
        && style.animationName !== 'none'
        && Number(style.opacity) >= 0.95
    }, undefined, { timeout: 5000 }).catch((error) => {
      throw new Error(`Live all-confirmed celebration did not animate: ${error.message}`)
    })
    const celebrationImage = await screenshotViewport(page)
    await page.waitForFunction(() => (
      document.querySelector('.gathering-room__room-summary')?.textContent
        ?.includes('这桌已确认 6/6')
    ), undefined, { timeout: 5000 }).catch((error) => {
      throw new Error(`All-confirmed summary did not persist at 6/6: ${error.message}`)
    })
    return celebrationImage
  })
}

async function captureGatheringRoomMemory(viewport = V17_VIEWPORT) {
  return withBrowserPage(viewport, async (page) => {
    await page.route('**/api/pool-groups/*/room-state', async (route) => {
      const response = await route.fetch()
      const roomState = await response.json()
      roomState.eventPhase = 'ended'
      roomState.eventDateTime = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
      await route.fulfill({ response, json: roomState })
    })

    await page.goto(
      `${H5_BASE_URL}/#/pages/gathering-room/memory/index?groupId=group-screenshot-001&motion=reduce`,
      { waitUntil: 'domcontentloaded', timeout: 60000 }
    )
    await clearAndSeedStorage(page)
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })

    await page.waitForSelector('.gathering-room-memory', { state: 'visible', timeout: 15000 })
    await page.waitForSelector('.gathering-room-memory__share', { state: 'visible', timeout: 10000 })
    await page.waitForFunction(() => {
      const root = document.querySelector('.gathering-room-memory')
      const note = document.querySelector('.gathering-room-memory__note')
      const share = document.querySelector('.gathering-room-memory__share')
      const posterCanvas = document.querySelector('.gathering-room-memory__poster-canvas')
      const canvasNode = posterCanvas?.tagName === 'CANVAS'
        ? posterCanvas
        : posterCanvas?.querySelector('canvas')
      const members = document.querySelectorAll('.gathering-room-memory__member')
      const fallbackHeads = document.querySelectorAll(
        '.gathering-room-memory__member-avatar--empty .archetype-head'
      )
      const text = root?.textContent ?? ''
      return Boolean(note && note.textContent?.includes('没有奖励'))
        && Boolean(share) && !share.hasAttribute('disabled')
        && Boolean(canvasNode)
        && members.length === 6
        && fallbackHeads.length === 6
        && text.includes('当前造型')
    }, undefined, { timeout: 10000 })
    await page.waitForTimeout(600)
    return screenshotViewport(page)
  })
}

register('gathering-room', captureGatheringRoom)
register('gathering-room-375x667', () => captureGatheringRoom({
  ...V17_VIEWPORT,
  viewport: { width: 375, height: 667 },
}))
register('gathering-room-320x568', () => captureGatheringRoom({
  ...V17_VIEWPORT,
  viewport: { width: 320, height: 568 },
}))
register('gathering-room-ended', () => captureGatheringRoom(V17_VIEWPORT, { ended: true }))
register('gathering-room-memory', captureGatheringRoomMemory)
register('gathering-room-confirm-interaction', captureGatheringRoomConfirmInteraction)
register('gathering-room-all-confirmed-interaction', captureGatheringRoomAllConfirmedInteraction)
register('gathering-room-compact', () => captureGatheringRoom({
  ...V17_VIEWPORT,
  viewport: { width: 360, height: 640 },
}))
register('gathering-room-long-name', () => captureGatheringRoom({
  ...V17_VIEWPORT,
  viewport: { width: 320, height: 568 },
}, {
  longNickname: true,
}))
register('gathering-room-long-name-360', () => captureGatheringRoom({
  ...V17_VIEWPORT,
  viewport: { width: 360, height: 640 },
}, {
  longNickname: true,
}))
register('gathering-room-long-name-390', () => captureGatheringRoom(V17_VIEWPORT, {
  longNickname: true,
}))
register('gathering-room-art-fallback', () => captureGatheringRoom(V17_VIEWPORT, {
  forceRoomArtFailure: true,
}))
register('gathering-room-poke', () => captureGatheringRoom({
  ...V17_VIEWPORT,
  viewport: { width: 320, height: 568 },
}, {
  openRearPoke: true,
}))
register('gathering-room-disconnected-poke', () => captureGatheringRoom({
  ...V17_VIEWPORT,
  viewport: { width: 320, height: 568 },
}, {
  openRearPoke: true,
  disconnectPoke: true,
}))
register('gathering-room-today', () => captureGatheringRoom(V17_VIEWPORT, { timing: 'today' }))
register('gathering-room-live', () => captureGatheringRoom(V17_VIEWPORT, { timing: 'live' }))
register('gathering-room-pending', () => captureGatheringRoom(V17_VIEWPORT, { ownStatus: 'pending' }))
register('gathering-room-late', () => captureGatheringRoom(V17_VIEWPORT, { ownStatus: 'late' }))
register('gathering-room-absent', () => captureGatheringRoom(V17_VIEWPORT, { ownStatus: 'absent' }))
register('gathering-room-tbd', () => captureGatheringRoom(V17_VIEWPORT, {
  ownStatus: 'pending', timeTbd: true, venueTbd: true,
}))
register('gathering-room-disconnected', () => captureGatheringRoom(V17_VIEWPORT, {
  ownStatus: 'pending', disconnectRoom: true,
}))
register('gathering-room-all-confirmed', () => captureGatheringRoom(V17_VIEWPORT, { allConfirmed: true }))
register('gathering-room-pending-compact', () => captureGatheringRoom({
  ...V17_VIEWPORT,
  viewport: { width: 320, height: 568 },
}, { ownStatus: 'pending' }))
register('profile-review-completion', captureProfileReviewCompletion)
register('onboarding-essential-step1', () => captureEssentialData())
register('onboarding-essential-exit', () => captureEssentialData({ captureExitFrame: true }))
register('onboarding-essential-step2', captureEssentialDataStep2)
register('onboarding-welcome-back', captureWelcomeBack)
register('matching-status-puzzle-prelude', captureMatchingStatusPuzzlePrelude)
register('profile-v17', captureProfileV17)
register('profile-fresh-badge', captureProfileFreshBadge)
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
    scenarioText: '周五下班，终于自由了',
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
      // P2: 4th match so the 默契搭档 strip overflows and the peek affordance
      // (~44rpx of the 4th card at the trailing edge) is visible in capture.
      { archetype: 'koala', score: 36, confidence: 0.3 },
    ],
    totalQuestionsAnswered: 12,
    archetypeConfidence: 0.9,
    isDecisive: true,
  },
  topArchetypes: [
    { archetype: 'dolphin_calm', score: 92, confidence: 0.9 },
    { archetype: 'corgi', score: 78, confidence: 0.7 },
    { archetype: 'fox', score: 61, confidence: 0.5 },
    { archetype: 'koala', score: 36, confidence: 0.3 },
  ],
  // Replay fast-path: skips the slot animation entirely.
  resultSequenceCompletedAt: new Date().toISOString(),
}

// P5a (2026-09-14): low-signal variant for the retest-prompt capture — the
// verdict rides INSIDE the result object (AssessmentV4FinalResult.signalQuality).
const RESULTS_SESSION_SNAPSHOT_LOW_SIGNAL = {
  ...RESULTS_SESSION_SNAPSHOT,
  sessionId: 'mock-results-session-low-signal',
  result: {
    ...RESULTS_SESSION_SNAPSHOT.result,
    signalQuality: { quality: 'low', score: 40, reasons: ['choice_incoherence'] },
  },
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

async function openPersonalityResultsDetailSheet(page) {
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
    return Boolean(sheet) && traits === 6 && partners === 4
  }, undefined, { timeout: 10000 })
  await page.waitForTimeout(2000)
}

async function capturePersonalityResultsDetail() {
  return withBrowserPage(V17_VIEWPORT, async (page) => {
    await openPersonalityResultsDetailSheet(page)
    return screenshotViewport(page)
  })
}
register('personality-results-detail', capturePersonalityResultsDetail)

// P2 默契搭档 strip capture: same sheet, scrolled so the partner cards
// (archetype head art + 4th-card peek at the trailing edge) sit in frame.
async function capturePersonalityResultsDetailPartners() {
  return withBrowserPage(V17_VIEWPORT, async (page) => {
    await openPersonalityResultsDetailSheet(page)
    await page.evaluate(() => {
      const strip = document.querySelector('.personality-results__detail-partner-scroll')
      strip?.scrollIntoView({ block: 'center', behavior: 'instant' })
    })
    await page.waitForTimeout(600)
    return screenshotViewport(page)
  })
}
register('personality-results-detail-partners', capturePersonalityResultsDetailPartners)

// P5a retest-prompt capture (2026-09-14): seeds the low-signal snapshot on the
// replay fast-path so the quiet 「悦仔有点拿不准你的风格」 banner renders on the
// FinalStage surface, then scrolls it into frame (it sits just above the
// bottom CTA stack, outside the default viewport).
async function capturePersonalityResultsSignalRetest() {
  return withBrowserPage(V17_VIEWPORT, async (page) => {
    await page.route('**/api/xiaoyue/analysis', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(RESULTS_XIAOYUE_ANALYSIS),
      }),
    )
    await page.route('**/api/assessment/v4/*/result', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          sessionId: RESULTS_SESSION_SNAPSHOT_LOW_SIGNAL.sessionId,
          completedAt: RESULTS_SESSION_SNAPSHOT_LOW_SIGNAL.completedAt,
          result: RESULTS_SESSION_SNAPSHOT_LOW_SIGNAL.result,
          topArchetypes: RESULTS_SESSION_SNAPSHOT_LOW_SIGNAL.topArchetypes,
        }),
      }),
    )
    await page.goto(`${H5_BASE_URL}/#/pages/onboarding/personality-test/results/index?motion=reduce`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    })
    // Taro H5 getStorageSync requires the {"data": ...} wrapper — see the
    // detail-sheet generator above.
    await page.evaluate((snapshot) => {
      localStorage.clear()
      sessionStorage.clear()
      localStorage.setItem(
        'joyjoin_v4_assessment_session',
        JSON.stringify({ data: JSON.stringify(snapshot) }),
      )
    }, RESULTS_SESSION_SNAPSHOT_LOW_SIGNAL)
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })

    await page.waitForSelector('.personality-results__signal-retest', {
      state: 'visible',
      timeout: 20000,
    })
    await page.waitForTimeout(600)
    await page.evaluate(() => {
      document
        .querySelector('.personality-results__signal-retest')
        ?.scrollIntoView({ block: 'center', behavior: 'instant' })
    })
    await page.waitForTimeout(400)
    return screenshotViewport(page)
  })
}
register('personality-results-signal-retest', capturePersonalityResultsSignalRetest)


// ─── 2026-10-12 pricing-change visual verification (S-7 / invite rewrite) ──
// Rendered-truth coverage for the surfaces touched by the WELCOME20 change;
// jsdom unit tests are green but these are the visual sign-off.

async function captureInvitePage() {
  return withBrowserPage(
    { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 },
    async (page) => {
      await page.goto(`${H5_BASE_URL}/#/pages/profile-linked/invite/index?motion=reduce`, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      })
      await clearAndSeedStorage(page)
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })

      await page.waitForSelector('.invite-page__code-card', { timeout: 10000 })
      await page.waitForTimeout(800)

      return page.screenshot({ fullPage: true })
    }
  )
}

async function captureRewardsPage() {
  return withBrowserPage(
    { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 },
    async (page) => {
      await page.goto(`${H5_BASE_URL}/#/pages/profile-linked/rewards/index?motion=reduce`, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      })
      await clearAndSeedStorage(page)
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })

      await page.waitForSelector('.rewards-page__coupon-card', { timeout: 10000 })
      await page.waitForTimeout(800)

      return page.screenshot({ fullPage: true })
    }
  )
}

async function captureBlindBoxPaymentWelcomeBanner() {
  return withBrowserPage(
    { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 },
    async (page) => {
      await page.goto(`${H5_BASE_URL}/#/pages/payments/blind-box-payment/index?motion=reduce`, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      })
      await clearAndSeedStorage(page)
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })

      await page.waitForSelector('.first-time-coupon-banner', { timeout: 15000 })
      await page.waitForTimeout(1500)

      return page.screenshot({ fullPage: true })
    }
  )
}
register('invite-page', captureInvitePage)
register('rewards-page', captureRewardsPage)
register('blind-box-payment-welcome-banner', captureBlindBoxPaymentWelcomeBanner)


const DIST_DIR = path.resolve(process.cwd(), 'apps/mini-program/dist')

// The screenshot harness seeds state through the local mock server
// (scripts/mock-h5-server.mjs). An H5 build that has TARO_APP_API_BASE_URL
// pointed at staging redirects every page to `?auth=expired`, which shows up
// as unrelated selector timeouts in whichever generator ran first. Fail fast
// with the rebuild command instead.
function assertLocalMockApiBuild() {
  const usesLocalMock = /^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(H5_BASE_URL)
  if (!usesLocalMock) return

  const indexPath = path.join(DIST_DIR, 'index.html')
  if (!fs.existsSync(indexPath)) {
    throw new Error(
      `H5 build missing at ${indexPath}.\n` +
        `Run: TARO_APP_API_BASE_URL=${H5_BASE_URL} TARO_APP_ENABLE_STORY_MODE=true npm run build:h5 --workspace=mini-program`,
    )
  }

  const jsDir = path.join(DIST_DIR, 'js')
  const requiredBase = H5_BASE_URL.replace(/\/$/, '')
  const bundleHasMockBase = fs.existsSync(jsDir)
    ? fs
        .readdirSync(jsDir)
        .filter(name => name.endsWith('.js'))
        .some(name => fs.readFileSync(path.join(jsDir, name), 'utf8').includes(requiredBase))
    : false

  if (!bundleHasMockBase) {
    throw new Error(
      `H5 build does not call the local mock API (${requiredBase}); screenshots would redirect to ?auth=expired.\n` +
        `Rebuild: TARO_APP_API_BASE_URL=${H5_BASE_URL} TARO_APP_ENABLE_STORY_MODE=true npm run build:h5 --workspace=mini-program`,
    )
  }
}

try {
  assertLocalMockApiBuild()
} catch (err) {
  console.error(`[screenshot-server] ${err.message}`)
  process.exit(1)
}

const server = app.listen(PORT, '127.0.0.1', () => {
  console.log(`[screenshot-server] listening on http://localhost:${PORT}`)
  console.log(`[screenshot-server] available URLs:`)
  Array.from(generators.keys()).forEach(k => {
    console.log(`  http://localhost:${PORT}/${k}.png`)
  })
})

process.on('SIGTERM', () => server.close())
process.on('SIGINT', () => server.close())
