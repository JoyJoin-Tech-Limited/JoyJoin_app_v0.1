const fs = require('fs')
const automator = require('miniprogram-automator')

const outputPath = process.argv[2]
const wsEndpoint = 'ws://127.0.0.1:9420'

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function run() {
  const result = { ok: true, observations: [], errors: [] }
  let miniProgram = null
  try {
    miniProgram = await automator.connect({ wsEndpoint })
    await miniProgram.callWxMethod('clearStorageSync')
    await miniProgram.callWxMethod('reLaunch', { url: '/pages/login/index' })
    await sleep(1500)

    const page = await miniProgram.currentPage()
    const button = await page.$('.login-page__wechat-btn')
    if (!button) throw new Error('login button not found')

    const beforeClass = await button.attribute('class')
    result.observations.push({ step: 'before-tap', path: page.path, className: beforeClass })

    await button.tap()
    await sleep(300)

    const pageAfterTap = await miniProgram.currentPage()
    const buttonAfterTap = await pageAfterTap.$('.login-page__wechat-btn')
    const afterTapClass = buttonAfterTap ? await buttonAfterTap.attribute('class') : null
    result.observations.push({ step: '300ms-after-tap', path: pageAfterTap.path, className: afterTapClass })

    await sleep(1200)
    const pageAfter1_5s = await miniProgram.currentPage()
    const buttonAfter1_5s = await pageAfter1_5s.$('.login-page__wechat-btn')
    const after1_5sClass = buttonAfter1_5s ? await buttonAfter1_5s.attribute('class') : null
    result.observations.push({ step: '1500ms-after-tap', path: pageAfter1_5s.path, className: after1_5sClass })
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
