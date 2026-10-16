#!/usr/bin/env node
// Event-feedback preview generators (2026-10-16 微信号采集点 spec
// docs/design/wechat-id-collection-spec-20261016.md).
//
// Covers the two shipped surfaces:
//   A — conditional 微信号 step (`wechat`) between connections and wrapup
//   C — revealed-page remedy card for users who skipped A but landed a match
//
// The page is server-gated (`GET /api/events/:id/feedback-state`), so every
// capture mocks feedback-state → open, the participant roster, the caller's
// registrations (date label) and the analytics collector. The remedy captures
// additionally mock the feedback POST (returns mutualMatches) and the set-once
// WeChat-contact endpoint. Auth is overridden with
// `wechatIdCollectionEnabled: true` + `wechatContactId: null` — the exact
// condition under which the new step renders.
// `ctx` is supplied by screenshot-server.mjs with the shared harness helpers.

const EVENT_ID = 'pool-screenshot-ef'

const PARTICIPANTS = [
  {
    id: 'ef-seed-1',
    displayName: '林小满',
    firstName: null,
    archetype: 'koala',
    avatarUrl: null,
    ageLabel: '95后',
    gender: '女性',
    industryLabel: '内容创作',
    socialTag: '夜行观察员',
  },
  {
    id: 'ef-seed-2',
    displayName: '周之阔',
    firstName: null,
    archetype: 'rooster',
    avatarUrl: null,
    ageLabel: '00后',
    gender: '男性',
    industryLabel: '产品设计',
    socialTag: '巷口密探',
  },
  {
    id: 'ef-seed-3',
    displayName: '陈默',
    firstName: null,
    archetype: 'octopus',
    avatarUrl: null,
    ageLabel: '95后',
    gender: '男性',
    industryLabel: '独立开发',
    socialTag: '深夜食堂常客',
  },
  {
    id: 'ef-seed-4',
    displayName: '冉冉',
    firstName: null,
    archetype: 'corgi',
    avatarUrl: null,
    ageLabel: '95后',
    gender: '女性',
    industryLabel: '品牌市场',
    socialTag: '周末出逃计划',
  },
  {
    id: 'ef-seed-5',
    displayName: '许一白',
    firstName: null,
    archetype: 'turtle',
    avatarUrl: null,
    ageLabel: '90后',
    gender: '女性',
    industryLabel: '建筑设计',
    socialTag: '慢热观察者',
  },
  {
    id: 'ef-seed-6',
    displayName: '陆遥',
    firstName: null,
    archetype: 'fox',
    avatarUrl: null,
    ageLabel: '95后',
    gender: '男性',
    industryLabel: '品牌咨询',
    socialTag: '周末骑车党',
  },
]

// One mutual match with no WeChat id on file — the exact scenario the C card
// exists for (the revealed page shows 对方尚未设置微信号 next to it).
const MUTUAL_MATCHES = [
  {
    userId: 'ef-seed-1',
    displayName: '林小满',
    archetype: 'koala',
    wechatContactId: null,
  },
]

