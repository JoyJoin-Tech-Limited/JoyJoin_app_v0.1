const fs = require('fs')
const automator = require('miniprogram-automator')

const outputPath = process.argv[2]

const config = {
  wsEndpoint: 'ws://127.0.0.1:9420',
  readyTimeoutMs: 15000,
  pollMs: 200,
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function normalizeRoute(route) {
  return route.replace(/^\//, '')
}

async function waitFor(label, predicate, timeoutMs = config.readyTimeoutMs) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const value = await predicate()
    if (value) return value
    await sleep(config.pollMs)
  }
  throw new Error(`Timed out waiting for ${label}`)
}

async function waitForRoute(miniProgram, route) {
  const normalized = normalizeRoute(route)
  return waitFor(`route ${normalized}`, async () => {
    const page = await miniProgram.currentPage()
    if (page && page.path === normalized) return page
    return null
  })
}

async function snapshotPage(page, selectors = []) {
  const info = { route: page.path, found: {} }
  for (const selector of selectors) {
    info.found[selector] = Boolean(await page.$(selector))
  }
  return info
}

async function waitForRedirectAway(miniProgram, sourceRoute, allowedRoutes, label, timeoutMs = config.readyTimeoutMs) {
  const source = normalizeRoute(sourceRoute)
  const allowed = allowedRoutes.map(normalizeRoute)
  return waitFor(label, async () => {
    const page = await miniProgram.currentPage()
    if (!page) return null
    if (page.path === source) return null
    if (allowed.includes(page.path)) return page
    return { unexpectedRoute: page.path }
  }, timeoutMs)
}

async function run() {
  const result = {
    ok: true,
    startedAt: new Date().toISOString(),
    checks: [],
    errors: [],
  }

  let miniProgram = null
  try {
    miniProgram = await automator.connect({ wsEndpoint: config.wsEndpoint })

    await miniProgram.callWxMethod('clearStorageSync')

    await miniProgram.callWxMethod('reLaunch', { url: '/pages/index/index' })
    const landingPage = await waitForRoute(miniProgram, '/pages/index/index')
    result.checks.push({
      name: 'landing-load',
      route: landingPage.path,
      snapshot: await snapshotPage(landingPage, [
        '.landing-page__legal-checkbox',
        '.landing-page__cta--primary',
        '.landing-page__cta--login',
      ]),
    })

    await miniProgram.callWxMethod('reLaunch', { url: '/pages/login/index' })
    const loginPage = await waitForRoute(miniProgram, '/pages/login/index')
    result.checks.push({
      name: 'login-load',
      route: loginPage.path,
      snapshot: await snapshotPage(loginPage, [
        '.login-page__wechat-btn',
        '.login-page__title',
      ]),
    })

    await miniProgram.callWxMethod('reLaunch', { url: '/pages/onboarding/personality-test/index' })
    const personalityPage = await waitForRoute(miniProgram, '/pages/onboarding/personality-test/index')
    result.checks.push({
      name: 'personality-load',
      route: personalityPage.path,
      snapshot: await snapshotPage(personalityPage, [
        '.personality-test__start-btn',
        '.personality-test__error',
      ]),
    })

    await miniProgram.callWxMethod('reLaunch', { url: '/pages/journey/index' })
    const journeyResolved = await waitForRedirectAway(
      miniProgram,
      '/pages/journey/index',
      ['/pages/events/index', '/pages/login/index'],
      'journey redirect resolution',
      15000,
    )
    result.checks.push({
      name: 'journey-redirect',
      finalRoute: journeyResolved.unexpectedRoute || journeyResolved.path,
      unexpected: Boolean(journeyResolved.unexpectedRoute),
    })

    await miniProgram.callWxMethod('reLaunch', { url: '/pages/my-events/index' })
    const myEventsResolved = await waitForRedirectAway(
      miniProgram,
      '/pages/my-events/index',
      ['/pages/events/index', '/pages/login/index'],
      'my-events redirect resolution',
      15000,
    )
    result.checks.push({
      name: 'my-events-redirect',
      finalRoute: myEventsResolved.unexpectedRoute || myEventsResolved.path,
      unexpected: Boolean(myEventsResolved.unexpectedRoute),
    })

    await miniProgram.callWxMethod('reLaunch', { url: '/pages/blind-box-payment/index' })
    const paymentResolved = await waitForRedirectAway(
      miniProgram,
      '/pages/blind-box-payment/index',
      ['/pages/blind-box-payment/index', '/pages/login/index'],
      'blind-box-payment route resolution',
      15000,
    ).catch(async () => {
      const page = await miniProgram.currentPage()
      return page ? { path: page.path } : { path: null }
    })

    const paymentFinalRoute = paymentResolved.unexpectedRoute || paymentResolved.path
    result.checks.push({
      name: 'payment-entry-resolution',
      finalRoute: paymentFinalRoute,
      unexpected: Boolean(paymentResolved.unexpectedRoute),
    })

    if (paymentFinalRoute === 'pages/blind-box-payment/index') {
      const paymentPage = await waitForRoute(miniProgram, '/pages/blind-box-payment/index')
      result.checks.push({
        name: 'payment-load',
        route: paymentPage.path,
        snapshot: await snapshotPage(paymentPage, [
          '.payment-page',
          '.payment-page__title',
          '.payment-page__summary-card',
        ]),
      })
    }
  } catch (error) {
    result.ok = false
    result.errors.push(error && error.stack ? error.stack : String(error))
  } finally {
    if (miniProgram) {
      try {
        await miniProgram.close()
      } catch (closeError) {
        result.errors.push(`close-error: ${closeError && closeError.stack ? closeError.stack : String(closeError)}`)
      }
    }
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2))
  }
}

run().catch((error) => {
  const payload = {
    ok: false,
    startedAt: new Date().toISOString(),
    fatalError: error && error.stack ? error.stack : String(error),
  }
  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2))
  process.exit(1)
})
