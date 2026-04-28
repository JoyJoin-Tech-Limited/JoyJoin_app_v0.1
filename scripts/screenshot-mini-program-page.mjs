#!/usr/bin/env node
/**
 * One-shot mini-program page screenshot workflow
 *
 * Builds the H5 target, starts the mock server, and prints the Playwright URL.
 *
 * Usage:
 *   node scripts/screenshot-mini-program-page.mjs <page-path>
 *
 * Examples:
 *   node scripts/screenshot-mini-program-page.mjs pages/discover/index
 *   node scripts/screenshot-mini-program-page.mjs pages/profile/index
 */

import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const pagePath = process.argv[2]

if (!pagePath) {
  console.error('Usage: node screenshot-mini-program-page.mjs <page-path>')
  console.error('Example: node screenshot-mini-program-page.mjs pages/discover/index')
  process.exit(1)
}

console.log(`📸 Screenshot workflow for: ${pagePath}`)
console.log('')

// Step 1: Build H5
console.log('Step 1/3: Building H5 target...')
const build = spawn('npx', ['taro', 'build', '--type', 'h5'], {
  cwd: path.resolve(__dirname, '../apps/mini-program'),
  env: { ...process.env, TARO_APP_API_BASE_URL: 'http://localhost:5001' },
  stdio: 'inherit',
})

await new Promise((resolve, reject) => {
  build.on('close', (code) => {
    if (code === 0) resolve()
    else reject(new Error(`Build failed with code ${code}`))
  })
})

console.log('')
console.log('Step 2/3: Starting mock server...')
const mockServer = spawn('node', [path.resolve(__dirname, 'mock-h5-server.mjs')], {
  detached: true,
  stdio: 'ignore',
})
mockServer.unref()

// Wait for server to start
await new Promise((r) => setTimeout(r, 2000))

console.log('')
console.log('Step 3/3: Ready for screenshot')
console.log('')
console.log('Playwright commands:')
console.log(`  playwright_navigate({ url: "http://localhost:5001/#/${pagePath}" })`)
console.log(`  playwright_screenshot({ name: "${pagePath.replace(/\//g, '-')}", savePng: true })`)
console.log('')
console.log('Remember to clear storage if auth was cached:')
console.log(`  playwright_evaluate({ script: "localStorage.clear(); sessionStorage.clear(); location.reload();" })`)
console.log('')
console.log('Mock server PID:', mockServer.pid)
console.log('Kill server when done: kill', mockServer.pid)
