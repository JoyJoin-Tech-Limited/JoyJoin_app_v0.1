#!/usr/bin/env node
// 转化 S5.3 checkout merge-gate captures (2026-10-21 audit car) — P0d refund
// narrative 50/50 + P1a duo entry, on pages/payments/event-ticket-payment.
//
// State matrix (each capture gates its own DOM assertion + a CTA first-screen
// measurement BEFORE returning the PNG, so a broken state fails the capture
// loudly instead of silently screenshotting the wrong variant):
//
//   checkout-conversion-baseline-flag-off-375x667   flag OFF + duo row hidden
//       (duoRegistrationEnabled=false via auth/user override) — true pixel
//       parity with 线上现状 through the REAL kill switch, not a duo-status
//       state hack. The other four captures keep the duo flag at its default
//       (true) and drive the row's visibility through the duo-status gate.
//   checkout-conversion-bucket0-single-line-375x667 flag ON, refundNarrativeBucket=0
//       (control arm — legacy single fact line under the CTA), duo hidden.
//   checkout-conversion-bucket1-stack-375x667       flag ON, bucket=1 (two-line
//       caption stack 叙事上/事实下), duo hidden.
//   checkout-conversion-bucket1-duo-375x667         flag ON, bucket=1 + duo-status=none
//       (DuoEntryLink visible in the trust cluster) — the merge-critical
//       overlay state for short-phone CTA visibility.
//   checkout-conversion-bucket1-duo-320x568         same overlay state at 320x568
//       (duo row 492rpx content single-line verification viewport).
//
// Mocks ride the shared scripts/mock-h5-server.mjs fixtures; per-capture
// overrides use page.route exactly like generators-event-detail.mjs.
// Motion is reduced (?motion=reduce) so any entrance animation settles to its
// static end state for deterministic captures.

const POOL_ID = 'pool-screenshot-001'

const VIEWPORT_375 = { viewport: { width: 375, height: 667 }, deviceScaleFactor: 2 }
const VIEWPORT_320 = { viewport: { width: 320, height: 568 }, deviceScaleFactor: 2 }

