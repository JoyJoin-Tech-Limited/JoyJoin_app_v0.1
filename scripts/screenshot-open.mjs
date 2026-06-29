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
      env: { ...process.env, TARO_APP_API_BASE_URL: 'http://localhost:5001' },
    }
  )
  await new Promise((resolve, reject) => {
    build.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`H5 build failed with code ${code}`))
    })
  })

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
