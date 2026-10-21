#!/usr/bin/env node
// Event-detail action bar preview generators (2026-10-16 feedback activation +
// action-bar redesign; docs/proposals/2026-10-16-event-detail-action-bar-design.md).
//
// Captures the action-bar states of pages/event-detail:
//   locked        — grey-but-TAPPABLE 去评价 + 「活动结束后可填写反馈」hint
//   open          — primary 去评价 (solid brand purple)
//   live-overlap  — primary 进入破冰 (👥 chip + live dot) with 去评价 demoted to
//                   the --secondary outline variant (at most one solid CTA)
//   submitted     — non-interactive 已评价 (✓)
//   prematch      — 招募中: no action bar at all
//
// The page is server-gated (`GET /api/events/:id/feedback-state`) and resolves
// pool liveness client-side from dateTime (lib/utils/eventLiveWindow.ts), so
// each capture mocks the pool fixture's status/dateTime, the feedback state and
// the joined-events row carrying the group id. Motion is reduced
// (prefers-reduced-motion) so the live dot renders at its static full-opacity
// fallback instead of a random breathing frame.

const POOL_ID = 'pool-screenshot-detail'
const GROUP_ID = 'group-screenshot-detail'

export function registerEventDetailGenerators(ctx) {
  const {
    register,
    withBrowserPage,
    clearAndSeedStorage,
    waitForContent,
    interceptAuthUserOverrides,
    H5_BASE_URL,
  } = ctx

  const VIEWPORT = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }

  async function loadPoolBase() {
    const res = await fetch(`${H5_BASE_URL}/api/event-pools/${POOL_ID}`)
    if (!res.ok) throw new Error(`event-pools mock returned ${res.status}`)
    return res.json()
  }

  /**
   * @param {object} options
   * @param {string} options.status     pool status (matched / completed / active)
   * @param {number} options.startOffsetMs  dateTime relative to now
   * @param {string} options.feedbackState  GET /feedback-state → state
   * @param {boolean} options.withGroup     serve /api/events/joined with a groupId
   * @param {object} [options.authOverrides] merged into the /api/auth/user mock
   *   (e.g. `{ features: { preRevealRefundEnabled: true } }`); registered AFTER
   *   the base override so Playwright's last-registered-wins routing keeps it.
   */
  async function openEventDetail(page, { status, startOffsetMs, feedbackState, withGroup, authOverrides }) {
    const poolBase = await loadPoolBase()
    const dateTime = new Date(Date.now() + startOffsetMs).toISOString()

    await interceptAuthUserOverrides(page, {})

    await page.route('**/api/event-pools/*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...poolBase, id: POOL_ID, status, dateTime }),
      }))

    await page.route('**/api/events/*/feedback-state', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ state: feedbackState }),
      }))

    await page.route('**/api/events/joined', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          withGroup
            ? [
                {
                  id: POOL_ID,
                  title: poolBase.title,
                  dateTime,
                  status,
                  eventType: poolBase.eventType,
                  city: poolBase.city,
                  district: poolBase.district,
                  venueName: poolBase.venueName,
                  groupId: GROUP_ID,
                  finalDateTime: dateTime,
                },
              ]
            : [],
        ),
      }))

    await page.route('**/api/analytics/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      }))

    if (authOverrides) {
      await interceptAuthUserOverrides(page, authOverrides)
    }

    await page.goto(`${H5_BASE_URL}/#/pages/event-detail/index?id=${POOL_ID}&motion=reduce`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    })
    await clearAndSeedStorage(page)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })
    await waitForContent(page, '.event-detail__scroll-inner')
  }

  const HOUR_MS = 60 * 60 * 1000

  register('event-detail-action-locked', () =>
    withBrowserPage(VIEWPORT, async (page) => {
      await openEventDetail(page, {
        status: 'matched',
        startOffsetMs: 48 * HOUR_MS,
        feedbackState: 'locked',
        withGroup: false,
      })
      await page.waitForFunction(() => {
        const locked = document.querySelector('.event-detail__cta--locked')
        const hint = document.querySelector('.event-detail__action-hint')
        return Boolean(locked && hint) && (locked.textContent || '').includes('去评价')
      }, undefined, { timeout: 10000 })
      await page.waitForTimeout(500)
      return page.screenshot({ fullPage: false })
    }))

  register('event-detail-action-open', () =>
    withBrowserPage(VIEWPORT, async (page) => {
      await openEventDetail(page, {
        status: 'completed',
        startOffsetMs: -5 * HOUR_MS,
        feedbackState: 'open',
        withGroup: false,
      })
      await page.waitForFunction(() => {
        const primary = document.querySelector('.event-detail__cta')
        return Boolean(primary) && (primary.textContent || '').includes('去评价')
      }, undefined, { timeout: 10000 })
      await page.waitForTimeout(500)
      return page.screenshot({ fullPage: false })
    }))

  register('event-detail-action-live-overlap', () =>
    withBrowserPage(VIEWPORT, async (page) => {
      await openEventDetail(page, {
        status: 'matched',
        startOffsetMs: 15 * 60 * 1000,
        feedbackState: 'open',
        withGroup: true,
      })
      await page.waitForFunction(() => {
        const live = document.querySelector('.event-detail__cta--live')
        const secondary = document.querySelector('.event-detail__cta--secondary')
        return (
          Boolean(live && secondary) &&
          (live.textContent || '').includes('进入破冰') &&
          (secondary.textContent || '').includes('去评价')
        )
      }, undefined, { timeout: 10000 })
      await page.waitForTimeout(500)
      return page.screenshot({ fullPage: false })
    }))

  register('event-detail-action-submitted', () =>
    withBrowserPage(VIEWPORT, async (page) => {
      await openEventDetail(page, {
        status: 'completed',
        startOffsetMs: -5 * HOUR_MS,
        feedbackState: 'submitted',
        withGroup: false,
      })
      await page.waitForFunction(() => {
        const done = document.querySelector('.event-detail__cta--done')
        if (!done || !(done.textContent || '').includes('已评价')) return false
        // Rendering guard (2026-10-16 bug): the platform's built-in disabled
        // styling outranks a single class and painted this label white-on-white.
        return !/^rgba?\(255,\s*255,\s*255/.test(getComputedStyle(done).color)
      }, undefined, { timeout: 10000 })
      await page.waitForTimeout(500)
      return page.screenshot({ fullPage: false })
    }))

  register('event-detail-action-prematch', () =>
    withBrowserPage(VIEWPORT, async (page) => {
      await openEventDetail(page, {
        status: 'active',
        startOffsetMs: 72 * HOUR_MS,
        feedbackState: 'locked',
        withGroup: false,
      })
      await page.waitForTimeout(1200)
      const hasBar = await page.evaluate(
        () => Boolean(document.querySelector('.event-detail__action-bar')),
      )
      if (hasBar) throw new Error('pre-match state must not render the action bar')
      return page.screenshot({ fullPage: false })
    }))

  // ─── T46 trust-layer captures (2026-10-21, audit G9 unblock) ──────────
  // Six states across the two short-phone reference viewports:
  //   flow   — EventFlowStrip in view + FAQ collapsed + action bar visible in
  //            the same viewport (CTA first-screen composition check)
  //   faq    — FAQ card in view, all answers closed
  //   faqopen— exactly one FAQ answer expanded (tap the first Q row)
  // 375×667 = iPhone SE 2/3 class; 320×568 = iPhone SE 1 class / 320px floor.
  // The 320px captures additionally MEASURE the 集结房间等开席 node label for
  // orphan glyphs (last wrapped line narrower than one CJK glyph) and hard-fail
  // the generator if one appears — a silent screenshot would hide the defect.

  const VIEWPORT_375 = { viewport: { width: 375, height: 667 }, deviceScaleFactor: 2 }
  const VIEWPORT_320 = { viewport: { width: 320, height: 568 }, deviceScaleFactor: 2 }

  async function openTrustLayerDetail(page) {
    // preRevealRefundEnabled=true serves the full 8-item FAQ (incl. the
    // promise-locked cancel_refund entry); matched + 48h keeps the action bar
    // mounted (去评价) for the CTA-visibility composition check.
    await openEventDetail(page, {
      status: 'matched',
      startOffsetMs: 48 * HOUR_MS,
      feedbackState: 'locked',
      withGroup: false,
      authOverrides: { features: { preRevealRefundEnabled: true } },
    })
    await page.waitForSelector('.event-flow-strip', { state: 'visible', timeout: 10000 })
    await page.waitForSelector('.event-faq-accordion', { state: 'visible', timeout: 10000 })
    // 8 items = 7 unconditional + cancel_refund with the flag forced on.
    await page.waitForFunction(
      () => document.querySelectorAll('.event-faq-accordion__item').length === 8,
      undefined,
      { timeout: 10000 },
    )
    // No answer mounted = the accordion starts fully collapsed.
    await page.waitForFunction(
      () => document.querySelectorAll('.event-faq-accordion__answer').length === 0,
      undefined,
      { timeout: 5000 },
    )
  }

  /** Per-line rect widths of each strip label via Range.getClientRects. */
  async function measureStripLabels(page) {
    return page.evaluate(() => {
      const labels = Array.from(
        document.querySelectorAll('.event-flow-strip__node-label'),
      )
      return labels.map((el) => {
        const range = document.createRange()
        range.selectNodeContents(el)
        const rects = Array.from(range.getClientRects()).map((r) =>
          Math.round(r.width * 10) / 10,
        )
        const fontSize = parseFloat(getComputedStyle(el).fontSize)
        const box = el.getBoundingClientRect()
        return {
          text: (el.textContent || '').trim(),
          lineWidths: rects,
          fontSize: Math.round(fontSize * 10) / 10,
          lineCount: Math.round(box.height / (fontSize * 1.4)),
          clientHeight: el.clientHeight,
          scrollHeight: el.scrollHeight,
        }
      })
    })
  }

  /** Orphan = wrapped label whose final line is narrower than one CJK glyph. */
  function orphanFindings(measurements) {
    return measurements
      .map((m) => {
        if (m.lineWidths.length <= 1) return null
        const lastWidth = m.lineWidths[m.lineWidths.length - 1]
        return lastWidth < m.fontSize * 1.2 ? { ...m, lastWidth } : null
      })
      .filter(Boolean)
  }

  async function captureFlowStrip(page, viewportLabel) {
    await openTrustLayerDetail(page)
    // Land the strip mid-viewport; scroll the inner ScrollView (page-level
    // scrollTo does not reach inside Taro ScrollView).
    await page.evaluate(() => {
      document
        .querySelector('.event-detail__flow-card')
        ?.scrollIntoView({ behavior: 'instant', block: 'center' })
    })
    await page.waitForTimeout(400)
    const [barVisible, collapsed, measurements] = await Promise.all([
      page.evaluate(() => {
        const bar = document.querySelector('.event-detail__action-bar')
        if (!bar) return false
        const rect = bar.getBoundingClientRect()
        return rect.bottom <= window.innerHeight && rect.height > 0
      }),
      page.evaluate(
        () => document.querySelectorAll('.event-faq-accordion__answer').length === 0,
      ),
      measureStripLabels(page),
    ])
    if (!barVisible) throw new Error(`${viewportLabel}: action bar not visible with flow strip in view`)
    if (!collapsed) throw new Error(`${viewportLabel}: FAQ must start collapsed in the flow capture`)
    const orphans = orphanFindings(measurements)
    if (orphans.length > 0) {
      throw new Error(
        `${viewportLabel}: orphan glyph in flow-strip label(s): ${JSON.stringify(orphans)}`,
      )
    }
    const clipped = measurements.filter((m) => m.scrollHeight > m.clientHeight + 1)
    if (clipped.length > 0) {
      throw new Error(
        `${viewportLabel}: flow-strip label clipped by line-clamp: ${JSON.stringify(clipped)}`,
      )
    }
    console.log(`[event-detail] flow-strip ${viewportLabel} label lines:`, JSON.stringify(measurements))
    return page.screenshot({ fullPage: false })
  }

  async function captureFaq(page, viewportLabel, { openFirst }) {
    await openTrustLayerDetail(page)
    await page.evaluate(() => {
      document
        .querySelector('.event-detail__faq-card')
        ?.scrollIntoView({ behavior: 'instant', block: 'start' })
    })
    if (openFirst) {
      await page.click('.event-faq-accordion__row')
      // Enter animation is 250ms; with reduced motion the swap is instant.
      await page.waitForFunction(
        () => document.querySelectorAll('.event-faq-accordion__answer').length === 1,
        undefined,
        { timeout: 5000 },
      )
      await page.waitForTimeout(400)
      await page.waitForFunction(
        () => {
          const answer = document.querySelector('.event-faq-accordion__answer')
          if (!answer) return false
          const box = answer.getBoundingClientRect()
          return box.height > 10
        },
        undefined,
        { timeout: 5000 },
      )
      const openCount = await page.evaluate(
        () => document.querySelectorAll('.event-faq-accordion__item--open').length,
      )
      if (openCount !== 1) throw new Error(`${viewportLabel}: exactly one FAQ item must be open`)
    } else {
      const answerCount = await page.evaluate(
        () => document.querySelectorAll('.event-faq-accordion__answer').length,
      )
      if (answerCount !== 0) throw new Error(`${viewportLabel}: FAQ collapsed capture has mounted answers`)
    }
    await page.waitForTimeout(300)
    return page.screenshot({ fullPage: false })
  }

  register('event-detail-flow-strip-375x667', () =>
    withBrowserPage(VIEWPORT_375, (page) => captureFlowStrip(page, '375x667')))

  register('event-detail-faq-collapsed-375x667', () =>
    withBrowserPage(VIEWPORT_375, (page) => captureFaq(page, '375x667', { openFirst: false })))

  register('event-detail-faq-open-375x667', () =>
    withBrowserPage(VIEWPORT_375, (page) => captureFaq(page, '375x667', { openFirst: true })))

  register('event-detail-flow-strip-320x568', () =>
    withBrowserPage(VIEWPORT_320, (page) => captureFlowStrip(page, '320x568')))

  register('event-detail-faq-collapsed-320x568', () =>
    withBrowserPage(VIEWPORT_320, (page) => captureFaq(page, '320x568', { openFirst: false })))

  register('event-detail-faq-open-320x568', () =>
    withBrowserPage(VIEWPORT_320, (page) => captureFaq(page, '320x568', { openFirst: true })))
}
