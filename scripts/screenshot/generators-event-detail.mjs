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
   */
  async function openEventDetail(page, { status, startOffsetMs, feedbackState, withGroup }) {
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
}
