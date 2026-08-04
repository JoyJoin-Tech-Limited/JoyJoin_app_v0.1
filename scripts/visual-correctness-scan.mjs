#!/usr/bin/env node
/**
 * Deterministic visual-correctness scanner for JoyJoin frontend surfaces.
 *
 * Renders a page with Playwright and MEASURES the DOM for correctness defects
 * that code-reading audits structurally miss: text overflow/truncation,
 * element overlap, clipping, low contrast, and off-screen / page-horizontal
 * overflow. No LLM, no vibe — every finding carries a selector + measurement.
 *
 * This is Layer 1 of the "Rendered-Truth Visual Gate". It catches *correctness*
 * defects (broken UI). Subjective *craft* (breathing room, premium feel) is
 * judged separately by a vision reviewer — see
 * .github/skills/frontend-design-audit/references/visual-correctness-gate.md
 *
 * Usage:
 *   node scripts/visual-correctness-scan.mjs --url <h5url> --wait <css-selector> [options]
 *
 * Options:
 *   --url <url>         Full URL to render (required). For mini-program H5 use the hash route.
 *   --wait <selector>   CSS selector to wait for before measuring (recommended).
 *   --viewport <WxH>    Viewport size, default 390x844 (iPhone 13).
 *   --settle <ms>       Extra settle time after --wait, default 1200.
 *   --screenshot <png>  Also write a full-page screenshot to this path.
 *   --pretty            Pretty-print the JSON report.
 *   --max <n>           Max violations per check (default 25) to bound output.
 *
 * Exit code: 0 = no blocking defects, 1 = ≥1 blocking defect, 2 = runtime error.
 *
 * Examples:
 *   node scripts/visual-correctness-scan.mjs \
 *     --url "http://localhost:5001/#/pages/events/index" \
 *     --wait ".events-page__list" --screenshot /tmp/events.png --pretty
 */