export function registerEventFeedbackGenerators(ctx) {
  const {
    register,
    withBrowserPage,
    clearAndSeedStorage,
    waitForContent,
    interceptAuthUserOverrides,
    H5_BASE_URL,
  } = ctx

  const VIEWPORT = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }

  async function mockFeedbackApi(page, { mutualMatches = [] } = {}) {
    await page.route('**/api/events/*/feedback-state', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ state: 'open' }),
      }))

    await page.route('**/api/events/*/participants', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(PARTICIPANTS),
      }))

    await page.route('**/api/my-pool-registrations', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'ef-reg-1',
            poolId: EVENT_ID,
            poolDateTime: '2026-10-15T11:30:00.000Z',
            matchStatus: 'matched',
            assignedGroupId: `group-${EVENT_ID}`,
            poolTitle: '周五夜·破冰局',
          },
        ]),
      }))

    await page.route('**/api/analytics/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      }))

    await page.route('**/api/events/*/feedback', (route) => {
      if (route.request().method() !== 'POST') return route.fallback()
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ mutualMatches }),
      })
    })

    await page.route('**/api/event-pools/*/group-outcome', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      }))

    await page.route('**/api/user/wechat-contact', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      }))
  }

  async function openFeedbackPage(page, options = {}) {
    await interceptAuthUserOverrides(page, {
      // Defaults to null (the exact condition under which the wechat step and
      // the remedy card render); pass a string for the "already set" journey.
      wechatContactId: options.wechatContactId ?? null,
      features: { wechatIdCollectionEnabled: true },
    })
    await mockFeedbackApi(page, options)
    await page.goto(`${H5_BASE_URL}/#/pages/event-feedback/index?id=${EVENT_ID}&motion=reduce`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    })
    await clearAndSeedStorage(page)
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })
    // Cold browser contexts + full H5 boot occasionally exceed the 10s default;
    // give the first meaningful paint a generous budget.
    await waitForContent(page, '.rating-face__row', 30000)
    // H5-renderer neutralizer: taro-image-core positions its inner <img> with
    // `left: 50%` but the compensating translate never lands in the H5
    // emulation, so every Image paints shifted right by exactly half a box
    // (verified numerically: img.x === host.x + host.w/2 on all three images).
    // WeChat's native <Image mode='aspectFit'> has no such code path — this is
    // a screenshot-harness-only correction so captures match device rendering.
    await page.addStyleTag({
      content: [
        'taro-image-core img { position: static !important; left: auto !important; top: auto !important;',
        '  transform: none !important; width: 100% !important; height: 100% !important; object-fit: contain !important; }',
      ].join('\n'),
    })
  }

  async function advanceToWechatStep(page) {
    // experience → connections
    await page.locator('.rating-face__item').nth(3).click()
    await page.locator('.event-feedback__submit').click()
    await waitForContent(page, '.event-feedback__participant-item')
    // connections → wechat (pick one person so needWechatStep flips true)
    await page.locator('.event-feedback__participant-item').first().click()
    await page.locator('.event-feedback__submit').click()
    await waitForContent(page, '.event-feedback__wechat-input')
    // H5-preview shim: the recap bar's mini avatar (56rpx ≈ 29px) renders its
    // inner image without the inline-rpx box constraint in H5 — constrain from
    // the class side, mirroring the other archetype-head shims.
    await page.addStyleTag({
      content: [
        '.event-feedback__recap .archetype-head { width: 29px !important; height: 29px !important; }',
        '.event-feedback__recap .archetype-head__image { width: 26px !important; height: 26px !important; }',
        '.event-feedback__recap-avatar img, .event-feedback__recap taro-image-core img { position: static !important; left: auto !important; transform: none !important; width: 100% !important; height: 100% !important; object-fit: contain !important; }',
      ].join('\n'),
    })
  }

  async function typeIntoInput(page, selector, text) {
    const host = page.locator(selector).first()
    await host.click()
    // Taro H5 renders <taro-input-core class="…"><input …></taro-input-core>;
    // click the native input too so keystrokes land.
    const native = page.locator(`${selector} input`).first()
    if ((await native.count()) > 0) await native.click()
    await page.keyboard.type(text, { delay: 25 })

    const valueLanded = async () =>
      page.evaluate((sel) => {
        const el = document.querySelector(sel)
        if (!el) return false
        const input = el.tagName === 'INPUT' ? el : el.querySelector('input')
        return !!input && input.value.length > 0
      }, selector)

    if (await valueLanded()) return
    // Fallback: drive the native value setter + input event (React picks it up
    // through the synthetic input layer). Only fires when keystrokes were lost.
    await page.evaluate(
      ({ sel, val }) => {
        const host = document.querySelector(sel)
        const input = host && (host.tagName === 'INPUT' ? host : host.querySelector('input'))
        if (!input) return
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
        setter?.call(input, val)
        input.dispatchEvent(new Event('input', { bubbles: true }))
      },
      { sel: selector, val: text },
    )
    await page.waitForFunction((sel) => {
      const el = document.querySelector(sel)
      const input = el && (el.tagName === 'INPUT' ? el : el.querySelector('input'))
      return !!input && input.value.length > 0
    }, selector, { timeout: 5000 })
  }

  // ─── A step: wechat collection screen (default state) ────────────────────
  // Asserts the post-uplift anatomy (Batch B): 4 progress dots (stable
  // denominator), privacy contract block (lock icon + two-line stack), format
  // hint (error slot sibling), merged skip line, ghost back + primary CTA, and
  // the 选人回顾条 (recap bar) above the card. `__wechat-setonce` and
  // `__wechat-skip-hint` were deleted by the uplift — do not re-add.
  register('event-feedback-wechat-step', () =>
    withBrowserPage(VIEWPORT, async (page) => {
      await openFeedbackPage(page)
      await advanceToWechatStep(page)
      await page.waitForFunction(() => {
        const privacy = document.querySelector('.event-feedback__wechat-privacy-text')
        const privacySub = document.querySelector('.event-feedback__wechat-privacy-sub')
        const privacyIcon = document.querySelector('.event-feedback__wechat-privacy-icon')
        const hint = document.querySelector('.event-feedback__wechat-format-hint')
        const skip = document.querySelector('.event-feedback__wechat-skip')
        const recap = document.querySelector('.event-feedback__recap')
        const scrollInner = document.querySelector('.event-feedback__scroll-inner')
        const dots = document.querySelectorAll('.event-feedback__progress-dot').length
        return (
          Boolean(privacy && privacySub && privacyIcon && hint && skip && recap && scrollInner) &&
          dots === 4
        )
      }, undefined, { timeout: 15000 })
      await page.waitForTimeout(600)
      return page.screenshot({ fullPage: false })
    }))

  // A step with a typed (valid) value — mono input + live format hint state.
  register('event-feedback-wechat-step-filled', () =>
    withBrowserPage(VIEWPORT, async (page) => {
      await openFeedbackPage(page)
      await advanceToWechatStep(page)
      await typeIntoInput(page, '.event-feedback__wechat-input', 'joyjoin_lucky')
      await page.waitForTimeout(400)
      return page.screenshot({ fullPage: false })
    }))

  // A step invalid format: red border + inline error row. Post-uplift the
  // error and the format hint share ONE slot (mutually exclusive) — assert
  // the hint is gone while the error shows.
  register('event-feedback-wechat-step-invalid', () =>
    withBrowserPage(VIEWPORT, async (page) => {
      await openFeedbackPage(page)
      await advanceToWechatStep(page)
      await typeIntoInput(page, '.event-feedback__wechat-input', 'abc')
      await page.locator('.event-feedback__submit').click()
      await waitForContent(page, '.event-feedback__wechat-field-error')
      await page.waitForFunction(
        () =>
          !!document.querySelector('.event-feedback__wechat-input--error') &&
          !document.querySelector('.event-feedback__wechat-format-hint'),
        undefined,
        { timeout: 5000 },
      )
      await page.waitForTimeout(400)
      return page.screenshot({ fullPage: false })
    }))

  // ─── Flow-context captures (2026-10-16 premium-uplift review) ───────────
  // The three pre-existing steps, captured so design review covers the whole
  // flow rather than only the new wechat/remedy surfaces.
  // Post-uplift the experience screen is progressively disclosed: radar/venue/
  // status cards live behind the「再多评几项（可选）」expander (collapsed by
  // default). `event-feedback-experience` captures the true default state;
  // `event-feedback-experience-expanded` opens the expander for the full form.
  register('event-feedback-experience', () =>
    withBrowserPage(VIEWPORT, async (page) => {
      await openFeedbackPage(page)
      await page.waitForFunction(
        () => !!document.querySelector('.event-feedback__expander'),
        undefined,
        { timeout: 10000 },
      )
      await page.waitForTimeout(600)
      return page.screenshot({ fullPage: false })
    }))

  register('event-feedback-experience-expanded', () =>
    withBrowserPage(VIEWPORT, async (page) => {
      await openFeedbackPage(page)
      await page.locator('.event-feedback__expander').click()
      await page.waitForFunction(
        () =>
          document
            .querySelector('.event-feedback__expander')
            ?.getAttribute('aria-expanded') === 'true',
        undefined,
        { timeout: 10000 },
      )
      await page.waitForTimeout(600)
      return page.screenshot({ fullPage: false })
    }))

  register('event-feedback-connections', () =>
    withBrowserPage(VIEWPORT, async (page) => {
      await openFeedbackPage(page)
      await page.locator('.rating-face__item').nth(3).click()
      await page.locator('.event-feedback__submit').click()
      await waitForContent(page, '.event-feedback__participant-item')
      // Post-uplift anatomy: benefit strip (lock icon + 互选钩子) above the
      // card, 2-col grid, large 112rpx archetype heads.
      await page.waitForFunction(
        () => !!document.querySelector('.event-feedback__benefit'),
        undefined,
        { timeout: 10000 },
      )
      // H5-preview shim (inline rpx dropped by the H5 renderer): connections
      // grid heads are now size large (112rpx ≈ 58px box at 390px viewport).
      await page.addStyleTag({
        content: [
          '.event-feedback__participant-item .archetype-head { width: 58px !important; height: 58px !important; }',
          '.event-feedback__participant-item .archetype-head__image { width: 53px !important; height: 53px !important; }',
        ].join('\n'),
      })
      await page.waitForTimeout(600)
      return page.screenshot({ fullPage: false })
    }))

  // One participant selected: shows the archetype-accent ring, the 4rpx lift,
  // the「已选 N 位」count pill and the morphed CTA「已选 1 人，下一步」.
  register('event-feedback-connections-selected', () =>
    withBrowserPage(VIEWPORT, async (page) => {
      await openFeedbackPage(page)
      await page.locator('.rating-face__item').nth(3).click()
      await page.locator('.event-feedback__submit').click()
      await waitForContent(page, '.event-feedback__participant-item')
      await page.locator('.event-feedback__participant-item').first().click()
      await page.waitForFunction(
        () => !!document.querySelector('.event-feedback__selection-count'),
        undefined,
        { timeout: 10000 },
      )
      await page.addStyleTag({
        content: [
          '.event-feedback__participant-item .archetype-head { width: 58px !important; height: 58px !important; }',
          '.event-feedback__participant-item .archetype-head__image { width: 53px !important; height: 53px !important; }',
        ].join('\n'),
      })
      await page.waitForTimeout(600)
      return page.screenshot({ fullPage: false })
    }))

  register('event-feedback-wrapup', () =>
    withBrowserPage(VIEWPORT, async (page) => {
      await openFeedbackPage(page)
      await advanceToWechatStep(page)
      await page.locator('.event-feedback__wechat-skip').click() // 暂不填写，结果页还能补 → wrapup
      await page.waitForFunction(
        () =>
          !!document.querySelector('.event-feedback__title')?.textContent?.includes('留个印象') &&
          !!document.querySelector('.event-feedback__improve-ring'),
        undefined,
        { timeout: 10000 },
      )
      // H5-preview shim (inline rpx dropped): wrapup attendee heads are
      // size={88} (88rpx ≈ 46px box).
      await page.addStyleTag({
        content: [
          '.event-feedback__attendee-avatar .archetype-head { width: 46px !important; height: 46px !important; }',
          '.event-feedback__attendee-avatar .archetype-head__image { width: 41px !important; height: 41px !important; }',
        ].join('\n'),
      })
      await page.waitForTimeout(600)
      return page.screenshot({ fullPage: false })
    }))

  // ─── C step: revealed-page remedy card ───────────────────────────────────
  // Path: skip A → wrapup → submit (mocked mutualMatches) → revealed shows the
  // remedy card above the match card.
  async function advanceToRemedyCard(page) {
    await openFeedbackPage(page, { mutualMatches: MUTUAL_MATCHES })
    await advanceToWechatStep(page)
    await page.locator('.event-feedback__wechat-skip').click() // 暂不填写，结果页还能补 → wrapup
    await page.waitForFunction(
      () => !!document.querySelector('.event-feedback__title')?.textContent?.includes('留个印象'),
      undefined,
      { timeout: 10000 },
    )
    await page.locator('.event-feedback__submit').click() // 提交反馈
    await waitForContent(page, '.event-feedback__remedy-card')
    await page.waitForFunction(() => {
      const title = document.querySelector('.event-feedback__remedy-title')
      const text = document.querySelector('.event-feedback__remedy-text')
      const input = document.querySelector('.event-feedback__remedy-input')
      const save = document.querySelector('.event-feedback__remedy-save')
      const keepsake = document.querySelector('.event-feedback__success-secondary')
      return (
        Boolean(title && text && input && save && keepsake) &&
        (title.textContent || '').includes('你还没留微信号') &&
        (text.textContent || '').includes('补上后') &&
        (keepsake.textContent || '').includes('存下')
      )
    }, undefined, { timeout: 10000 })
    // H5-preview shim: inline rpx is dropped by the H5 renderer
    // (see pages/index/index.scss:392), so ArchetypeHead would paint at its
    // natural 240px here while on device it honours size={64} (64rpx ≈ 33px).
    // Constrain it from the class side so this capture reflects device layout.
    await page.addStyleTag({
      content: [
        '.event-feedback__match-row .archetype-head { width: 33px !important; height: 33px !important; }',
        '.event-feedback__match-row .archetype-head__image { width: 30px !important; height: 30px !important; }',
      ].join('\n'),
    })
  }

  register('event-feedback-remedy-card', () =>
    withBrowserPage(VIEWPORT, async (page) => {
      await advanceToRemedyCard(page)
      await page.waitForTimeout(900)
      return page.screenshot({ fullPage: false })
    }))

  // Remedy saved: success swap line replaces the input row.
  register('event-feedback-remedy-saved', () =>
    withBrowserPage(VIEWPORT, async (page) => {
      await advanceToRemedyCard(page)
      await typeIntoInput(page, '.event-feedback__remedy-input', 'joyjoin_lucky')
      await page.locator('.event-feedback__remedy-save').click()
      await waitForContent(page, '.event-feedback__remedy-success')
      return page.screenshot({ fullPage: false })
    }))

  // ─── Revealed, clean mutual-match journey (post-uplift peak screen) ──────
  // Caller already has a WeChat id on file → wechat step is skipped, remedy
  // card is hidden. Single 240rpx mascot, match card with the honest
  // 「TA 设置后，连接里就能看到」 line, keepsake kept as the secondary
  // action above the back link (promoted pre-ship 2026-10-16).
  register('event-feedback-revealed', () =>
    withBrowserPage(VIEWPORT, async (page) => {
      await openFeedbackPage(page, {
        mutualMatches: MUTUAL_MATCHES,
        wechatContactId: 'joyjoin_lucky',
      })
      await page.locator('.rating-face__item').nth(3).click()
      await page.locator('.event-feedback__submit').click()
      await waitForContent(page, '.event-feedback__participant-item')
      await page.locator('.event-feedback__participant-item').first().click()
      await page.locator('.event-feedback__submit').click() // 已选 1 人 → wrapup (wechat step skipped)
      await page.waitForFunction(
        () => !!document.querySelector('.event-feedback__title')?.textContent?.includes('留个印象'),
        undefined,
        { timeout: 10000 },
      )
      await page.locator('.event-feedback__submit').click() // 提交反馈
      await waitForContent(page, '.event-feedback__success-secondary')
      await page.waitForFunction(
        () =>
          !document.querySelector('.event-feedback__remedy-card') &&
          !!document.querySelector('.event-feedback__success-mascot') &&
          (document.querySelector('.event-feedback__success-secondary')?.textContent || '').includes('存下'),
        undefined,
        { timeout: 10000 },
      )
      // Same inline-rpx shim as the remedy captures (match-row head 64rpx ≈ 33px).
      await page.addStyleTag({
        content: [
          '.event-feedback__match-row .archetype-head { width: 33px !important; height: 33px !important; }',
          '.event-feedback__match-row .archetype-head__image { width: 30px !important; height: 30px !important; }',
        ].join('\n'),
      })
      await page.waitForTimeout(900)
      return page.screenshot({ fullPage: false })
    }))

  // Experience screen selected states (pre-ship USA audit blind spot): a rating
  // face ringed + a thermometer station lit — never rendered before.
  register('event-feedback-experience-selected', () =>
    withBrowserPage(VIEWPORT, async (page) => {
      await openFeedbackPage(page)
      await page.locator('.rating-face__item').nth(2).click()
      await page.locator('.event-feedback__thermo .event-feedback__scale-dot').nth(3).click()
      await page.waitForFunction(
        () =>
          !!document.querySelector('.rating-face__item--selected') &&
          !!document.querySelector('.event-feedback__scale-dot--lit'),
        undefined,
        { timeout: 10000 },
      )
      await page.waitForTimeout(600)
      return page.screenshot({ fullPage: false })
    }))

  // No-mutual revealed branch (pre-ship USA audit: the emotional
  // crash-landing path was never rendered): selected someone, nobody mutual.
  // Honest subtext instead of thanks-only; no remedy card, no keepsake
  // (both are hasMatches-gated).
  register('event-feedback-revealed-none', () =>
    withBrowserPage(VIEWPORT, async (page) => {
      await openFeedbackPage(page, {
        mutualMatches: [],
        wechatContactId: 'joyjoin_lucky',
      })
      await page.locator('.rating-face__item').nth(3).click()
      await page.locator('.event-feedback__submit').click()
      await waitForContent(page, '.event-feedback__participant-item')
      await page.locator('.event-feedback__participant-item').first().click()
      await page.locator('.event-feedback__submit').click() // 已选 1 人 → wrapup (wechat step skipped)
      await page.waitForFunction(
        () => !!document.querySelector('.event-feedback__title')?.textContent?.includes('留个印象'),
        undefined,
        { timeout: 10000 },
      )
      await page.locator('.event-feedback__submit').click() // 提交反馈
      await waitForContent(page, '.event-feedback__success-mascot')
      await page.waitForFunction(
        () =>
          !document.querySelector('.event-feedback__remedy-card') &&
          !document.querySelector('.event-feedback__success-secondary') &&
          (document.body.textContent || '').includes('连接里第一时间见'),
        undefined,
        { timeout: 10000 },
      )
      await page.waitForTimeout(900)
      return page.screenshot({ fullPage: false })
    }))
}
