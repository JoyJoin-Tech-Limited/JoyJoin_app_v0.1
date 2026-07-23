#!/usr/bin/env node
/**
 * Validate WeChat Mini Program app.config.ts against upload-time rules
 * that miniprogram-ci only surfaces when synchronous upload is enabled.
 *
 * Currently checks:
 * - scope.* permission descriptions must be <= 30 characters
 *   (WeChat errcode 80058 if exceeded).
 *
 * Exit codes:
 *   0 = valid
 *   1 = validation error
 *   2 = unexpected script error
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const APP_CONFIG_PATH = resolve(__dirname, '../src/app.config.ts')
const SCOPE_DESC_MAX_LENGTH = 30

function countWeChatChars(str) {
  // WeChat counts Unicode characters, not UTF-16 code units or bytes.
  // Array.from correctly splits surrogate pairs (e.g., emoji) into single chars.
  return Array.from(str).length
}

function extractPermissionBlock(content) {
  // Find the `permission:` object, handling possible trailing comma.
  const match = content.match(/permission\s*:\s*\{([\s\S]*?)\},?\s*(?:requiredPrivateInfos|pages|subPackages|preloadRule|usingComponents|tabBar|window|lazyCodeLoading)/)
  if (!match) return null
  return match[1]
}

function extractScopeDescs(permissionBlock) {
  const descs = []
  // Match each scope key and its desc string value.
  const scopeRegex = /['"](scope\.\w+)['"]\s*:\s*\{[\s\S]*?desc\s*:\s*['"]([^'"]*)['"][\s\S]*?\}/g
  let m
  while ((m = scopeRegex.exec(permissionBlock)) !== null) {
    descs.push({ scope: m[1], desc: m[2] })
  }
  return descs
}

function main() {
  let content
  try {
    content = readFileSync(APP_CONFIG_PATH, 'utf8')
  } catch (err) {
    console.error(`[validate-wechat-app-config] Failed to read ${APP_CONFIG_PATH}: ${err.message}`)
    process.exit(2)
  }

  const permissionBlock = extractPermissionBlock(content)
  if (!permissionBlock) {
    console.error('[validate-wechat-app-config] Could not locate `permission:` block in app.config.ts')
    process.exit(2)
  }

  const descs = extractScopeDescs(permissionBlock)
  const violations = []

  for (const { scope, desc } of descs) {
    const length = countWeChatChars(desc)
    if (length > SCOPE_DESC_MAX_LENGTH) {
      violations.push({ scope, desc, length })
    }
  }

  if (violations.length > 0) {
    console.error('[validate-wechat-app-config] WeChat permission description length violation(s) found:')
    for (const { scope, desc, length } of violations) {
      console.error(`  - ${scope}: ${length}/${SCOPE_DESC_MAX_LENGTH} characters`)
      console.error(`    "${desc}"`)
    }
    console.error(`\nWeChat rejects uploads when a scope.* description exceeds ${SCOPE_DESC_MAX_LENGTH} characters (errcode 80058).`)
    console.error('Shorten the description(s) in apps/mini-program/src/app.config.ts.')
    process.exit(1)
  }

  console.log(`[validate-wechat-app-config] OK — ${descs.length} scope permission description(s) within ${SCOPE_DESC_MAX_LENGTH}-character limit.`)
  process.exit(0)
}

main()
