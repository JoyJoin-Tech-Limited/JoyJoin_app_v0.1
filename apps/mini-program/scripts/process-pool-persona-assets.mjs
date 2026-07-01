#!/usr/bin/env node
/**
 * Process Pool Persona Lovart assets.
 *
 * Crops particles to uniform square canvases, resizes hero/texture/paw assets,
 * and emits optimized WebP + PNG fallback to src/assets/lovart/pool-persona/.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const INPUT_DIR = path.join(ROOT, 'assets-source/lovart/registration flow/Pool persona')
const OUTPUT_DIR = path.join(ROOT, 'src/assets/lovart/pool-persona')

const { default: sharp } = await import('sharp')

const PARTICLE_CANVAS = 256
const PARTICLE_FIT = 220
const BASE_LAYER_WIDTH = 750
const TEXTURE_WIDTH = 800
const PAW_HEIGHT = 200

const ASSETS = {
  particles: {
    'particle-purple': 'Abstract Puzzle Particles purple.png',
    'particle-coral': 'Abstract Puzzle Particles warm coral.png',
    'particle-blue': 'Abstract Puzzle Particles sky blue.png',
    'particle-green': 'Abstract Puzzle Particles fresh green.png',
  },
  base: { 'pool-persona-base': 'base layer.png' },
  texture: { 'pool-persona-cluster-texture': 'Cluster Card Texture.png' },
  paw: { 'pool-persona-paw-nudge': 'Xiaoyue Paw Nudge.png' },
}

async function processParticle(inputPath, outputBase) {
  const trimmed = await sharp(inputPath).trim().toBuffer({ resolveWithObject: true })
  const fitSize = Math.min(PARTICLE_FIT, trimmed.info.width, trimmed.info.height)
  const resized = await sharp(trimmed.data)
    .resize(fitSize, fitSize, { fit: 'inside', withoutEnlargement: true })
    .toBuffer()

  const canvas = sharp({
    create: {
      width: PARTICLE_CANVAS,
      height: PARTICLE_CANVAS,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).composite([{ input: resized, gravity: 'center' }])

  await canvas.webp({ quality: 90, effort: 6, alphaQuality: 100 }).toFile(`${outputBase}.webp`)
  await canvas.png({ compressionLevel: 9, quality: 90, effort: 10 }).toFile(`${outputBase}.png`)
}

async function processBaseLayer(inputPath, outputBase) {
  const image = sharp(inputPath).resize({ width: BASE_LAYER_WIDTH, withoutEnlargement: true, fit: 'inside' })
  await image.webp({ quality: 88, effort: 6, alphaQuality: 100 }).toFile(`${outputBase}.webp`)
  await image.png({ compressionLevel: 9, quality: 90, effort: 10 }).toFile(`${outputBase}.png`)
}

async function processTexture(inputPath, outputBase) {
  const image = sharp(inputPath).resize({ width: TEXTURE_WIDTH, withoutEnlargement: true, fit: 'inside' })
  await image.webp({ quality: 85, effort: 6, alphaQuality: 100 }).toFile(`${outputBase}.webp`)
  await image.png({ compressionLevel: 9, quality: 90, effort: 10 }).toFile(`${outputBase}.png`)
}

async function processPaw(inputPath, outputBase) {
  const trimmed = await sharp(inputPath).trim().toBuffer()
  const image = sharp(trimmed).resize({ height: PAW_HEIGHT, withoutEnlargement: true, fit: 'inside' })
  await image.webp({ quality: 90, effort: 6, alphaQuality: 100 }).toFile(`${outputBase}.webp`)
  await image.png({ compressionLevel: 9, quality: 90, effort: 10 }).toFile(`${outputBase}.png`)
}

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  }

  const results = []

  for (const [name, filename] of Object.entries(ASSETS.particles)) {
    const inputPath = path.join(INPUT_DIR, filename)
    const outputBase = path.join(OUTPUT_DIR, `lovart-${name}-20260701-v1`)
    await processParticle(inputPath, outputBase)
    const webpSize = fs.statSync(`${outputBase}.webp`).size
    const pngSize = fs.statSync(`${outputBase}.png`).size
    results.push(`${name}: ${(webpSize / 1024).toFixed(1)}KB webp, ${(pngSize / 1024).toFixed(1)}KB png`)
  }

  for (const [name, filename] of Object.entries(ASSETS.base)) {
    const inputPath = path.join(INPUT_DIR, filename)
    const outputBase = path.join(OUTPUT_DIR, `lovart-${name}-20260701-v1`)
    await processBaseLayer(inputPath, outputBase)
    const webpSize = fs.statSync(`${outputBase}.webp`).size
    const pngSize = fs.statSync(`${outputBase}.png`).size
    results.push(`${name}: ${(webpSize / 1024).toFixed(1)}KB webp, ${(pngSize / 1024).toFixed(1)}KB png`)
  }

  for (const [name, filename] of Object.entries(ASSETS.texture)) {
    const inputPath = path.join(INPUT_DIR, filename)
    const outputBase = path.join(OUTPUT_DIR, `lovart-${name}-20260701-v1`)
    await processTexture(inputPath, outputBase)
    const webpSize = fs.statSync(`${outputBase}.webp`).size
    const pngSize = fs.statSync(`${outputBase}.png`).size
    results.push(`${name}: ${(webpSize / 1024).toFixed(1)}KB webp, ${(pngSize / 1024).toFixed(1)}KB png`)
  }

  for (const [name, filename] of Object.entries(ASSETS.paw)) {
    const inputPath = path.join(INPUT_DIR, filename)
    const outputBase = path.join(OUTPUT_DIR, `lovart-${name}-20260701-v1`)
    await processPaw(inputPath, outputBase)
    const webpSize = fs.statSync(`${outputBase}.webp`).size
    const pngSize = fs.statSync(`${outputBase}.png`).size
    results.push(`${name}: ${(webpSize / 1024).toFixed(1)}KB webp, ${(pngSize / 1024).toFixed(1)}KB png`)
  }

  console.log('Pool persona assets processed:')
  results.forEach((r) => console.log(`  ${r}`))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
