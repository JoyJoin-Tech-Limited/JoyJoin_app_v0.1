#!/usr/bin/env node
// 「我的奖励」 wallet captures (2026-11-26 rebuild).
// Sprint contract: .git/.orchestration/sprints/sprint-contract.rewards-page-revamp-20261126.md
//
// The page is a read-only coupon wallet: 可用优惠券 → 去挑一场活动 → 账户(成长/悦币)
// → 最近成长 → 已使用与已过期. The redeem shop is dormant, so no capture seeds
// redeemable items on purpose — if a 兑换 surface reappears, that is a regression
// and the populated capture will show it.
//
// States covered (contract §Verification):
//   populated      3 available coupons, Lv.3, coins 50, 4 growth rows
//   new-user       1 welcome coupon, Lv.1 / 50 growth值, coins 25
//   zero-coupon    0 available + 0 history, Lv.1 / 0
//   many           6 available coupons (scroll ceiling check), Lv.6
//   history-open   3 available + used/expired disclosure expanded
//   coupon-error   coupons endpoint 500 → inline notice, growth stays visible
//
// `ctx` is supplied by screenshot-server.mjs with the shared harness helpers.

const PATH = 'pages/profile-linked/rewards/index'

function isoDaysFromNow(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
}

const WELCOME_COUPON = {
  id: 'cp-welcome',
  code: 'WELCOME20',
  discountType: 'fixed_amount',
  discountValue: 2000,
  validUntil: isoDaysFromNow(23),
  isUsed: false,
  source: 'promotion',
  createdAt: isoDaysFromNow(-7),
}

const NINE_OFF = {
  id: 'cp-nine',
  code: 'COUPON_10_OFF',
  discountType: 'percentage',
  discountValue: 10,
  validUntil: isoDaysFromNow(12),
  isUsed: false,
  source: 'joy_coins_redemption',
  createdAt: isoDaysFromNow(-4),
}

const FIVE_OFF_URGENT = {
  id: 'cp-five',
  code: 'COUPON_50_OFF',
  discountType: 'percentage',
  discountValue: 50,
  validUntil: isoDaysFromNow(4),
  isUsed: false,
  source: 'admin_grant',
  createdAt: isoDaysFromNow(-10),
}

const INVITE_COUPON = {
  id: 'cp-invite',
  code: 'INVITE50',
  discountType: 'fixed_amount',
  discountValue: 5000,
  validUntil: isoDaysFromNow(41),
  isUsed: false,
  source: 'invitation_reward',
  createdAt: isoDaysFromNow(-2),
}

const USED_COUPON = {
  id: 'cp-used',
  code: 'COUPON_20_OFF',
  discountType: 'percentage',
  discountValue: 20,
  validUntil: isoDaysFromNow(-6),
  isUsed: true,
  usedAt: isoDaysFromNow(-9),
  source: 'joy_coins_redemption',
  createdAt: isoDaysFromNow(-40),
}

const EXPIRED_COUPON = {
  id: 'cp-expired',
  code: 'REFERRAL30',
  discountType: 'fixed_amount',
  discountValue: 3000,
  validUntil: isoDaysFromNow(-18),
  isUsed: false,
  source: 'promotion',
  createdAt: isoDaysFromNow(-48),
}

const GROWTH_HISTORY = [
  { id: 'tx-1', xpAmount: 50, coinsAmount: 50, descriptionCn: '活动回顾写得很有心', createdAt: isoDaysFromNow(-2) },
  { id: 'tx-2', xpAmount: 80, coinsAmount: 50, descriptionCn: '完成一场活动', createdAt: isoDaysFromNow(-9) },
  { id: 'tx-3', xpAmount: 20, coinsAmount: 20, descriptionCn: '活动反馈', createdAt: isoDaysFromNow(-16) },
  { id: 'tx-4', xpAmount: 50, coinsAmount: 25, descriptionCn: '完善个人资料', createdAt: isoDaysFromNow(-24) },
]

