#!/usr/bin/env node
// @ts-check
/**
 * Smoke test: matching-status "查看活动详情" CTA
 *
 * Builds the mini-program H5, starts the mock API server, navigates to the
 * matched matching-status page in a headless browser, clicks the main CTA, and
 * verifies the browser navigates to the expected destination.
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'
import { chromium } from 'playwright'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../..')
const MOCK_PORT = 5001
const H5_BASE_URL = `http://localhost:${MOCK_PORT}`

function run(command, args, options = {}) {
  return spawn(command, args, {
    stdio: options.silent ? 'ignore' : 'inherit',
    shell: false,
    ...options,
  })
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function killByName(name) {
  return new Promise((resolve) => {
    const p = spawn('pkill', ['-f', name], { stdio: 'ignore' })
    p.on('close', () => resolve(undefined))
    p.on('error', () => resolve(undefined))
  })
}

async function buildH5() {
  console.log('[smoke] building H5...')
  const build = run(
    'npm',
    ['run', 'build:h5', '--workspace=mini-program'],
    {
      cwd: ROOT,
      env: {
        ...process.env,
        TARO_APP_API_BASE_URL: `http://localhost:${MOCK_PORT}`,
        TARO_APP_ENABLE_STORY_MODE: 'true',
      },
    }
  )
  return new Promise((resolve, reject) => {
    build.on('close', (code) => {
      if (code === 0) resolve(undefined)
      else reject(new Error(`H5 build failed with code ${code}`))
    })
  })
}

async function startMockServer() {
  console.log('[smoke] starting mock server...')
  const mock = run('node', ['scripts/mock-h5-server.mjs'], {
    cwd: ROOT,
    silent: true,
  })
  // Wait for server to be ready
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`${H5_BASE_URL}/api/health`)
      if (res.ok) {
        console.log('[smoke] mock server ready')
        return mock
      }
    } catch {
      // not ready yet
    }
    await sleep(500)
  }
  throw new Error('Mock server failed to start')
}

async function saveDiagnostic(page, scenario) {
  const diagnosticPng = path.resolve(ROOT, `scripts/smoke/matching-status-${scenario}-diagnostic.png`)
  const diagnosticHtml = path.resolve(ROOT, `scripts/smoke/matching-status-${scenario}-diagnostic.html`)
  await page.screenshot({ path: diagnosticPng, fullPage: true })
  const html = await page.content()
  await fs.writeFile(diagnosticHtml, html, 'utf-8')
  console.error(`[smoke] diagnostic screenshot: ${diagnosticPng}`)
  console.error(`[smoke] diagnostic HTML: ${diagnosticHtml}`)
}

/**
 * @param {string} scenario - 'unrevealed' or 'revealed'
 */
async function runScenario(scenario) {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  })
  const page = await context.newPage()

  try {
    const url =
      `${H5_BASE_URL}/#/pages/matching-status/index` +
      '?registrationId=reg-screenshot-001&motion=reduce'

    console.log(`[smoke] scenario: ${scenario} -> navigating to ${url}`)

    // Clear storage, then seed reveal flag if needed, before navigating.
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.evaluate(() => {
      localStorage.clear()
      sessionStorage.clear()
    })
    if (scenario === 'revealed') {
      await page.evaluate(() => {
        localStorage.setItem('jj_revealed_group-screenshot-001', 'true')
      })
    }

    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })

    if (scenario === 'unrevealed') {
      // In the unrevealed state the page auto-triggers the live-reveal overlay,
      // so the main CTA is not visible. We verify the overlay appears and that
      // tapping its primary button advances the flow.
      const overlayBtn = page.locator('button', { hasText: '准备开始揭晓' })
      try {
        await overlayBtn.waitFor({ state: 'visible', timeout: 15000 })
      } catch (err) {
        console.error(`[smoke] scenario: ${scenario} -> live-reveal overlay not visible`)
        await saveDiagnostic(page, scenario)
        throw err
      }
      console.log(`[smoke] scenario: ${scenario} -> live-reveal overlay visible`)

      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }),
        overlayBtn.click(),
      ])

      const currentPath = new URL(page.url()).hash
      console.log(`[smoke] scenario: ${scenario} -> navigated to ${currentPath}`)

      // The overlay can route to either the reveal prelude or directly to the
      // squad unboxing / pool group detail page depending on the current flow.
      const validDestinations = [
        '#/pages/squad-unboxing/index',
        '#/pages/pool-group-detail/index',
        '#/pages/matching-status/index', // still on the same page during in-page transition
      ]
      if (!validDestinations.some((d) => currentPath.startsWith(d))) {
        throw new Error(`Expected overlay navigation, got ${currentPath}`)
      }

      const screenshotPath = path.resolve(ROOT, `scripts/smoke/matching-status-${scenario}.png`)
      await page.screenshot({ path: screenshotPath, fullPage: true })
      console.log(`[smoke] scenario: ${scenario} -> screenshot saved to ${screenshotPath}`)
      return { scenario, passed: true, destination: currentPath }
    }

    // Revealed scenario: main CTA "查看活动详情" should be visible.
    const cta = page.locator('.matching-status__cta-btn', { hasText: '查看活动详情' })
    try {
      await cta.waitFor({ state: 'visible', timeout: 15000 })
    } catch (err) {
      console.error(`[smoke] scenario: ${scenario} -> CTA not visible after 15s`)
      await saveDiagnostic(page, scenario)
      throw err
    }
    console.log(`[smoke] scenario: ${scenario} -> CTA visible`)

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }),
      cta.click(),
    ])

    const currentPath = new URL(page.url()).hash
    console.log(`[smoke] scenario: ${scenario} -> navigated to ${currentPath}`)

    const expected = '#/pages/pool-group-detail/index'
    if (!currentPath.startsWith(expected)) {
      throw new Error(`Expected navigation to ${expected}, got ${currentPath}`)
    }

    const screenshotPath = path.resolve(ROOT, `scripts/smoke/matching-status-${scenario}.png`)
    await page.screenshot({ path: screenshotPath, fullPage: true })
    console.log(`[smoke] scenario: ${scenario} -> screenshot saved to ${screenshotPath}`)

    return { scenario, passed: true, destination: currentPath }
  } finally {
    await browser.close()
  }
}

async function main() {
  const skipBuild = process.argv.includes('--skip-build')

  await killByName('mock-h5-server.mjs')
  await sleep(500)

  if (!skipBuild) {
    await buildH5()
  } else {
    console.log('[smoke] skipping H5 build (--skip-build)')
  }
  const mock = await startMockServer()

  const results = []
  try {
    // Run revealed first: this is the exact state the user reported.
    results.push(await runScenario('revealed'))
    results.push(await runScenario('unrevealed'))
  } finally {
    console.log('[smoke] shutting down mock server...')
    mock.kill()
    await sleep(500)
  }

  const failed = results.filter((r) => !r.passed)
  if (failed.length > 0) {
    console.error('[smoke] FAILED:', failed)
    process.exit(1)
  }

  console.log('[smoke] PASSED: all scenarios navigated correctly')
  console.table(results)
}

main().catch((err) => {
  console.error('[smoke] error:', err)
  process.exit(1)
})