import { chromium } from 'playwright'
import { existsSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

// ─── CLI parsing ─────────────────────────────────────────────────

function parseArgs(argv) {
  const args = {
    url: null,
    wait: null,
    viewport: '390x844',
    settle: 1200,
    screenshot: null,
    pretty: false,
    max: 25,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--url') args.url = argv[++i]
    else if (a === '--wait') args.wait = argv[++i]
    else if (a === '--viewport') args.viewport = argv[++i]
    else if (a === '--settle') args.settle = Number(argv[++i])
    else if (a === '--screenshot') args.screenshot = argv[++i]
    else if (a === '--pretty') args.pretty = true
    else if (a === '--max') args.max = Number(argv[++i])
    else if (a === '--help' || a === '-h') {
      console.log('See header comment for usage.')
      process.exit(0)
    }
  }
  return args
}

// ─── In-page measurement (must be fully self-contained) ──────────
//
// Returns an array of violations:
//   { check, severity, selector, message, rect, details }
// severity: 'blocking' (broken UI) | 'advisory' (worth a look, often intentional)

function measureInPage(maxPerCheck) {
  const violations = []
  const vw = window.innerWidth
  const vh = window.innerHeight

  const cap = (check) => violations.filter(v => v.check === check).length < maxPerCheck

  function cssPath(el) {
    if (el.id) return `#${el.id}`
    const parts = []
    let node = el
    let depth = 0
    while (node && node.nodeType === 1 && depth < 5) {
      let part = node.tagName.toLowerCase()
      const cls = (node.className && typeof node.className === 'string')
        ? node.className.trim().split(/\s+/).filter(Boolean).slice(0, 2).join('.')
        : ''
      if (cls) part += `.${cls}`
      const parent = node.parentElement
      if (parent) {
        const sameTag = Array.from(parent.children).filter(c => c.tagName === node.tagName)
        if (sameTag.length > 1) part += `:nth-of-type(${sameTag.indexOf(node) + 1})`
      }
      parts.unshift(part)
      node = parent
      depth++
    }
    return parts.join(' > ')
  }

  function rectOf(el) {
    const r = el.getBoundingClientRect()
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
      right: Math.round(r.right), bottom: Math.round(r.bottom) }
  }

  function visibleRectOf(el) {
    const source = el.getBoundingClientRect()
    let left = Math.max(0, source.left)
    let top = source.top
    let right = Math.min(vw, source.right)
    let bottom = source.bottom
    let node = el.parentElement

    while (node && node.nodeType === 1 && right > left && bottom > top) {
      const nodeStyle = getComputedStyle(node)
      const nodeRect = node.getBoundingClientRect()
      if (['hidden', 'clip', 'auto', 'scroll'].includes(nodeStyle.overflowX)) {
        left = Math.max(left, nodeRect.left)
        right = Math.min(right, nodeRect.right)
      }
      if (['hidden', 'clip', 'auto', 'scroll'].includes(nodeStyle.overflowY)) {
        top = Math.max(top, nodeRect.top)
        bottom = Math.min(bottom, nodeRect.bottom)
      }
      node = node.parentElement
    }

    return {
      left,
      top,
      right,
      bottom,
      width: Math.max(0, right - left),
      height: Math.max(0, bottom - top),
    }
  }

  function isVisible(el, style) {
    let node = el
    while (node && node.nodeType === 1) {
      const nodeStyle = node === el ? style : getComputedStyle(node)
      if (node.hidden || node.getAttribute('aria-hidden') === 'true') return false
      if (nodeStyle.display === 'none' || nodeStyle.visibility === 'hidden') return false
      if (parseFloat(nodeStyle.opacity) === 0) return false
      node = node.parentElement
    }
    const r = el.getBoundingClientRect()
    // Screen-reader-only copy is deliberately clipped to a 1px box. It is
    // reachable to assistive technology and must not be reported as visual UI.
    if (r.width <= 1 && r.height <= 1 &&
        (style.overflow === 'hidden' || style.clip !== 'auto' || style.clipPath !== 'none')) {
      return false
    }
    const visible = visibleRectOf(el)
    return r.width > 0 && r.height > 0 && visible.width > 0 && visible.height > 0
  }

  // direct visible text content (own text nodes), trimmed
  function ownText(el) {
    let t = ''
    for (const n of el.childNodes) {
      if (n.nodeType === 3) t += n.textContent
    }
    return t.trim()
  }

  function push(v) {
    if (cap(v.check)) violations.push(v)
  }

  // ── 1. Page horizontal overflow (content wider than viewport) ──
  const docW = Math.max(document.documentElement.scrollWidth, document.body ? document.body.scrollWidth : 0)
  if (docW > vw + 2) {
    push({
      check: 'page-horizontal-overflow',
      severity: 'blocking',
      selector: 'document',
      message: `Page is ${docW - vw}px wider than the viewport — horizontal scroll / clipped content`,
      rect: { x: 0, y: 0, w: docW, h: vh },
      details: { scrollWidth: docW, viewportWidth: vw },
    })
  }

  const all = Array.from(document.querySelectorAll('body *'))
  const textEls = []

  for (const el of all) {
    const style = getComputedStyle(el)
    if (!isVisible(el, style)) continue
    const r = el.getBoundingClientRect()

    // ── 2. Element bleeding past the right viewport edge ──
    if (r.right > vw + 2 && r.width > 0 && r.left < vw) {
      // ignore full-bleed wrappers that are meant to be wider (rare); only flag
      // when the element's own box crosses the edge while starting on-screen.
      if (cap('element-off-right-edge')) {
        push({
          check: 'element-off-right-edge',
          severity: 'blocking',
          selector: cssPath(el),
          message: `Element extends ${Math.round(r.right - vw)}px past the right edge of the viewport`,
          rect: rectOf(el),
          details: { right: Math.round(r.right), viewportWidth: vw },
        })
      }
    }

    // collect text-bearing elements for overflow / overlap / contrast checks
    const txt = ownText(el)
    if (txt) {
      textEls.push({ el, style, r, visibleR: visibleRectOf(el), txt })

      // ── 3. Horizontal text clipping ──
      const overflowX = style.overflowX
      if ((overflowX === 'hidden' || overflowX === 'clip') && el.scrollWidth > el.clientWidth + 2) {
        const hasEllipsis = style.textOverflow === 'ellipsis'
        push({
          check: 'text-clip-horizontal',
          severity: hasEllipsis ? 'advisory' : 'blocking',
          selector: cssPath(el),
          message: hasEllipsis
            ? `Text truncated with ellipsis ("${txt.slice(0, 24)}…") — confirm this is intentional`
            : `Text clipped horizontally with no ellipsis — "${txt.slice(0, 24)}…" is unreadable`,
          rect: rectOf(el),
          details: { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth, ellipsis: hasEllipsis },
        })
      }

      // ── 4. Vertical text clipping ──
      const overflowY = style.overflowY
      if ((overflowY === 'hidden' || overflowY === 'clip') && el.scrollHeight > el.clientHeight + 2) {
        // line-clamp is an intentional pattern; treat as advisory
        const isClamp = style.webkitLineClamp && style.webkitLineClamp !== 'none'
        push({
          check: 'text-clip-vertical',
          severity: isClamp ? 'advisory' : 'blocking',
          selector: cssPath(el),
          message: isClamp
            ? `Text clamped to ${style.webkitLineClamp} line(s) — confirm intentional`
            : `Text clipped vertically — content is cut off and unreachable`,
          rect: rectOf(el),
          details: { scrollHeight: el.scrollHeight, clientHeight: el.clientHeight, lineClamp: style.webkitLineClamp },
        })
      }

      // ── 5. Low contrast text ──
      const fg = parseRGB(style.color)
      const bg = effectiveBackground(el)
      if (fg && bg) {
        const ratio = contrastRatio(fg, bg)
        const fontSize = parseFloat(style.fontSize)
        const fontWeight = parseInt(style.fontWeight, 10) || 400
        const isLarge = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700)
        const threshold = isLarge ? 3.0 : 4.5
        if (ratio < threshold) {
          push({
            check: 'low-contrast-text',
            severity: ratio < (isLarge ? 2.4 : 3.0) ? 'blocking' : 'advisory',
            selector: cssPath(el),
            message: `Contrast ${ratio.toFixed(2)}:1 (needs ≥${threshold}:1) — "${txt.slice(0, 20)}…"`,
            rect: rectOf(el),
            details: { ratio: Number(ratio.toFixed(2)), threshold, color: style.color, background: bg.css },
          })
        }
      }
    }
  }

  // ── 6. Text-on-text overlap (high-precision heuristic) ──
  // Two visible text elements whose boxes intersect substantially, neither
  // containing the other, with different content — almost always a collision bug.
  //
  // Occlusion guard: a modal/overlay layer (fixed/absolute + explicit z-index
  // + opaque background) fully covers lower layers, so a geometric
  // intersection with a covered element is NOT a visible collision. Without
  // this guard every legitimate overlay page (e.g. ExperienceDetail over
  // FlowShell) fails the gate with false blocking violations.
  function opaqueLayerOf(el) {
    let node = el.parentElement
    while (node && node !== document.body) {
      const s = getComputedStyle(node)
      if ((s.position === 'fixed' || s.position === 'absolute') && s.zIndex !== 'auto') {
        const z = parseInt(s.zIndex, 10)
        if (!Number.isNaN(z)) {
          const bg = parseRGB(s.backgroundColor)
          return { node, z, opaque: Boolean(bg && bg.a >= 0.95) }
        }
      }
      node = node.parentElement
    }
    return null
  }

  function occludedByHigherLayer(lower, higher) {
    const lz = opaqueLayerOf(lower)
    const hz = opaqueLayerOf(higher)
    return Boolean(lz && hz && lz.node !== hz.node && lz.z < hz.z && hz.opaque)
  }

  const sample = textEls.slice(0, 400)
  for (let i = 0; i < sample.length; i++) {
    for (let j = i + 1; j < sample.length; j++) {
      if (!cap('text-on-text-overlap')) break
      const a = sample[i]
      const b = sample[j]
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue
      if (a.txt === b.txt) continue
      const ar = a.visibleR
      const br = b.visibleR
      const ix = Math.max(0, Math.min(ar.right, br.right) - Math.max(ar.left, br.left))
      const iy = Math.max(0, Math.min(ar.bottom, br.bottom) - Math.max(ar.top, br.top))
      if (ix <= 0 || iy <= 0) continue
      const inter = ix * iy
      const minArea = Math.min(ar.width * ar.height, br.width * br.height)
      if (minArea <= 0) continue
      // require a meaningful overlap of the smaller element's text box
      if (inter / minArea > 0.4 && iy > 6 && ix > 6) {
        // Skip pairs where one side is painted over by the other's opaque,
        // higher-z overlay — real for stacked modals, not a collision.
        if (occludedByHigherLayer(a.el, b.el) || occludedByHigherLayer(b.el, a.el)) continue
        push({
          check: 'text-on-text-overlap',
          severity: 'blocking',
          selector: `${cssPath(a.el)}  ⨯  ${cssPath(b.el)}`,
          message: `Text overlaps text: "${a.txt.slice(0, 16)}…" collides with "${b.txt.slice(0, 16)}…"`,
          rect: rectOf(a.el),
          details: { overlapPx: { x: Math.round(ix), y: Math.round(iy) }, other: cssPath(b.el) },
        })
      }
    }
    if (!cap('text-on-text-overlap')) break
  }

  // ── color helpers ──
  function parseRGB(str) {
    if (!str) return null
    const m = str.match(/rgba?\(([^)]+)\)/)
    if (!m) return null
    const parts = m[1].split(',').map(s => parseFloat(s.trim()))
    const a = parts.length > 3 ? parts[3] : 1
    if (a === 0) return null
    return { r: parts[0], g: parts[1], b: parts[2], a, css: str }
  }

  function effectiveBackground(el) {
    const layers = []
    let node = el
    while (node && node.nodeType === 1) {
      const s = getComputedStyle(node)
      const bgImg = s.backgroundImage
      if (bgImg && bgImg !== 'none' && /gradient|url\(/.test(bgImg)) {
        return null // gradient/image background — cannot compute reliably
      }
      const c = parseRGB(s.backgroundColor)
      if (c && c.a > 0) {
        layers.push(c)
        if (c.a >= 1) break
      }
      node = node.parentElement
    }

    let composed = { r: 255, g: 255, b: 255, a: 1, css: 'rgb(255, 255, 255)' }
    for (let i = layers.length - 1; i >= 0; i--) {
      const layer = layers[i]
      composed = {
        r: layer.r * layer.a + composed.r * (1 - layer.a),
        g: layer.g * layer.a + composed.g * (1 - layer.a),
        b: layer.b * layer.a + composed.b * (1 - layer.a),
        a: 1,
        css: layer.css,
      }
    }
    return composed
  }

  function srgbToLin(c) {
    c /= 255
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  }
  function luminance({ r, g, b }) {
    return 0.2126 * srgbToLin(r) + 0.7152 * srgbToLin(g) + 0.0722 * srgbToLin(b)
  }
  function contrastRatio(c1, c2) {
    // blend foreground over background if it has alpha
    const fg = c1.a < 1
      ? { r: c1.r * c1.a + c2.r * (1 - c1.a), g: c1.g * c1.a + c2.g * (1 - c1.a), b: c1.b * c1.a + c2.b * (1 - c1.a) }
      : c1
    const l1 = luminance(fg)
    const l2 = luminance(c2)
    const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1]
    return (hi + 0.05) / (lo + 0.05)
  }

  return violations
}

