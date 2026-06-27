import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const OUTPUT_DIR = path.resolve(process.cwd(), 'screenshots')
fs.mkdirSync(OUTPUT_DIR, { recursive: true })

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
})
const page = await context.newPage()

await page.goto(
  'http://localhost:5001/#/pages/icebreaker-session/tier-selector/index?sessionId=test-screenshot-123',
  { waitUntil: 'networkidle' },
)

await page.waitForSelector('.tier-selector__preset-list', { timeout: 10000 })
await page.waitForTimeout(1000)

const screenshotPath = path.join(OUTPUT_DIR, 'tier-selector-preset-cards.png')
await page.screenshot({ path: screenshotPath, fullPage: true })

console.log('Screenshot saved:', screenshotPath)
await browser.close()
