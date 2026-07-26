#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const appRoot = resolve(import.meta.dirname, '..')
const distRoot = resolve(appRoot, 'dist')
const appJsonPath = resolve(distRoot, 'app.json')

const requiredFiles = [
  'assets/illustrations/street-blind-box-entry.webp',
  'pages/alang/event/index.js',
  'pages/alang/event/index.wxml',
  'pages/alang/event/index.wxss',
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
  if (!existsSync(resolve(distRoot, relativePath))) {
    failures.push(`dist/${relativePath} is missing`)
  }
}

if (failures.length) {
  console.error('[verify-flash-package] Flash upload package is incomplete:')
  for (const failure of failures) console.error(`  - ${failure}`)
  process.exit(1)
}

console.log(
  `[verify-flash-package] OK — main-package icon, ${requiredPages.length} Flash pages, ` +
    'five NPC portraits, and three UI illustrations are present.',
)