// ─── Main ────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!args.url) {
    console.error('Error: --url is required. Run with --help for usage.')
    process.exit(2)
  }
  const [w, h] = args.viewport.split('x').map(Number)
  if (!w || !h) {
    console.error(`Error: bad --viewport "${args.viewport}" (expected WxH, e.g. 390x844)`)
    process.exit(2)
  }

  let browser
  try {
    browser = await chromium.launch({
      headless: true,
      ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH
        ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
        : {}),
    })
    const geoLatitude = Number(process.env.PLAYWRIGHT_GEO_LATITUDE)
    const geoLongitude = Number(process.env.PLAYWRIGHT_GEO_LONGITUDE)
    const hasGeolocation = Number.isFinite(geoLatitude) && Number.isFinite(geoLongitude)
    const context = await browser.newContext({
      viewport: { width: w, height: h },
      deviceScaleFactor: 2,
      locale: 'zh-CN',
      reducedMotion: 'reduce',
      ...(hasGeolocation
        ? {
            permissions: ['geolocation'],
            geolocation: {
              latitude: geoLatitude,
              longitude: geoLongitude,
              accuracy: Number(process.env.PLAYWRIGHT_GEO_ACCURACY) || 18,
            },
          }
        : {}),
    })
    const page = await context.newPage()

    const localAssetRoot = process.env.PLAYWRIGHT_LOCAL_ASSET_ROOT
      ? path.resolve(process.env.PLAYWRIGHT_LOCAL_ASSET_ROOT)
      : null
    if (localAssetRoot) {
      await page.route('https://joyjoinapp.com/static/assets/**', async (route) => {
        const pathname = new URL(route.request().url()).pathname
        const relativePath = pathname.replace(/^\/static\/assets\//, '')
        const localPath = path.resolve(localAssetRoot, relativePath)
        const staysInAssetRoot = localPath.startsWith(`${localAssetRoot}${path.sep}`)

        if (staysInAssetRoot && existsSync(localPath)) {
          await route.fulfill({ path: localPath })
          return
        }

        await route.continue()
      })
    }

    await page.goto(args.url, { waitUntil: 'domcontentloaded', timeout: 60000 })
    if (args.wait) {
      try {
        await page.waitForSelector(args.wait, { state: 'visible', timeout: 15000 })
      } catch {
        console.error(`Warning: --wait selector "${args.wait}" not visible within 15s; measuring anyway.`)
      }
    }
    await page.waitForTimeout(args.settle)

    const violations = await page.evaluate(measureInPage, args.max)

    let screenshotPath = null
    if (args.screenshot) {
      const buf = await page.screenshot({ fullPage: true })
      writeFileSync(args.screenshot, buf)
      screenshotPath = args.screenshot
    }

    const blocking = violations.filter(v => v.severity === 'blocking')
    const advisory = violations.filter(v => v.severity === 'advisory')
    const byCheck = {}
    for (const v of violations) byCheck[v.check] = (byCheck[v.check] || 0) + 1

    const report = {
      url: args.url,
      viewport: { width: w, height: h },
      timestamp: new Date().toISOString(),
      verdict: blocking.length > 0 ? 'FAIL' : 'PASS',
      summary: {
        total: violations.length,
        blocking: blocking.length,
        advisory: advisory.length,
        byCheck,
      },
      screenshot: screenshotPath,
      violations,
    }

    console.log(JSON.stringify(report, null, args.pretty ? 2 : 0))

    await browser.close()
    process.exit(blocking.length > 0 ? 1 : 0)
  } catch (err) {
    if (browser) await browser.close().catch(() => {})
    console.error(`Error: ${err && err.message ? err.message : err}`)
    process.exit(2)
  }
}

main()
