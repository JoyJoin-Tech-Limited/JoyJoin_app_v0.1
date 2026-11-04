#!/usr/bin/env node
// P1-1 subtraction evidence: pool-registration already-joined terminal.
//
// The deleted waiting sentence must stay absent because the same screen already
// carries the joined/waiting fact in its title and EventSummaryCard. Captures
// solo + duo at the three audit viewports and fails loudly on missing status
// copy, a returning duplicate sentence, an off-screen CTA, or clipped duo copy.
// Set SUBTRACTION_BEFORE=1 only against the clean BEFORE worktree; that mode
// requires the old sentence instead, so the same assertions can prove the diff.

const POOL_ID = 'pool-screenshot-subtraction-joined'
const DELETED_SENTENCE = '你的预算和期待已经收到'
const EXPECT_BEFORE = process.env.SUBTRACTION_BEFORE === '1'

const VIEWPORTS = [
  { label: '390x844', width: 390, height: 844 },
  { label: '375x667', width: 375, height: 667 },
  { label: '320x568', width: 320, height: 568 },
]

export function registerSubtractionPoolRegistrationGenerators(ctx) {
  const {
    register,
    withBrowserPage,
    clearAndSeedStorage,
    waitForContent,
    screenshotViewport,
    interceptAuthUserOverrides,
    H5_BASE_URL,
  } = ctx

  async function loadPoolBase() {
    const res = await fetch(`${H5_BASE_URL}/api/event-pools/${POOL_ID}`)
    if (!res.ok) throw new Error(`event-pools mock returned ${res.status}`)
    return res.json()
  }

  async function openAlreadyJoined(page, { duo, title, partner = '小鹿' }) {
    const poolBase = await loadPoolBase()

    await interceptAuthUserOverrides(page, {})

    await page.route('**/api/event-pools/*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...poolBase, id: POOL_ID, status: 'matching', ...(title ? { title } : {}) }),
      }))

    await page.route('**/api/my-pool-registrations*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'reg-screenshot-subtraction-joined',
            poolId: POOL_ID,
            matchStatus: 'pending',
            status: 'registered',
            createdAt: new Date().toISOString(),
          },
        ]),
      }))

    await page.route('**/api/pools/*/duo-status*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          duo ? { state: 'bound', friendDisplayName: partner } : { state: 'none' },
        ),
      }))

    await page.route('**/api/analytics/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      }))

    await page.goto(`${H5_BASE_URL}/#/pages/pool-registration/index?id=${POOL_ID}&motion=reduce`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    })
    await clearAndSeedStorage(page)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })
    await waitForContent(page, '.pool-reg__already-joined')
  }

  const cases = [
    { key: 'solo', duo: false },
    { key: 'duo', duo: true, partner: '小鹿' },
    {
      key: 'long-title',
      duo: false,
      title: '南山区周末城市盲盒饭局与即兴音乐现场特别加长场次',
      viewports: ['320x568'],
    },
    {
      key: 'long-duo',
      duo: true,
      partner: '小鹿小鹿小鹿小鹿小鹿',
      viewports: ['320x568'],
    },
  ]

  for (const testCase of cases) {
    const caseViewports = VIEWPORTS.filter((viewport) =>
      !testCase.viewports || testCase.viewports.includes(viewport.label))
    for (const viewport of caseViewports) {
      register(`subtraction-pool-reg-joined-${testCase.key}-${viewport.label}`, () =>
        withBrowserPage(
          {
            viewport: { width: viewport.width, height: viewport.height },
            deviceScaleFactor: 2,
          },
          async (page) => {
            await openAlreadyJoined(page, {
              duo: testCase.duo,
              title: testCase.title,
              partner: testCase.partner,
            })

            await page.waitForFunction(
              ({ requireDuo, partnerName, deletedSentence, expectBefore, hasCustomTitle }) => {
                const root = document.querySelector('.pool-reg__already-joined')
                const title = document.querySelector('.pool-reg__already-title')
                const cta = document.querySelector('.pool-reg__already-cta')
                if (!root || !title || !cta) return false

                const text = root.textContent || ''
                if (!text.includes('有你的位置了')) return false
                if (!text.includes('报名成功') || !text.includes('等待排桌')) return false
                if (expectBefore ? !text.includes(deletedSentence) : text.includes(deletedSentence)) return false
                if (!expectBefore && !hasCustomTitle) {
                  if (!text.includes('周末松弛感饭局')) return false
                  if (text.includes('周末松弛感饭局 · 南山')) return false
                }

                const rect = cta.getBoundingClientRect()
                const ctaVisibleWithoutScroll =
                  rect.width > 0 &&
                  rect.height > 0 &&
                  rect.top >= 0 &&
                  rect.left >= 0 &&
                  rect.bottom <= window.innerHeight + 1 &&
                  rect.right <= window.innerWidth + 1
                if (!ctaVisibleWithoutScroll) return false

                const duoLine = Array.from(document.querySelectorAll('.pool-reg__already-text'))
                  .find((element) => (element.textContent || '').includes('双人成行'))
                const mascot = document.querySelector('.pool-reg__already-mascot')
                const card = document.querySelector('.pool-reg__terminal-card')
                if (!mascot || !card) return false
                const mascotRect = mascot.getBoundingClientRect()
                if (Math.abs(mascotRect.width - mascotRect.height) > 1) return false
                if (title.scrollWidth > title.clientWidth + 1) return false
                if (card.scrollWidth > card.clientWidth + 1) return false

                if (requireDuo) {
                  if (!duoLine || !(duoLine.textContent || '').includes(partnerName)) return false
                  if (duoLine.scrollWidth > duoLine.clientWidth + 1) return false
                  if (duoLine.scrollHeight > duoLine.clientHeight + 1) return false
                } else if (duoLine) {
                  return false
                }

                return true
              },
              {
                requireDuo: testCase.duo,
                partnerName: testCase.partner || '小鹿',
                deletedSentence: DELETED_SENTENCE,
                expectBefore: EXPECT_BEFORE,
                hasCustomTitle: Boolean(testCase.title),
              },
              { timeout: 10000 },
            )

            await page.waitForTimeout(500)
            return screenshotViewport(page)
          },
        ))
    }
  }
}
