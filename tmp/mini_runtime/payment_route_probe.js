const fs = require('fs')
const automator = require('miniprogram-automator')

const outputPath = process.argv[2]
const wsEndpoint = 'ws://127.0.0.1:9420'

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function currentPath(mp) {
  const page = await mp.currentPage()
  return page ? page.path : null
}

async function run() {
  const result = { ok: true, steps: [], errors: [] }
  let miniProgram = null
  try {
    miniProgram = await require('miniprogram-automator').connect({ wsEndpoint })
    await miniProgram.callWxMethod('clearStorageSync')

    const push = async (label) => {
      result.steps.push({ label, path: await currentPath(miniProgram) })
    }

    await miniProgram.callWxMethod('reLaunch', { url: '/pages/events/index' })
    await sleep(1500)
    await push('after-events-relaunch')

    try {
      const callResult = await miniProgram.callWxMethod('reLaunch', { url: '/pages/blind-box-payment/index' })
      result.steps.push({ label: 'payment-relaunch-call-result', callResult })
    } catch (error) {
      result.ok = false
      result.errors.push({ label: 'payment-relaunch-call-error', error: error && error.stack ? error.stack : String(error) })
    }

    await push('immediately-after-payment-relaunch')
    await sleep(1000)
    await push('1s-after-payment-relaunch')
    await sleep(2000)
    await push('3s-after-payment-relaunch')
    await sleep(4000)
    await push('7s-after-payment-relaunch')
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
