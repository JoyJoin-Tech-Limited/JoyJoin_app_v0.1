const fs = require('fs')
const automator = require('miniprogram-automator')

const outputPath = process.argv[2]
const wsEndpoint = 'ws://127.0.0.1:9420'

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function currentPage(mp) {
  return mp.currentPage()
}

async function currentPath(mp) {
  const page = await currentPage(mp)
  return page ? page.path : null
}

async function waitFor(label, predicate, timeoutMs = 15000, pollMs = 200) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const value = await predicate()
    if (value) return value
    await sleep(pollMs)
  }
  throw new Error(`Timed out waiting for ${label}`)
}

async function run() {
  const result = { ok: true, steps: [], errors: [] }
  let miniProgram = null
  try {
    miniProgram = await automator.connect({ wsEndpoint })
    await miniProgram.callWxMethod('clearStorageSync')

    await miniProgram.callWxMethod('reLaunch', { url: '/pages/login/index' })
    await waitFor('login route', async () => (await currentPath(miniProgram)) === 'pages/login/index')
    const page = await currentPage(miniProgram)

    result.steps.push({ label: 'login-route-ready', path: page.path })

    const button = await page.$('.login-page__wechat-btn')
    result.steps.push({ label: 'wechat-button-found', found: Boolean(button) })

    if (!button) {
      throw new Error('WeChat login button not found')
    }

    await button.tap()
    result.steps.push({ label: 'wechat-button-tapped', path: await currentPath(miniProgram) })

    await sleep(1000)
    result.steps.push({ label: 'after-1s', path: await currentPath(miniProgram) })

    await sleep(2000)
    result.steps.push({ label: 'after-3s', path: await currentPath(miniProgram) })

    await sleep(4000)
    result.steps.push({ label: 'after-7s', path: await currentPath(miniProgram) })
  } catch (error) {
    result.ok = false
    result.errors.push(error && error.stack ? error.stack : String(error))
  } finally {
    if (miniProgram) {
      try { await miniProgram.close() } catch (e) {}
    }
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2))
  }
}

run().catch((error) => {
  fs.writeFileSync(outputPath, JSON.stringify({ ok: false, fatalError: error && error.stack ? error.stack : String(error) }, null, 2))
  process.exit(1)
})
