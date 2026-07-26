#!/usr/bin/env node
import { spawn, execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const PAGES = {
  events: {
    url: 'http://localhost:9000/events-footprint-oracle-card.png',
    altPort: 9003,
  },
  'tier-selector': {
    url: 'http://localhost:9000/tier-selector-preset-cards.png',
    altPort: 9003,
  },
  'pool-registration': {
    url: 'http://localhost:9000/pool-registration-step-0-brief.png',
    altPort: 9003,
  },
  'event-ticket-payment': {
    url: 'http://localhost:9000/event-ticket-payment.png',
    altPort: 9003,
  },
  'squad-unboxing': {
    url: 'http://localhost:9000/squad-unboxing-revealed.png',
    altPort: 9003,
  },
  'squad-unboxing-ready': {
    url: 'http://localhost:9000/squad-unboxing-ready.png',
    altPort: 9003,
  },
  'squad-unboxing-shaking': {
    url: 'http://localhost:9000/squad-unboxing-shaking.png',
    altPort: 9003,
  },
  'profile-review': {
    url: 'http://localhost:9000/profile-review-welcome-coupon.png',
    altPort: 9003,
  },
  'icebreaker-micro-challenge': { url: 'http://localhost:9000/icebreaker-micro-challenge.png', altPort: 9003 },
  'icebreaker-lie-detective': { url: 'http://localhost:9000/icebreaker-lie-detective.png', altPort: 9003 },
  'icebreaker-auction': { url: 'http://localhost:9000/icebreaker-auction.png', altPort: 9003 },
  'icebreaker-personality-dice': { url: 'http://localhost:9000/icebreaker-personality-dice.png', altPort: 9003 },
  'icebreaker-speed-friending': { url: 'http://localhost:9000/icebreaker-speed-friending.png', altPort: 9003 },
  'icebreaker-fuse': { url: 'http://localhost:9000/icebreaker-fuse.png', altPort: 9003 },
  'icebreaker-stall': { url: 'http://localhost:9000/icebreaker-stall.png', altPort: 9003 },
  'icebreaker-recap': { url: 'http://localhost:9000/icebreaker-recap.png', altPort: 9003 },
  'icebreaker-warmup-mood': { url: 'http://localhost:9000/icebreaker-warmup-mood.png', altPort: 9003 },
  'icebreaker-warmup-topic': { url: 'http://localhost:9000/icebreaker-warmup-topic.png', altPort: 9003 },
  'icebreaker-warmup-generating': { url: 'http://localhost:9000/icebreaker-warmup-generating.png', altPort: 9003 },
  'icebreaker-warmup-error': { url: 'http://localhost:9000/icebreaker-warmup-error.png', altPort: 9003 },
}

const page = process.argv[2] || 'events'

if (page === '--help' || page === '-h') {
  console.log('Usage: npm run screenshot:<page>')
  console.log('Available pages:')
  Object.keys(PAGES).forEach(k => console.log(`  - ${k}: ${PAGES[k].url}`))
  console.log('\nExamples:')
  console.log('  npm run screenshot:events')
  console.log('  npm run screenshot:tier-selector')
  process.exit(0)
}

const config = PAGES[page]
if (!config) {
  console.error(`Unknown screenshot page: "${page}"`)
  console.error(`Available: ${Object.keys(PAGES).join(', ')}`)
  process.exit(1)
}

function run(command, args, options = {}) {
  return spawn(command, args, {
    stdio: options.silent ? 'ignore' : 'inherit',
    shell: false,
    ...options,
  })
}

function killByName(name) {
  try {
    execSync(`pkill -f "${name}"`, { stdio: 'ignore' })
  } catch {
    // ignore if no process found
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function findFreePort(startPort) {
  const net = await import('node:net')
  return new Promise((resolve) => {
    const server = net.createServer()
    server.listen(startPort, () => {
      const port = server.address().port
      server.close(() => resolve(port))
    })
    server.on('error', () => {
      resolve(findFreePort(startPort + 1))
    })
  })
}

async function main() {
  console.log(`[screenshot-open] page: ${page}`)
  console.log('[screenshot-open] cleaning up existing servers...')
  killByName('mock-h5-server.mjs')
  killByName('screenshot-server.mjs')
  await sleep(1000)

  console.log('[screenshot-open] building H5...')
  const build = run(
    'npm',
    ['run', 'build:h5', '--workspace=mini-program'],
    {
      cwd: ROOT,
      env: {
        ...process.env,
        TARO_APP_API_BASE_URL: 'http://localhost:5001',
        TARO_APP_ENABLE_STORY_MODE: 'true',
      },
    }
  )
  await new Promise((resolve, reject) => {
    build.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`H5 build failed with code ${code}`))
    })
  })

  // Profile-review screenshot needs the Lovart coupon image bundled in the H5
  // dist so the gift card renders; the default H5 build does not copy it.
  if (page === 'profile-review') {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const src = path.join(ROOT, 'apps/mini-program/src/assets/lovart/gift-card/coupon.webp')
    const dest = path.join(ROOT, 'apps/mini-program/dist/assets/lovart/gift-card/coupon.webp')
    if (fs.existsSync(src)) {
      fs.mkdirSync(path.dirname(dest), { recursive: true })
      fs.copyFileSync(src, dest)
      console.log('[screenshot-open] copied coupon image to H5 dist')
    }
  }

  console.log('[screenshot-open] starting mock server on port 5001...')
  const mockServer = run('node', ['scripts/mock-h5-server.mjs'], {
    cwd: ROOT,
    silent: true,
  })

  const screenshotPort = await findFreePort(9000)
  console.log(`[screenshot-open] starting screenshot server on port ${screenshotPort}...`)
  const screenshotServer = run('node', ['scripts/screenshot-server.mjs'], {
    cwd: ROOT,
    env: { ...process.env, SCREENSHOT_PORT: String(screenshotPort) },
    silent: true,
  })

  await sleep(2000)

  const url = config.url.replace('localhost:9000', `localhost:${screenshotPort}`)
  console.log(`[screenshot-open] opening ${url}`)

  try {
    execSync(`open "${url}"`, { stdio: 'ignore' })
  } catch {
    console.log(`[screenshot-open] please open manually: ${url}`)
  }

  console.log('\n[screenshot-open] press Enter to stop servers and exit...')
  process.stdin.resume()
  await new Promise((resolve) => {
    process.stdin.once('data', resolve)
  })

  console.log('[screenshot-open] shutting down...')
  mockServer.kill()
  screenshotServer.kill()
  await sleep(500)
  process.exit(0)
}

main().catch((err) => {
  console.error('[screenshot-open] failed:', err)
  process.exit(1)
})