export function registerCheckoutConversionGenerators(ctx) {
  const {
    register,
    withBrowserPage,
    clearAndSeedStorage,
    waitForContent,
    interceptAuthUserOverrides,
    H5_BASE_URL,
  } = ctx

  function buildReturnContext() {
    return {
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
  }

  /**
   * @param {object} options
   * @param {boolean} options.flagOn       preRevealRefundEnabled via auth/user override
   * @param {0|1|null} [options.bucket]    refundNarrativeBucket injected into ritual-context
   * @param {'none'|'waiting'} [options.duoState] duo-status gate driving DuoEntryLink visibility
   */
  async function openCheckout(page, { flagOn, bucket = null, duoState = 'waiting', duoFlagOn = true }) {
    // Variant routes BEFORE first load so the initial paint already sees them.
    await page.route('**/api/pools/*/duo-status', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          duoState === 'none'
            ? { state: 'none' }
            : { state: 'waiting', invitedAt: new Date().toISOString() }
        ),
      })
    )

    if (flagOn) {
      const res = await fetch(H5_BASE_URL + '/api/payments/ritual-context')
      if (!res.ok) throw new Error('ritual-context mock returned ' + res.status)
      const base = await res.json()
      await page.route('**/api/payments/ritual-context', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(
            bucket === null ? base : { ...base, refundNarrativeBucket: bucket }
          ),
        })
      )
      // Last registration wins in Playwright — flag-on features merged into
      // the mock auth user. duoRegistrationEnabled is explicitly asserted so
      // the flag-off baseline can hide the duo row through the REAL kill
      // switch (server flag, admin-toggleable) instead of a state hack.
      await interceptAuthUserOverrides(page, {
        features: { preRevealRefundEnabled: true, duoRegistrationEnabled: duoFlagOn },
      })
    } else if (!duoFlagOn) {
      // Baseline (pre-对标平台 线上现状): refund flag stays off AND the duo entry
      // hides via its own kill switch — true pixel parity, no duo-status hack.
      await interceptAuthUserOverrides(page, {
        features: { duoRegistrationEnabled: false },
      })
    }

    await page.goto(
      H5_BASE_URL + '/#/pages/event-ticket-payment/index?poolId=' + POOL_ID + '&motion=reduce',
      { waitUntil: 'domcontentloaded', timeout: 60000 }
    )
    await clearAndSeedStorage(page, { payment_return_context: buildReturnContext() })
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })
    await waitForContent(page, '.ticket-card')
  }

  /**
   * Merge-gate assertion shared by every capture: the exact expected caption
   * rows must be present (or absent), and the sticky-footer's primary CTA must
   * be fully inside the viewport (AC-06 short-phone first-screen guarantee).
   */
  async function assertVariantAndMeasureCta(page, { expectRows, expectDuo }) {
    await page.waitForFunction(
      ({ expectRows, expectDuo }) => {
        const rows = document.querySelectorAll('.ticket-refund-guarantee__text').length
        const narrative = document.querySelectorAll(
          '.ticket-refund-guarantee__text--narrative'
        ).length
        const duo = Boolean(document.querySelector('.ticket-duo-link'))
        const rowsOk =
          (expectRows === 0 && rows === 0) ||
          (expectRows === 1 && rows === 1 && narrative === 0) ||
          (expectRows === 2 && rows === 2 && narrative === 1)
        return rowsOk && duo === expectDuo
      },
      { expectRows, expectDuo },
      { timeout: 10000 }
    )
    return page.evaluate(() => {
      const footer = document.querySelector('.ticket-footer')
      const cta = document.querySelector('.ticket-cta')
      const duo = document.querySelector('.ticket-duo-link')
      const rect = (el) => {
        if (!el) return null
        const r = el.getBoundingClientRect()
        return { top: r.top, bottom: r.bottom, height: r.height }
      }
      const fr = rect(footer)
      const cr = rect(cta)
      const vh = window.innerHeight
      return {
        viewportHeight: vh,
        footer: fr,
        cta: cr,
        duoRow: rect(duo),
        // AC-06: the fixed footer never leaves the viewport; the CTA is fully
        // visible on the first screen in every variant (it is bottom-anchored,
        // so this asserts nothing pushed the footer chrome out of view).
        ctaFirstScreenVisible: Boolean(fr && cr && fr.bottom <= vh + 0.5 && cr.bottom <= vh + 0.5),
      }
    })
  }

  async function capture(name, viewport, options, domExpectation) {
    register(name, () =>
      withBrowserPage(viewport, async (page) => {
        await openCheckout(page, options)
        const measurement = await assertVariantAndMeasureCta(page, domExpectation)
        if (!measurement.ctaFirstScreenVisible) {
          throw new Error(name + ': CTA not first-screen visible — ' + JSON.stringify(measurement))
        }
        console.log('[checkout-conversion] ' + name, JSON.stringify(measurement))
        await page.waitForTimeout(300)
        // Viewport shot: the merge gate is CTA first-screen visibility; the
        // scroll-flow rows (duo entry, refund link, abandon) are annotated from
        // duoRow.top/height in the log line above.
        return page.screenshot({ fullPage: false })
      })
    )
  }

  capture(
    'checkout-conversion-baseline-flag-off-375x667',
    VIEWPORT_375,
    { flagOn: false, bucket: null, duoState: 'none', duoFlagOn: false },
    { expectRows: 0, expectDuo: false }
  )
  capture(
    'checkout-conversion-bucket0-single-line-375x667',
    VIEWPORT_375,
    { flagOn: true, bucket: 0, duoState: 'waiting' },
    { expectRows: 1, expectDuo: false }
  )
  capture(
    'checkout-conversion-bucket1-stack-375x667',
    VIEWPORT_375,
    { flagOn: true, bucket: 1, duoState: 'waiting' },
    { expectRows: 2, expectDuo: false }
  )
  capture(
    'checkout-conversion-bucket1-duo-375x667',
    VIEWPORT_375,
    { flagOn: true, bucket: 1, duoState: 'none' },
    { expectRows: 2, expectDuo: true }
  )
  capture(
    'checkout-conversion-bucket1-duo-320x568',
    VIEWPORT_320,
    { flagOn: true, bucket: 1, duoState: 'none' },
    { expectRows: 2, expectDuo: true }
  )
}
