#!/usr/bin/env node
/**
 * mockup-composite.mjs — wraps raw H5 screen captures in iPhone device frames
 * and renders marketing compositions (singles + angled 3-phone groups) on the
 * JoyJoin brand gradient.
 *
 * Usage:
 *   node scripts/mockup-composite.mjs \
 *     --raw <dir-with-raw-pngs> --out <output-dir>
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

function arg(name, fallback) {
  const idx = process.argv.indexOf(`--${name}`)
  return idx > -1 ? process.argv[idx + 1] : fallback
}

const RAW_DIR = path.resolve(arg('raw', path.join(ROOT, 'mockups/raw')))
const OUT_DIR = path.resolve(arg('out', path.join(ROOT, 'mockups/final')))

const SINGLES = [
  'personality-results',
  'discover-pools',
  'event-ticket-payment',
  'squad-unboxing-revealed',
  'icebreaker-micro-challenge',
  'profile-v17',
  'my-image-v17',
]

const GROUPS = [
  {
    name: 'group-a-before-event',
    caption: '测出命格 · 发现同频 · 锁定席位',
    screens: ['personality-results', 'discover-pools', 'event-ticket-payment'],
  },
  {
    name: 'group-b-event-night',
    caption: '同桌揭晓 · 破冰开玩 · 沉淀自己',
    screens: ['squad-unboxing-revealed', 'icebreaker-micro-challenge', 'profile-v17'],
  },
]

const GRADIENT =
  'linear-gradient(160deg, #FDF6EC 0%, #FBEAF1 38%, #F3EBFD 72%, #EDE4FB 100%)'

function imgDataUri(name) {
  const file = path.join(RAW_DIR, `${name}.png`)
  return `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`
}

function phoneHtml(imgSrc, widthPx, { rotate = 0, zIndex = 1, offsetX = 0, offsetY = 0 } = {}) {
  const bezel = Math.round(widthPx * 0.035)
  const screenW = widthPx - bezel * 2
  const screenH = Math.round(screenW * (844 / 390))
  const phoneH = screenH + bezel * 2
  const phoneRadius = Math.round(widthPx * 0.14)
  const screenRadius = Math.round(widthPx * 0.105)
  const islandW = Math.round(screenW * 0.32)
  const islandH = Math.round(islandW * 0.3)
  return `
    <div class="phone" style="
      width:${widthPx}px; height:${phoneH}px; border-radius:${phoneRadius}px;
      transform: rotate(${rotate}deg) translate(${offsetX}px, ${offsetY}px);
      z-index:${zIndex};
    ">
      <div class="screen" style="
        left:${bezel}px; top:${bezel}px;
        width:${screenW}px; height:${screenH}px; border-radius:${screenRadius}px;
      "><img class="screen-img" src="${imgSrc}" style="
        width:${screenW}px; height:${screenH}px; object-fit:cover; object-position:top center;
        display:block;
      "></div>
      <div class="island" style="
        width:${islandW}px; height:${islandH}px;
        top:${bezel + Math.round(screenH * 0.014)}px;
        left:${Math.round((widthPx - islandW) / 2)}px;
        border-radius:${Math.round(islandH / 2)}px;
      "></div>
    </div>`
}

const BASE_CSS = `
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: -apple-system, 'PingFang SC', sans-serif; }
  .stage { width:100vw; height:100vh; background:${GRADIENT}; position:relative; overflow:hidden; }
  .glow { position:absolute; border-radius:50%; filter: blur(120px); opacity:.55; }
  .glow-a { width:900px; height:900px; background:#FFD9E8; left:-220px; top:-260px; }
  .glow-b { width:820px; height:820px; background:#DCC9F7; right:-240px; bottom:-280px; }
  .phone {
    position:relative; background:#101014;
    box-shadow: 0 40px 90px rgba(80, 52, 120, .28), 0 12px 28px rgba(80, 52, 120, .18);
    flex:none;
  }
  .phone::after {
    content:''; position:absolute; inset:0; border-radius:inherit;
    box-shadow: inset 0 0 0 2px rgba(255,255,255,.10);
    pointer-events:none;
  }
  .screen {
    position:absolute; background-size:cover; background-position:top center;
    background-color:#fff; overflow:hidden;
  }
  .island { position:absolute; background:#101014; z-index:2; }
  .caption {
    position:absolute; left:0; right:0; bottom:56px; text-align:center;
    font-size:30px; letter-spacing:.35em; color:#7A5FA8; font-weight:600;
  }
`

function singlePageHtml(name) {
  const img = imgDataUri(name)
  return `<!doctype html><html><head><meta charset="utf-8"><style>${BASE_CSS}
    .stage { display:flex; align-items:center; justify-content:center; }
  </style></head><body>
    <div class="stage">
      <div class="glow glow-a"></div><div class="glow glow-b"></div>
      ${phoneHtml(img, 460)}
    </div>
  </body></html>`
}

function groupPageHtml(group) {
  const [a, b, c] = group.screens.map((s) => imgDataUri(s))
  return `<!doctype html><html><head><meta charset="utf-8"><style>${BASE_CSS}
    .stage { display:flex; align-items:center; justify-content:center; }
    .fan { display:flex; align-items:center; }
    .fan .phone + .phone { margin-left:-150px; }
  </style></head><body>
    <div class="stage">
      <div class="glow glow-a"></div><div class="glow glow-b"></div>
      <div class="fan">
        ${phoneHtml(a, 400, { rotate: -10, zIndex: 1, offsetY: 40 })}
        ${phoneHtml(b, 430, { rotate: 0, zIndex: 3, offsetY: -26 })}
        ${phoneHtml(c, 400, { rotate: 10, zIndex: 2, offsetY: 40 })}
      </div>
      <div class="caption">${group.caption}</div>
    </div>
  </body></html>`
}

async function render(browser, html, outFile, width, height) {
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: 2,
  })
  await page.setContent(html, { waitUntil: 'load' })
  await page.waitForFunction(
    () =>
      Array.from(document.querySelectorAll('.screen-img')).every(
        (img) => img.complete && img.naturalWidth > 0,
      ),
    undefined,
    { timeout: 30000 },
  )
  await page.waitForTimeout(300)
  await page.screenshot({ path: outFile })
  await page.close()
  console.log(`[mockup] wrote ${path.relative(ROOT, outFile)}`)
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const missing = [...SINGLES, ...GROUPS.flatMap((g) => g.screens)].filter(
    (s) => !fs.existsSync(path.join(RAW_DIR, `${s}.png`)),
  )
  if (missing.length > 0) {
    console.error(`[mockup] missing raw captures: ${[...new Set(missing)].join(', ')}`)
    process.exit(1)
  }

  const browser = await chromium.launch({ headless: true })
  for (const name of SINGLES) {
    await render(browser, singlePageHtml(name), path.join(OUT_DIR, `${name}-iphone.png`), 1280, 1280)
  }
  for (const group of GROUPS) {
    await render(browser, groupPageHtml(group), path.join(OUT_DIR, `${group.name}.png`), 1920, 1280)
  }
  await browser.close()
}

main().catch((err) => {
  console.error('[mockup] failed:', err)
  process.exit(1)
})
