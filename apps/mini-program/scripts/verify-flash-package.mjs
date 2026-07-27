#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import sharp from 'sharp'

const appRoot = resolve(import.meta.dirname, '..')
const distRoot = resolve(appRoot, 'dist')
const appJsonPath = resolve(distRoot, 'app.json')
const manifestPath = resolve(distRoot, 'flash-build-manifest.json')
const projectConfigPath = resolve(appRoot, 'project.config.json')
const preupload = process.argv.includes('--preupload')

const requiredFiles = [
  'assets/illustrations/street-blind-box-entry.webp',
  'common.wxss',
  'pages/alang/event/index.js',
  'pages/alang/event/index.wxml',
  'pages/alang/assets/npcs/alang.webp',
  'pages/alang/assets/npcs/lizi.webp',
  'pages/alang/assets/npcs/momo.webp',
  'pages/alang/assets/npcs/shiqi.webp',
  'pages/alang/assets/npcs/atuan.webp',
  'pages/alang/assets/ui/flash-city-ambient-bg.webp',
  'pages/alang/assets/ui/flash-empty-online.webp',
  'pages/alang/assets/ui/flash-empty-tasks.webp',
]

const requiredPages = [
  'event/index',
  'event-detail/index',
  'config/index',
  'search/index',
  'dialogue/index',
  'companion/index',
  'result/index',
  'story-detail/index',
  'preferences/index',
  'debug/index',
]

const failures = []

function digestFile(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

if (!existsSync(appJsonPath)) {
  failures.push('dist/app.json is missing')
} else {
  const appConfig = JSON.parse(readFileSync(appJsonPath, 'utf8'))
  const packages = appConfig.subPackages ?? appConfig.subpackages ?? []
  const flashPackage = packages.find((entry) => entry.root === 'pages/alang')

  if (!flashPackage) {
    failures.push('app.json does not register the pages/alang subpackage')
  } else {
    for (const page of requiredPages) {
      if (!flashPackage.pages?.includes(page)) {
        failures.push(`app.json is missing Flash page: pages/alang/${page}`)
      }
    }
  }
}

for (const relativePath of requiredFiles) {
  const absolutePath = resolve(distRoot, relativePath)
  if (!existsSync(absolutePath)) {
    failures.push(`dist/${relativePath} is missing`)
  } else if (statSync(absolutePath).size === 0) {
    failures.push(`dist/${relativePath} is empty`)
  }
}

const iconRelativePath = 'assets/illustrations/street-blind-box-entry.webp'
const iconPath = resolve(distRoot, iconRelativePath)

if (!existsSync(projectConfigPath)) {
  failures.push('project.config.json is missing')
} else {
  const projectConfig = JSON.parse(readFileSync(projectConfigPath, 'utf8'))
  const packIncludes = projectConfig.packOptions?.include ?? []
  const iconIsForcedIntoWxapkg = packIncludes.some(
    (entry) => entry?.type === 'file' && entry?.value === iconRelativePath,
  )
  if (!iconIsForcedIntoWxapkg) {
    failures.push(
      `project.config.json packOptions.include must explicitly include ${iconRelativePath}; ` +
        'dynamic Taro image paths can otherwise be removed from the uploaded wxapkg',
    )
  }
}

if (existsSync(iconPath) && statSync(iconPath).size > 0) {
  try {
    const metadata = await sharp(iconPath).metadata()
    if (metadata.format !== 'webp' || !metadata.width || !metadata.height) {
      failures.push(`dist/${iconRelativePath} is not a decodable WebP image`)
    }
  } catch (error) {
    failures.push(`dist/${iconRelativePath} WebP decode failed: ${error.message}`)
  }
}

const commonStylesPath = resolve(distRoot, 'common.wxss')
if (
  existsSync(commonStylesPath) &&
  !readFileSync(commonStylesPath, 'utf8').includes('.flash-page')
) {
  failures.push('dist/common.wxss does not contain the shared Flash page styles')
}

if (failures.length) {
  console.error('[verify-flash-package] Flash upload package is incomplete:')
  for (const failure of failures) console.error(`  - ${failure}`)
  process.exit(1)
}

const fileEntries = requiredFiles.map((relativePath) => {
  const absolutePath = resolve(distRoot, relativePath)
  return {
    path: relativePath,
    size: statSync(absolutePath).size,
    sha256: digestFile(absolutePath),
  }
})
const buildHash = createHash('sha256')
  .update(fileEntries.map(({ path, size, sha256 }) => `${path}:${size}:${sha256}`).join('\n'))
  .digest('hex')

if (preupload) {
  if (!existsSync(manifestPath)) {
    console.error('[verify-flash-package] dist/flash-build-manifest.json is missing; run build:weapp first.')
    process.exit(1)
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  if (manifest.buildHash !== buildHash) {
    console.error('[verify-flash-package] Build manifest does not match the current upload package.')
    process.exit(1)
  }
} else {
  writeFileSync(manifestPath, `${JSON.stringify({
    schemaVersion: 1,
    buildHash,
    generatedAt: new Date().toISOString(),
    packageRoot: 'dist',
    icon: {
      path: iconRelativePath,
      format: 'webp',
    },
    files: fileEntries,
  }, null, 2)}\n`, 'utf8')
}

console.log(
  `[verify-flash-package] OK — build ${buildHash}; main-package icon exists, is non-empty, ` +
    `and decodes as WebP; ${requiredPages.length} Flash pages, five NPC portraits, ` +
    `and three UI illustrations are present${preupload ? ' and match the build manifest' : ''}.`,
)
