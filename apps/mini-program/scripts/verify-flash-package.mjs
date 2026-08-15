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
const npcHeadshotRelativePaths = ['alang', 'lizi', 'momo', 'shiqi', 'atuan']
  .map((slug) => `pages/alang/assets/npcs/headshots/${slug}.jpg`)
const flashSceneRelativePaths = ['radar', 'task', 'feedback']
  .map((scene) => `pages/alang/assets/backgrounds/${scene}-paper-scene.jpg`)
const flashDialogueRelativePaths = [
  'pages/alang/assets/ui/flash-alang-first-act-riverside-v2.jpg',
  'pages/alang/assets/ui/flash-lizi-first-act-color-studio-v2.jpg',
  'pages/alang/assets/ui/flash-momo-first-act-rain-route-v2.jpg',
  'pages/alang/assets/ui/flash-shiqi-first-act-record-room-v2.jpg',
  'pages/alang/assets/ui/flash-atuan-first-arrival-layered-v2.jpg',
]
const flashReviewedStoryBackgrounds = [
  'pages/alang/assets/onboarding/parallel-standard-paper-world-v1.jpg',
]
const atuanArrivalRelativePaths = [
  'pages/alang/assets/ui/flash-atuan-park-clean-v3.jpg',
  'pages/alang/assets/ui/flash-atuan-character-lowpoly-v3.png',
  'pages/alang/assets/ui/flash-atuan-bag-cutout-v2.png',
]
const flashRuntimeImageBudgetBytes = Math.round(1.05 * 1024 * 1024)

const flashRuntimeImages = [
  'pages/alang/assets/ui/flash-city-ambient-bg.png',
  'pages/alang/assets/ui/flash-empty-online.png',
  ...npcHeadshotRelativePaths,
  ...flashSceneRelativePaths,
  ...flashDialogueRelativePaths,
  ...flashReviewedStoryBackgrounds,
  ...atuanArrivalRelativePaths,
  'pages/alang/assets/candidates/alang-event-card-candidate.jpg',
  'pages/alang/assets/candidates/alang-found-scene-candidate.jpg',
  'pages/alang/assets/candidates/alang-companion-atmosphere-candidate.jpg',
  'pages/alang/assets/candidates/alang-result-candidate.jpg',
]

