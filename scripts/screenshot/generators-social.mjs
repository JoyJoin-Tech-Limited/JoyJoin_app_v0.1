#!/usr/bin/env node
// Social session preview generators (extracted from screenshot-server.mjs
// 2026-09-30 to keep the server under the harness file-size warn line).
// Covers: social-icebreaker phase states, warmup interactions, WaitingBeat,
// notifications list, duo bound state, auction V2, recap glow.
// `ctx` is supplied by screenshot-server.mjs with the shared harness helpers.

export function registerSocialGenerators(ctx) {
  const {
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
  } = ctx

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

  register('icebreaker-micro-challenge', () => captureIcebreaker('mock-micro_challenge'))
  register('icebreaker-opt-out', () => captureIcebreaker('mock-micro_challenge_optout', '.phase-opt-out'))
  register('icebreaker-opted-out', () => captureIcebreaker('mock-micro_challenge_opted_out', '.phase-opt-out'))
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

  // ─── WaitingBeat emotional-layer renders (2026-09-17 pre-ship) ─────
  // Mock states in scripts/mock-h5-icebreaker.mjs put a PARTICIPANT viewer
  // into the four waiting branches that carry the new WaitingBeat component:
  //   waiting-beat-auction      拍卖未生成      → variant 'host'
  //   waiting-beat-micro-done   已完成等他人    → variant 'peers'
  //   waiting-beat-lie-round    回合未开启      → variant 'host'
  //   waiting-beat-fallback     未注册 phase    → FallbackPhaseView
  register('waiting-beat-auction', () => captureIcebreaker('mock-waiting-beat-auction', '.waiting-beat'))
  register('waiting-beat-micro-done', () => captureIcebreaker('mock-waiting-beat-micro-done', '.waiting-beat'))
  register('waiting-beat-lie-round', () => captureIcebreaker('mock-waiting-beat-lie-round', '.waiting-beat'))
  register('waiting-beat-fallback', () => captureIcebreaker('mock-waiting-beat-fallback', '.waiting-beat'))

  // Notifications list page (2026-09-17): the new list surface that closes the
  // "badges with no list" gap — unread rows tinted, read rows neutral, relative
  // timestamps, end-of-list line.
  register('notifications-list', () =>
    withBrowserPage(
      { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 },
      async (page) => {
        await page.goto(`${H5_BASE_URL}/#/pages/notifications/index`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        })
        await clearAndSeedStorage(page)
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })
        await page.waitForSelector('.notifications-page__row', { timeout: 15000 })
        await page.waitForTimeout(800)
        return screenshotViewport(page)
      },
    ))

  // Duo bound state + text-overlap geometry proof. The celebration whisper only
  // mounts on a live waiting→bound transition (no polling in the hook), so the
  // capture renders the bound row and then injects the real
  // .pool-reg-duo__bound-whisper element — the compiled CSS styles it — and
  // asserts its box does NOT intersect the bound text (Class A regression:
  // the pre-fix absolutely-positioned version could overlap the ellipsis).
  register('duo-bound', () =>
    withBrowserPage(
      { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 },
      async (page) => {
        await page.goto(`${H5_BASE_URL}/#/pages/pool-registration/index?id=pool-screenshot-duo`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        })
        await clearAndSeedStorage(page)
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })
        await page.waitForSelector('.pool-reg-duo--bound', { timeout: 15000 })

        const geometry = await page.evaluate(() => {
          const card = document.querySelector('.pool-reg-duo')
          const text = document.querySelector('.pool-reg-duo__bound-text')
          if (!card || !text) return { ok: false, reason: 'missing nodes' }
          const whisper = document.createElement('span')
          whisper.className = 'pool-reg-duo__bound-whisper'
          whisper.textContent = '悦仔会把你们安排在同桌'
          card.appendChild(whisper)
          const wr = whisper.getBoundingClientRect()
          const tr = text.getBoundingClientRect()
          const overlap = !(wr.right <= tr.left || wr.left >= tr.right || wr.bottom <= tr.top || wr.top >= tr.bottom)
          return {
            ok: !overlap,
            overlap,
            whisperBottom: Math.round(wr.bottom),
            textBottom: Math.round(tr.bottom),
            textRight: Math.round(tr.right),
            whisperLeft: Math.round(wr.left),
          }
        })
        console.log('[duo-bound geometry]', JSON.stringify(geometry))
        await page.waitForTimeout(500)
        await scrollSelectorIntoView(page, '.pool-reg-duo--bound', 'center')
        return screenshotViewport(page)
      },
    ))

  // ─── Wave 2 Auction V2 + Wave 4 Session Glow previews (2026-09-18) ────
  // Flag-gated surfaces for the Wave 5 human DevTools walkthrough. Mock states
  // live in scripts/mock-h5-icebreaker.mjs:
  //   mock-auction-v2-live       participant view — 3-tier ladder + all-in badge
  //   mock-auction-v2-live-host  host view — close-lot CTA + host all-in hint
  //   mock-auction-v2-finale     two-act finale (4 awards + full bill + 流拍)
  //   mock-recap-glow            「今晚的高光」 block, mixed tiers + 3 medals
  //   mock-recap-glow-zero       honest all-zero table (微光 floor, 0 medals)

  function gotoIcebreakerSession(page, sessionId) {
    return page.goto(`${H5_BASE_URL}/#/pages/icebreaker-session/index?sessionId=${sessionId}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    })
  }

  // Taro H5 wraps each page in `.taro_page { height: <viewport>; overflow:
  // scroll }`, so fullPage screenshots are clipped to the viewport (document
  // scrollHeight never grows). Canon fix (same as squad-unboxing): scroll the
  // target block into view inside the scroll container, then capture the
  // viewport.
  async function scrollSelectorIntoView(page, selector, block = 'center') {
    await page.evaluate(
      ({ sel, blk }) => {
        const el = document.querySelector(sel)
        if (el) el.scrollIntoView({ behavior: 'instant', block: blk, inline: 'nearest' })
      },
      { sel: selector, blk: block },
    )
    await page.waitForTimeout(400)
  }

  // Live V2 bidding, participant view: the ladder must render all three tiers
  // (稳一手 90 / 加一点 105 disabled / 全押 100) and the all-in badge must sit
  // on the current leader (阿澈, 80 币). Two captures: ladder zone + leader
  // badge/history zone, scrolled into the viewport.
  register('icebreaker-auction-v2-live', () =>
    withBrowserPage(DEFAULT_VIEWPORT, async (page) => {
      await gotoIcebreakerSession(page, 'mock-auction-v2-live')
      await clearAndSeedStorage(page)
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })
      await waitForContent(page, '.auction-hero__ladder')
      await page.waitForFunction(() => {
        const tiers = document.querySelectorAll('.auction-hero__ladder-btn').length
        const badge = document.querySelector('.auction-hero__allin-badge')
        const historyAllIn = document.querySelectorAll('.auction-hero__history-allin').length
        return tiers === 3 && Boolean(badge) && historyAllIn === 1
      }, undefined, { timeout: 10000 })
      await page.waitForTimeout(1500)
      await scrollSelectorIntoView(page, '.auction-hero__ladder', 'center')
      return screenshotViewport(page)
    }))

  // Same live state from the host's seat: no ladder; close-lot CTA + the
  // host-only all-in hint (落槌前再看看…) + the leader badge.
  register('icebreaker-auction-v2-live-host', () =>
    withBrowserPage(DEFAULT_VIEWPORT, async (page) => {
      await gotoIcebreakerSession(page, 'mock-auction-v2-live-host')
      await clearAndSeedStorage(page)
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })
      await waitForContent(page, '.auction-hero__host-allin-hint')
      await page.waitForTimeout(1200)
      await scrollSelectorIntoView(page, '.auction-hero__host-allin-hint', 'center')
      return screenshotViewport(page)
    }))

  // Finale act 1, host view: four award cards face-down (点按揭晓), reveal-all
  // shortcut + advance CTA; the full bill (act 2) is already visible below.
  // Scrolled so hero + awards + bill top share the frame.
  register('icebreaker-auction-v2-finale', () =>
    withBrowserPage(DEFAULT_VIEWPORT, async (page) => {
      await gotoIcebreakerSession(page, 'mock-auction-v2-finale')
      await clearAndSeedStorage(page)
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })
      await waitForContent(page, '.auction-finale__awards')
      await page.waitForFunction(() => {
        const fronts = document.querySelectorAll('.auction-finale__award-front').length
        const rows = document.querySelectorAll('.auction-finale__bill-row').length
        return fronts === 4 && rows === 5
      }, undefined, { timeout: 10000 })
      await page.waitForTimeout(1200)
      await scrollSelectorIntoView(page, '.auction-finale__awards', 'start')
      return screenshotViewport(page)
    }))

  // Finale fully revealed: host taps 全部揭晓 → all four award backs
  // (今晚最敢花 / 捡漏王 / 全场最热 / 最稳的手) + bill.
  register('icebreaker-auction-v2-finale-revealed', () =>
    withBrowserPage(DEFAULT_VIEWPORT, async (page) => {
      await gotoIcebreakerSession(page, 'mock-auction-v2-finale')
      await clearAndSeedStorage(page)
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })
      await waitForContent(page, '.auction-finale__awards')
      await page.waitForSelector('.auction-finale__award-front', { state: 'visible', timeout: 10000 })
      await page.click('text=全部揭晓')
      await page.waitForFunction(
        () => document.querySelectorAll('.auction-finale__award-headline').length === 4,
        undefined,
        { timeout: 10000 },
      )
      // CardFlip 400ms + settle.
      await page.waitForTimeout(1200)
      await scrollSelectorIntoView(page, '.auction-finale__awards', 'start')
      return screenshotViewport(page)
    }))

  // Finale, participant view (viewer = 小鹿, a winner): cards render revealed
  // by default, no host controls — the applause block + （我） bill row instead.
  register('icebreaker-auction-v2-finale-participant', () =>
    withBrowserPage(DEFAULT_VIEWPORT, async (page) => {
      await interceptAuthUserOverrides(page, { id: 'ib-p2', displayName: '小鹿' })
      await gotoIcebreakerSession(page, 'mock-auction-v2-finale')
      await clearAndSeedStorage(page)
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })
      await waitForContent(page, '.auction-finale__awards')
      await page.waitForFunction(() => {
        const revealed = document.querySelectorAll('.auction-finale__award-headline').length
        const applause = document.querySelector('.auction-finale__applause')
        const billText = document.querySelector('.auction-finale__bill')?.textContent ?? ''
        return revealed === 4 && Boolean(applause) && billText.includes('（我）')
      }, undefined, { timeout: 10000 })
      await page.waitForTimeout(1200)
      await scrollSelectorIntoView(page, '.auction-finale__bill', 'center')
      return screenshotViewport(page)
    }))

  // Wave 4 glow block: 4-player roster-order cards, self outlined with the 你
  // badge + collapsed 看看我的高光来自哪里 detail, tier words 闪闪发光/暖心/微光,
  // 3 medals embedded in their recipients' cards. Scrolled so the whole card
  // stack is in frame (the recap hero above is legacy surface, already covered
  // by icebreaker-recap).
  register('icebreaker-recap-glow', () =>
    withBrowserPage(DEFAULT_VIEWPORT, async (page) => {
      await gotoIcebreakerSession(page, 'mock-recap-glow')
      await clearAndSeedStorage(page)
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })
      await waitForContent(page, '.recap-glow__cards')
      await page.waitForFunction(() => {
        const cards = document.querySelectorAll('.recap-glow__card').length
        const medals = document.querySelectorAll('.recap-glow__medal').length
        const selfBadge = document.querySelector('.recap-glow__self-badge')
        const toggle = document.querySelector('.recap-glow__detail-toggle')
        return cards === 4 && medals === 3 && Boolean(selfBadge) && Boolean(toggle)
      }, undefined, { timeout: 15000 })
      // Card stagger (180ms × 4) settle before capture.
      await page.waitForTimeout(2600)
      await scrollSelectorIntoView(page, '.recap-glow', 'start')
      return screenshotViewport(page)
    }))

  // Reduced-motion variant: OS-level reducedMotion context + the app's own
  // motion storage key (Taro H5 getStorageSync needs the {"data": …} wrapper).
  // Every card renders statically — no stagger class, zero delay.
  register('icebreaker-recap-glow-rm', () =>
    withBrowserPage(V17_VIEWPORT, async (page) => {
      await gotoIcebreakerSession(page, 'mock-recap-glow')
      await clearAndSeedStorage(page, { 'joyjoin:mini-reveal-motion': { data: 'reduce' } })
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })
      await waitForContent(page, '.recap-glow__cards')
      await page.waitForFunction(() => {
        const cards = document.querySelectorAll('.recap-glow__card').length
        const staggered = document.querySelectorAll('.recap-glow__card--stagger').length
        return cards === 4 && staggered === 0
      }, undefined, { timeout: 15000 })
      await page.waitForTimeout(1500)
      await scrollSelectorIntoView(page, '.recap-glow', 'start')
      return screenshotViewport(page)
    }))

  // Honest all-zero table (spec D5): every card on the 微光 floor, zero medals,
  // quiet table line + 静静发光也是光 floor line, no detail toggle.
  register('icebreaker-recap-glow-zero', () =>
    withBrowserPage(DEFAULT_VIEWPORT, async (page) => {
      await gotoIcebreakerSession(page, 'mock-recap-glow-zero')
      await clearAndSeedStorage(page)
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })
      await waitForContent(page, '.recap-glow__floor-line')
      await page.waitForFunction(() => {
        const cards = document.querySelectorAll('.recap-glow__card').length
        const medals = document.querySelectorAll('.recap-glow__medal').length
        const emberTiers = document.querySelectorAll('.recap-glow__tier--ember').length
        const toggle = document.querySelector('.recap-glow__detail-toggle')
        return cards === 4 && medals === 0 && emberTiers === 4 && !toggle
      }, undefined, { timeout: 15000 })
      await page.waitForTimeout(2600)
      await scrollSelectorIntoView(page, '.recap-glow', 'start')
      return screenshotViewport(page)
    }))
}
