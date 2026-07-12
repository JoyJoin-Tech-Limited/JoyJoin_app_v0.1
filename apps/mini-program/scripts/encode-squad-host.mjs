#!/usr/bin/env node
/**
 * Encode the locked Xiaoyue host reference for the squad-unboxing ready hero.
 *
 * Source (locked character reference, transparent PNG):
 *   assets-source/lovart/box reveal/xiaoyue gift box.png  (repo root)
 *
 * Outputs (apps/mini-program/src/assets/lovart/squad/):
 *   squad-host-xiaoyue.webp           — CDN hero (600px, q70)  [registered in cdn-asset-manifest.json]
 *   squad-host-xiaoyue-fallback.webp  — local never-blank fallback (480px, q55, target <=60KB)
 *
 * Run: node apps/mini-program/scripts/encode-squad-host.mjs
 * Requires: sharp (devDependency).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MINI_ROOT = path.resolve(__dirname, '..')            // apps/mini-program
const REPO_ROOT = path.resolve(MINI_ROOT, '..', '..')      // repo root

const INPUT = path.join(REPO_ROOT, 'assets-source', 'lovart', 'box reveal', 'xiaoyue gift box.png')
const OUT_DIR = path.join(MINI_ROOT, 'src', 'assets', 'lovart', 'squad')
const CDN_OUT = path.join(OUT_DIR, 'squad-host-xiaoyue.webp')
const FALLBACK_OUT = path.join(OUT_DIR, 'squad-host-xiaoyue-fallback.webp')

const KB = 1024
const FALLBACK_BUDGET_BYTES = 60 * KB

async function main() {
  if (!fs.existsSync(INPUT)) {
    console.error(`Missing source: ${INPUT}`)
    process.exit(1)
  }
  fs.mkdirSync(OUT_DIR, { recursive: true })

  const { default: sharp } = await import('sharp')
  const srcStat = fs.statSync(INPUT)

  // CDN hero — premium, served from joyjoinapp.com/static.
  await sharp(INPUT)
    .resize({ width: 600, withoutEnlargement: true, fit: 'inside' })
    .webp({ quality: 70, effort: 6, alphaQuality: 100 })
    .toFile(CDN_OUT)

  // Local fallback — bundled, must stay <=60KB. Drop quality until it fits.
  let quality = 55
  let buf = await sharp(INPUT)
    .resize({ width: 480, withoutEnlargement: true, fit: 'inside' })
    .webp({ quality, effort: 6, alphaQuality: 100 })
    .toBuffer()
  while (buf.length > FALLBACK_BUDGET_BYTES && quality > 30) {
    quality -= 5
    buf = await sharp(INPUT)
      .resize({ width: 480, withoutEnlargement: true, fit: 'inside' })
      .webp({ quality, effort: 6, alphaQuality: 100 })
      .toBuffer()
  }
  fs.writeFileSync(FALLBACK_OUT, buf)

  const cdnSize = fs.statSync(CDN_OUT).size
  const fbSize = buf.length
  const fmt = (n) => `${(n / KB).toFixed(1)}KB`
  console.log(`source:   ${fmt(srcStat.size)} raw png`)
  console.log(`cdn:      ${fmt(cdnSize)}  → ${path.relative(MINI_ROOT, CDN_OUT)}`)
  console.log(`fallback: ${fmt(fbSize)} (q${quality}, <=60KB=${fbSize <= FALLBACK_BUDGET_BYTES}) → ${path.relative(MINI_ROOT, FALLBACK_OUT)}`)

  if (fbSize > FALLBACK_BUDGET_BYTES) {
    console.error(`Fallback still over 60KB after quality floor — reduce width further.`)
    process.exit(1)
  }
}

main().catch((err) => { console.error(err); process.exit(1) })