const requiredFiles = [
  'assets/illustrations/street-blind-box-entry.webp',
  'assets/illustrations/street-blind-box-entry.png',
  'common.wxss',
  'pages/alang/event/index.js',
  'pages/alang/event/index.wxml',
  ...flashRuntimeImages,
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
const runtimeIconRelativePath = 'assets/illustrations/street-blind-box-entry.png'
const runtimeIconPath = resolve(distRoot, runtimeIconRelativePath)

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
  const runtimeIconIsForcedIntoWxapkg = packIncludes.some(
    (entry) => entry?.type === 'file' && entry?.value === runtimeIconRelativePath,
  )
  if (!runtimeIconIsForcedIntoWxapkg) {
    failures.push(
      `project.config.json packOptions.include must explicitly include ${runtimeIconRelativePath}`,
    )
  }
  const flashRuntimeImagesAreForcedIntoWxapkg = packIncludes.some(
    (entry) => entry?.type === 'regexp' && entry?.value === 'pages/alang/assets/.*\\.png$',
  )
  if (!flashRuntimeImagesAreForcedIntoWxapkg) {
    failures.push(
      'project.config.json packOptions.include must explicitly include all pages/alang PNG runtime assets',
    )
  }
  const flashRuntimeJpgsAreForcedIntoWxapkg = packIncludes.some(
    (entry) => entry?.type === 'regexp' && entry?.value === 'pages/alang/assets/.*\\.jpg$',
  )
  if (!flashRuntimeJpgsAreForcedIntoWxapkg) {
    failures.push(
      'project.config.json packOptions.include must explicitly include all pages/alang JPG runtime assets',
    )
  }
  const flashRuntimeWebpsAreForcedIntoWxapkg = packIncludes.some(
    (entry) => entry?.type === 'regexp' && entry?.value === 'pages/alang/assets/.*\\.webp$',
  )
  if (!flashRuntimeWebpsAreForcedIntoWxapkg) {
    failures.push(
      'project.config.json packOptions.include must explicitly include all pages/alang WebP runtime assets',
    )
  }
  if (projectConfig.setting?.ignoreUploadUnusedFiles !== false) {
    failures.push(
      'project.config.json setting.ignoreUploadUnusedFiles must be false; ' +
        `the WeChat upload optimizer cannot statically trace the Taro runtime path for ${iconRelativePath}`,
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

if (existsSync(runtimeIconPath) && statSync(runtimeIconPath).size > 0) {
  if (statSync(runtimeIconPath).size > 64 * 1024) {
    failures.push(
      `dist/${runtimeIconRelativePath} exceeds the 64 KiB main-package icon budget`,
    )
  }
  try {
    const metadata = await sharp(runtimeIconPath).metadata()
    if (metadata.format !== 'png' || !metadata.width || !metadata.height) {
      failures.push(`dist/${runtimeIconRelativePath} is not a decodable PNG image`)
    }
  } catch (error) {
    failures.push(`dist/${runtimeIconRelativePath} PNG decode failed: ${error.message}`)
  }
}

let flashRuntimeImageBytes = 0
for (const relativePath of flashRuntimeImages) {
  const absolutePath = resolve(distRoot, relativePath)
  if (!existsSync(absolutePath) || statSync(absolutePath).size === 0) continue
  flashRuntimeImageBytes += statSync(absolutePath).size
  try {
    const metadata = await sharp(absolutePath).metadata()
    const expectedFormat = relativePath.endsWith('.jpg') ? 'jpeg' : relativePath.endsWith('.webp') ? 'webp' : 'png'
    if (metadata.format !== expectedFormat || !metadata.width || !metadata.height) {
      failures.push(`dist/${relativePath} is not a decodable ${expectedFormat.toUpperCase()} image`)
    }
  } catch (error) {
    failures.push(`dist/${relativePath} decode failed: ${error.message}`)
  }
}
if (flashRuntimeImageBytes > flashRuntimeImageBudgetBytes) {
  failures.push(
    `Flash runtime image assets use ${flashRuntimeImageBytes} bytes, exceeding the 1.05 MiB subpackage budget`,
  )
}

const commonStylesPath = resolve(distRoot, 'common.wxss')
if (existsSync(commonStylesPath)) {
  const commonStyles = readFileSync(commonStylesPath, 'utf8')
  if (!commonStyles.includes('.flash-page')) {
    failures.push('dist/common.wxss does not contain the shared Flash page styles')
  }
  if (!/\.flash-dialogue--story\{[^}]*min-height:100vh;[^}]*height:100dvh;[^}]*\}/.test(commonStyles)) {
    failures.push(
      'dist/common.wxss does not preserve the non-collapsing Flash story viewport height chain',
    )
  }
  if (!/\.flash-dialogue__story-stage\{[^}]*position:absolute;[^}]*inset:0;[^}]*\}/.test(commonStyles)) {
    failures.push(
      'dist/common.wxss does not anchor the Flash story stage to the viewport shell',
    )
  }
}

const flashEntryPath = resolve(distRoot, 'pages/alang/event/index.js')
if (existsSync(flashEntryPath)) {
  const flashEntrySource = readFileSync(flashEntryPath, 'utf8')
  if (flashEntrySource.includes('updateFlashPreferences')) {
    failures.push(
      'dist/pages/alang/event/index.js must call apiRequest directly; ' +
        'the cross-chunk updateFlashPreferences wrapper is unsafe in WeChat AppService',
    )
  }
  if (/yield\s+\w+\.apiRequest\(\{path:"\/api\/alang\/flash\/preferences"/.test(flashEntrySource)) {
    failures.push(
      'dist/pages/alang/event/index.js must not lower story-mode selection through a generator helper; ' +
        'WeChat AppService fails before the handler catch boundary on real devices',
    )
  }
  for (const staleWebpName of [
    'parallel-personalized-paper-world-v1.webp',
    'parallel-standard-paper-world-v1.webp',
  ]) {
    if (flashEntrySource.includes(staleWebpName)) {
      failures.push(`dist/pages/alang/event/index.js still references unsupported ${staleWebpName}`)
    }
  }
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
      sourcePath: iconRelativePath,
      sourceFormat: 'webp',
      runtimePath: runtimeIconRelativePath,
      runtimeFormat: 'png',
    },
    flashRuntimeAssets: {
      format: 'png/webp',
      count: flashRuntimeImages.length,
      totalBytes: flashRuntimeImageBytes,
    },
    files: fileEntries,
  }, null, 2)}\n`, 'utf8')
}

console.log(
  `[verify-flash-package] OK — build ${buildHash}; main-package icon exists, is non-empty, ` +
    `and decodes as WebP; its runtime PNG derivative is present and decodable; ` +
    `${requiredPages.length} Flash pages and all ${flashRuntimeImages.length} runtime image assets ` +
    `are present and decodable${preupload ? ' and match the build manifest' : ''}.`,
)
