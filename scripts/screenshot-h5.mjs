import { chromium, devices } from 'playwright'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUTPUT_DIR = path.resolve(__dirname, '../tmp/screenshots')
const BASE_URL = process.env.H5_BASE_URL || 'http://localhost:5001'
const POOL_ID = 'pool-screenshot-001'

const MOCK_USER = {
  id: 'user-screenshot-001',
  displayName: '悦仔测试',
  nickname: '悦仔测试',
  archetype: 'corgi',
  primaryArchetype: 'corgi',
  nextStep: 'discover',
  hasCompletedOnboarding: true,
  profileEssentialComplete: true,
  profileExtendedComplete: true,
  activeAssessmentSessionId: null,
  paymentsEnabled: true,
  intent: ['deep_chat', 'fun'],
  pendingReferralCode: '',
  features: {
    restartOnboarding: false,
    smartProfession: true,
    onboardingForceSkip: false,
    matchingLiveReveal: true,
    socialIcebreakerClientForceEnd: false,
    personalityDiceChooseMode: false,
    runPlanTemplatesEnabled: true,
    personalityShareEnabled: true,
    personalitySlotAnimationEnabled: true,
    promoBannerEnabled: true,
    personalityTestEchoEnabled: true,
    paymentsEnabled: true,
    squadUnboxingDragRevealEnabled: true,
    socialIcebreakerCustomModeEnabled: true,
    profileRedesignEnabled: true,
  },
}

const RETURN_CONTEXT = {
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

async function clearAndSeedStorage(page) {
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  const authCache = JSON.stringify(MOCK_USER)
  const returnContext = JSON.stringify(RETURN_CONTEXT)

  await page.evaluate(
    ({ authCache, returnContext }) => {
      localStorage.setItem('mj_auth_cache', authCache)
      localStorage.setItem('payment_return_context', returnContext)
      // Fallback keys in case Taro H5 runtime prefixes them
      localStorage.setItem('taro_mj_auth_cache', authCache)
      localStorage.setItem('taro_payment_return_context', returnContext)
    },
    { authCache, returnContext }
  )
}

async function screenshotPage(page, name) {
  const filePath = path.join(OUTPUT_DIR, `${name}.png`)
  await page.screenshot({ path: filePath, fullPage: false })
  console.log(`[screenshot] ${filePath}`)
  return filePath
}

async function waitForContent(page, selector, timeout = 10000) {
  await page.waitForSelector(selector, { state: 'visible', timeout })
  // Small extra delay for entrance animations / images
  await page.waitForTimeout(800)
}

async function capturePoolRegistration(browser) {
  const context = await browser.newContext({
    ...devices['iPhone 13'],
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  })
  const page = await context.newPage()

  await page.goto(`${BASE_URL}/#/pages/pool-registration/index?id=${POOL_ID}`, {
    waitUntil: 'networkidle',
  })
  await clearAndSeedStorage(page)
  await page.reload({ waitUntil: 'networkidle' })

  // Step 0: brief
  await waitForContent(page, '.pool-reg__title')
  await screenshotPage(page, 'pool-registration-step-0-brief')

  // Advance to step 1
  await page.locator('text=入座这场饭局').first().click()
  await waitForContent(page, '.pool-reg__step-content')
  await screenshotPage(page, 'pool-registration-step-1-budget')

  // Select budget and advance
  await page.locator('text=150-200').first().click()
  await page.waitForTimeout(300)
  await page.locator('text=下一步：选择期待').first().click()
  await waitForContent(page, '.pool-reg__choice-grid')
  await screenshotPage(page, 'pool-registration-step-2-intent')

  // Select intent and advance
  await page.locator('text=深度交流').first().click()
  await page.waitForTimeout(300)
  await page.locator('text=下一步：补细节').first().click()
  await waitForContent(page, '.pool-reg__panel')
  await screenshotPage(page, 'pool-registration-step-3-details')

  await context.close()
}

async function captureEventTicketPayment(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  })
  const page = await context.newPage()

  await page.goto(`${BASE_URL}/#/pages/event-ticket-payment/index?poolId=${POOL_ID}`, {
    waitUntil: 'networkidle',
  })
  await clearAndSeedStorage(page)
  await page.reload({ waitUntil: 'networkidle' })

  await waitForContent(page, '.ticket-card')
  await screenshotPage(page, 'event-ticket-payment')

  // Also capture plan selector scrolled into view
  await page.evaluate(() => {
    const el = document.querySelector('.ticket-plan-section')
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' })
  })
  await page.waitForTimeout(500)
  await screenshotPage(page, 'event-ticket-payment-plan-selector')

  await context.close()
}

async function main() {
  const fs = await import('node:fs')
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })

  const browser = await chromium.launch({ headless: true })

  try {
    await capturePoolRegistration(browser)
    await captureEventTicketPayment(browser)
  } finally {
    await browser.close()
  }

  console.log(`[screenshot] All screenshots saved to ${OUTPUT_DIR}`)
}

main().catch((err) => {
  console.error('[screenshot] failed', err)
  process.exit(1)
})
