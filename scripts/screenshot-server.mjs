import express from 'express'
import { chromium, devices } from 'playwright'

const app = express()
const PORT = process.env.SCREENSHOT_PORT || 9000
const H5_BASE_URL = process.env.H5_BASE_URL || 'http://localhost:5001'

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

async function withBrowserPage(viewport, fn) {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext(viewport)
  const page = await context.newPage()
  try {
    return await fn(page)
  } finally {
    await browser.close()
  }
}

const DEFAULT_VIEWPORT = {
  viewport: { width: 375, height: 812 },
  deviceScaleFactor: 2,
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

async function captureSquadUnboxingRevealed() {
  return withBrowserPage(
    { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 },
    async (page) => {
      await page.goto(
        `${H5_BASE_URL}/#/pages/squad-unboxing/index?groupId=group-screenshot-001&motion=reduce`,
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

      // Wait for analysis cards to unfold (progressive reveal in stages).
      await page.waitForSelector('.squad-unboxing__analysis-stack', { timeout: 10000 })
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

register('events-footprint-oracle-card', captureEventsPage)
register('tier-selector-preset-cards', captureTierSelector)
register('pool-registration-step-0-brief', capturePoolRegistration)
register('event-ticket-payment', captureEventTicketPayment)
register('squad-unboxing-revealed', captureSquadUnboxingRevealed)
register('profile-review-welcome-coupon', captureProfileReview)
register('matching-status-puzzle-prelude', captureMatchingStatusPuzzlePrelude)

const server = app.listen(PORT, () => {
  console.log(`[screenshot-server] listening on http://localhost:${PORT}`)
  console.log(`[screenshot-server] available URLs:`)
  Array.from(generators.keys()).forEach(k => {
    console.log(`  http://localhost:${PORT}/${k}.png`)
  })
})

process.on('SIGTERM', () => server.close())
process.on('SIGINT', () => server.close())