export function registerRewardsGenerators(ctx) {
  const {
    register,
    withBrowserPage,
    clearAndSeedStorage,
    waitForContent,
    interceptAuthUserOverrides,
    H5_BASE_URL,
  } = ctx

  const VIEWPORT = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }

  async function mockRewardsApi(
    page,
    { coupons = [WELCOME_COUPON], gamification, history = GROWTH_HISTORY, couponsStatus = 200 } = {}
  ) {
    await page.route('**/api/user/coupons', (route) => {
      if (couponsStatus !== 200) {
        return route.fulfill({
          status: couponsStatus,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'boom' }),
        })
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ count: coupons.length, coupons }),
      })
    })

    await page.route('**/api/user/gamification/history*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(history),
      }))

    await page.route('**/api/user/gamification', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          gamification ?? {
            experiencePoints: 300,
            joyCoins: 50,
            currentLevel: 3,
            activityStreak: 2,
            eventsAttended: 4,
          }
        ),
      }))

    await page.route('**/api/analytics/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      }))
  }

  async function openRewards(page, options = {}) {
    await interceptAuthUserOverrides(page, {})
    await mockRewardsApi(page, options)
    await page.goto(`${H5_BASE_URL}/#/${PATH}?motion=reduce`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    })
    await clearAndSeedStorage(page)
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })
    await waitForContent(page, options.waitFor ?? '.rewards-page__wallet', 30000)
    // H5-renderer neutralizer for taro-image-core (same correction as the
    // event-feedback/social generators): the inner <img> otherwise paints
    // shifted right by half a box in the H5 emulation only.
    await page.addStyleTag({
      content: [
        'taro-image-core img { position: static !important; left: auto !important; top: auto !important;',
        '  transform: none !important; width: 100% !important; height: 100% !important; object-fit: contain !important; }',
      ].join('\n'),
    })
    await page.waitForTimeout(400)
  }

  // Happy path: three available coupons, soonest expiry first, Lv.3 account.
  register('rewards-populated', () =>
    withBrowserPage(VIEWPORT, async (page) => {
      await openRewards(page, { coupons: [WELCOME_COUPON, NINE_OFF, FIVE_OFF_URGENT] })
      return page.screenshot({ fullPage: false })
    }))

  // Brand-new account: one welcome coupon, Lv.1, coins 25, soft growth hint.
  register('rewards-new-user', () =>
    withBrowserPage(VIEWPORT, async (page) => {
      await openRewards(page, {
        coupons: [WELCOME_COUPON],
        history: GROWTH_HISTORY.slice(0, 2),
        gamification: {
          experiencePoints: 50,
          joyCoins: 25,
          currentLevel: 1,
          activityStreak: 0,
          eventsAttended: 0,
        },
      })
      return page.screenshot({ fullPage: false })
    }))

  // Nothing usable and no history: the honest empty card + CTA, no coin row.
  register('rewards-zero-coupon', () =>
    withBrowserPage(VIEWPORT, async (page) => {
      await openRewards(page, {
        coupons: [],
        history: [],
        gamification: {
          experiencePoints: 0,
          joyCoins: 0,
          currentLevel: 1,
          activityStreak: 0,
          eventsAttended: 0,
        },
        waitFor: '.rewards-page__empty',
      })
      return page.screenshot({ fullPage: false })
    }))

  // Scroll ceiling: six coupons still inside one page-sized scroll.
  register('rewards-many', () =>
    withBrowserPage(VIEWPORT, async (page) => {
      await openRewards(page, {
        coupons: [
          FIVE_OFF_URGENT,
          NINE_OFF,
          WELCOME_COUPON,
          INVITE_COUPON,
          { ...NINE_OFF, id: 'cp-seven', code: 'COUPON_30_OFF', discountValue: 30 },
          {
            id: 'cp-free-ticket',
            code: 'FREE_EVENT_TICKET',
            discountType: 'percentage',
            discountValue: 100,
            validUntil: isoDaysFromNow(55),
            isUsed: false,
            source: 'joy_coins_redemption',
            createdAt: isoDaysFromNow(-1),
          },
        ],
        gamification: {
          experiencePoints: 1600,
          joyCoins: 260,
          currentLevel: 6,
          activityStreak: 4,
          eventsAttended: 11,
        },
      })
      return page.screenshot({ fullPage: false })
    }))

  // History disclosure expanded: used/expired rows with reason + date.
  register('rewards-history-open', () =>
    withBrowserPage(VIEWPORT, async (page) => {
      await openRewards(page, {
        coupons: [WELCOME_COUPON, NINE_OFF, FIVE_OFF_URGENT, USED_COUPON, EXPIRED_COUPON],
      })
      await page.waitForSelector('.rewards-page__history-head')
      await page.locator('.rewards-page__history-head').click()
      await page.waitForSelector('.rewards-page__history-row')
      await page.waitForTimeout(400)
      return page.screenshot({ fullPage: false })
    }))

  // Partial failure: coupons 500 → inline notice; account block still renders.
  register('rewards-coupon-error', () =>
    withBrowserPage(VIEWPORT, async (page) => {
      await openRewards(page, { couponsStatus: 500, waitFor: '.rewards-page__notice' })
      return page.screenshot({ fullPage: false })
    }))
}
