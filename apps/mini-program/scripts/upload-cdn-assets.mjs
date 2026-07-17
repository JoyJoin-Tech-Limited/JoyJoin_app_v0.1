#!/usr/bin/env node
/**
 * Upload mini-program assets to CDN / static host.
 *
 * Supports backends:
 *   - rsync  (default — SSH to your server, e.g. self-managed nginx)
 *   - s3     (AWS S3, Cloudflare R2, MinIO — any S3-compatible)
 *   - oss    (Aliyun OSS)
 *   - cos    (Tencent Cloud COS)
 *
 * Usage:
 *   # Dry-run (see what would upload)
 *   node scripts/upload-cdn-assets.mjs --dry-run
 *
 *   # Upload via rsync (default)
 *   CDN_BACKEND=rsync CDN_RSYNC_HOST=1.12.243.104 CDN_RSYNC_PATH=/var/www/cdn \
 *     node scripts/upload-cdn-assets.mjs
 *
 *   # Upload via S3
 *   CDN_BACKEND=s3 CDN_S3_BUCKET=joyjoin-assets CDN_S3_ENDPOINT=https://s3.amazonaws.com \
 *     AWS_ACCESS_KEY_ID=xxx AWS_SECRET_ACCESS_KEY=yyy \
 *     node scripts/upload-cdn-assets.mjs
 *
 * Environment variables:
 *   CDN_BACKEND          — rsync | s3 | oss | cos  (default: rsync)
 *   CDN_BASE_URL         — e.g. https://joyjoinapp.com/static
 *   CDN_RSYNC_HOST       — SSH host for rsync
 *   CDN_RSYNC_USER       — SSH user (default: current user)
 *   CDN_RSYNC_PATH       — Remote directory path (default: /var/www/cdn)
 *   CDN_RSYNC_KEY        — SSH private key path (optional)
 *   CDN_S3_BUCKET        — S3 bucket name
 *   CDN_S3_REGION        — S3 region (default: us-east-1)
 *   CDN_S3_ENDPOINT      — Custom endpoint for R2/MinIO
 *   CDN_OSS_BUCKET       — Aliyun OSS bucket
 *   CDN_OSS_REGION       — Aliyun OSS region
 *   CDN_OSS_ENDPOINT     — Aliyun OSS endpoint
 *   CDN_COS_BUCKET       — Tencent COS bucket
 *   CDN_COS_REGION       — Tencent COS region
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const DIST_DIR = path.join(ROOT, 'dist')
const SRC_DIR = path.join(ROOT, 'src')
const MANIFEST_PATH = path.join(__dirname, 'cdn-asset-manifest.json')

const BACKEND = process.env.CDN_BACKEND ?? 'rsync'
const CDN_BASE_URL = (process.env.CDN_BASE_URL ?? '').replace(/\/$/, '')
const DRY_RUN = process.argv.includes('--dry-run')
const SOURCE_DIR = process.env.CDN_SOURCE_DIR  // full directory upload mode

function formatSize(bytes) {
  if (bytes > 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  return `${(bytes / 1024).toFixed(1)} KB`
}

function logStep(msg) {
  console.log(`\n📦 ${msg}`)
}

function logFile(file, size) {
  console.log(`   ↑ ${file} (${formatSize(size)})`)
}

// Retained for backend-specific skip reporting hooks.
// eslint-disable-next-line no-unused-vars
function logSkip(file) {
  console.log(`   ✓ ${file} (already uploaded, skipping)`)
}

function assertStrictDescendant(candidate, parent, label) {
  const resolvedCandidate = path.resolve(candidate)
  const resolvedParent = path.resolve(parent)
  const relative = path.relative(resolvedParent, resolvedCandidate)
  if (
    !relative
    || relative === '..'
    || relative.startsWith(`..${path.sep}`)
    || path.isAbsolute(relative)
  ) {
    throw new Error(`${label} must be a strict child of ${resolvedParent}`)
  }
}

function validateManifestRelativePath(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`)
  }
  if (value.includes('\0')) {
    throw new Error(`${label} must not contain a NUL byte`)
  }
  if (value.includes('\\')) {
    throw new Error(`${label} must use POSIX '/' separators`)
  }
  if (path.posix.isAbsolute(value) || path.win32.isAbsolute(value) || /^[A-Za-z]:/.test(value)) {
    throw new Error(`${label} must be a relative POSIX path`)
  }

  const segments = value.split('/')
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    throw new Error(`${label} must not contain empty, '.' or '..' segments`)
  }
  if (path.posix.normalize(value) !== value) {
    throw new Error(`${label} must already be a normalized POSIX path`)
  }
  return value
}

function resolveManifestDescendant(parent, relativePath, label) {
  const candidate = path.resolve(parent, ...relativePath.split('/'))
  assertStrictDescendant(candidate, parent, label)
  return candidate
}

function projectedRealPathSync(candidate) {
  let cursor = path.resolve(candidate)
  const missingSegments = []

  while (true) {
    try {
      const realAncestor = fs.realpathSync(cursor)
      return path.resolve(realAncestor, ...missingSegments.reverse())
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
      const parent = path.dirname(cursor)
      if (parent === cursor) {
        throw new Error(`Cannot resolve an existing ancestor for ${candidate}`)
      }
      missingSegments.push(path.basename(cursor))
      cursor = parent
    }
  }
}

function resolveManifestSource(localPath) {
  const realRoot = fs.realpathSync(ROOT)
  for (const sourceRoot of [DIST_DIR, SRC_DIR]) {
    const candidate = resolveManifestDescendant(sourceRoot, localPath, `manifest source ${localPath}`)
    if (!fs.existsSync(candidate)) continue

    const realSourceRoot = fs.realpathSync(sourceRoot)
    const realSource = fs.realpathSync(candidate)
    assertStrictDescendant(realSourceRoot, realRoot, `manifest source root for ${localPath}`)
    assertStrictDescendant(realSource, realSourceRoot, `manifest source ${localPath}`)
    if (!fs.statSync(realSource).isFile()) {
      throw new Error(`manifest source ${localPath} must resolve to a regular file`)
    }
    return realSource
  }
  return null
}

function readManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error(`❌ Manifest not found: ${MANIFEST_PATH}`)
    console.error('   Run npm run build:weapp first, then ensure the manifest exists.')
    process.exit(1)
  }
  const raw = fs.readFileSync(MANIFEST_PATH, 'utf-8')
  const manifest = JSON.parse(raw)
  if (!Array.isArray(manifest.assets)) {
    console.error('❌ Invalid manifest: missing assets array')
    process.exit(1)
  }
  const seenCdnPaths = new Set()
  manifest.assets = manifest.assets.map((asset, index) => {
    if (!asset || typeof asset !== 'object' || Array.isArray(asset)) {
      throw new Error(`manifest asset[${index}] must be an object`)
    }
    const localPath = validateManifestRelativePath(asset.localPath, `manifest asset[${index}].localPath`)
    const cdnPath = validateManifestRelativePath(asset.cdnPath, `manifest asset[${index}].cdnPath`)
    if (seenCdnPaths.has(cdnPath)) {
      throw new Error(`manifest asset[${index}].cdnPath duplicates ${cdnPath}`)
    }
    seenCdnPaths.add(cdnPath)
    return { ...asset, localPath, cdnPath }
  })
  return manifest
}

function validateEnv(vars) {
  const missing = vars.filter((v) => !process.env[v])
  if (missing.length > 0) {
    console.error(`❌ Missing required environment variables for ${BACKEND} backend:`)
    missing.forEach((v) => console.error(`   - ${v}`))
    process.exit(1)
  }
}

async function runCommand(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: DRY_RUN ? 'pipe' : 'inherit', ...options })
    let stdout = ''
    let stderr = ''
    if (child.stdout) child.stdout.on('data', (d) => { stdout += d; if (DRY_RUN) process.stdout.write(d) })
    if (child.stderr) child.stderr.on('data', (d) => { stderr += d; if (DRY_RUN) process.stderr.write(d) })
    child.on('close', (code) => {
      if (code !== 0) {
        const error = new Error(`Command failed with exit code ${code}: ${cmd} ${args.join(' ')}\n${stderr}`)
        error.exitCode = code
        reject(error)
      }
      else resolve(stdout)
    })
  })
}

async function runTransportCommand(cmd, args, options = {}) {
  const attempts = 3
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await runCommand(cmd, args, options)
    } catch (error) {
      const retryable = error?.exitCode === 255
      if (!retryable || attempt === attempts) throw error
      const delayMs = attempt * 5_000
      console.warn(`   ⚠️ SSH transport closed (attempt ${attempt}/${attempts}); retrying in ${delayMs / 1000}s...`)
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }
  throw new Error('SSH transport retry loop exhausted')
}

// ─── RSYNC BACKEND ───
async function uploadRsync(files) {
  validateEnv(['CDN_RSYNC_HOST', 'CDN_RSYNC_PATH'])
  const host = process.env.CDN_RSYNC_HOST
  const user = process.env.CDN_RSYNC_USER ?? process.env.USER
  const remotePath = process.env.CDN_RSYNC_PATH
  const key = process.env.CDN_RSYNC_KEY

  const sshArgs = [
    '-o', 'StrictHostKeyChecking=no',
    '-o', 'UserKnownHostsFile=/dev/null',
    '-o', 'BatchMode=yes',
    '-o', 'PasswordAuthentication=no',
    '-o', 'ConnectTimeout=15',
    '-o', 'ServerAliveInterval=10',
    '-o', 'ServerAliveCountMax=3',
  ]
  if (key) sshArgs.push('-o', 'IdentitiesOnly=yes', '-i', key)

  const sshArgsQuoted = sshArgs.map((a) => (a.includes(' ') ? `'${a}'` : a))

  // Ensure remote base directory exists
  if (!DRY_RUN) {
    await runTransportCommand('ssh', [...sshArgs, `${user}@${host}`, `mkdir -p ${remotePath}`])
  }

  // Full directory mode — rsync whole source dir
  if (SOURCE_DIR) {
    const src = SOURCE_DIR.replace(/\/$/, '') + '/'
    const dest = `${user}@${host}:${remotePath}/`
    if (DRY_RUN) {
      console.log(`   [dry-run] Would rsync: ${src} → ${dest}`)
    } else {
      // Keep prior content-hashed files so older mini-program releases remain loadable.
      await runTransportCommand('rsync', ['-avz', '--checksum', '-e', `ssh ${sshArgsQuoted.join(' ')}`, src, dest])
    }
    return
  }

  // Manifest mode — stage all files in a temp dir, then rsync once
  const stagingDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cdn-upload-'))
  try {
    let stagedCount = 0

    for (const { localPath, cdnPath, sourcePath: src } of files) {
      if (!src) {
        console.warn(`   ⚠️ Source file missing in both dist/ and src/, skipping: ${localPath}`)
        continue
      }

      const stagingDest = resolveManifestDescendant(stagingDir, cdnPath, `CDN staging target ${cdnPath}`)
      fs.mkdirSync(path.dirname(stagingDest), { recursive: true })
      const projectedStagingDest = projectedRealPathSync(stagingDest)
      assertStrictDescendant(projectedStagingDest, fs.realpathSync(stagingDir), `CDN staging target ${cdnPath}`)
      fs.cpSync(src, stagingDest)
      stagedCount++

      logFile(cdnPath, fs.statSync(src).size)
    }

    if (stagedCount === 0) {
      console.log('   No files to upload.')
      return
    }

    // Single rsync of the entire staging directory
    const src = stagingDir + '/'
    const dest = `${user}@${host}:${remotePath}/`
    if (DRY_RUN) {
      console.log(`   [dry-run] Would rsync: ${stagedCount} staged files → ${dest}`)
    } else {
      console.log(`   🚀 Syncing ${stagedCount} files in one batch...`)
      await runTransportCommand('rsync', ['-avz', '--checksum', '-e', `ssh ${sshArgsQuoted.join(' ')}`, src, dest])

      // Ensure nginx can read all uploaded assets regardless of the umask on the remote host.
      console.log(`   🔧 Fixing permissions on ${remotePath}...`)
      await runTransportCommand('ssh', [
        ...sshArgs,
        `${user}@${host}`,
        `chmod 755 ${remotePath} && find ${remotePath}/assets -type f -exec chmod 644 {} \\; && find ${remotePath}/assets -type d -exec chmod 755 {} \\;`,
      ])
    }
  } finally {
    fs.rmSync(stagingDir, { recursive: true, force: true })
  }
}

// ─── S3 BACKEND ───
async function uploadS3(files) {
  validateEnv(['CDN_S3_BUCKET'])
  const bucket = process.env.CDN_S3_BUCKET
  const region = process.env.CDN_S3_REGION ?? 'us-east-1'
  const endpoint = process.env.CDN_S3_ENDPOINT

  // Check for AWS CLI
  try {
    await runCommand('aws', ['--version'])
  } catch {
    console.error('❌ AWS CLI not found. Install it: https://docs.aws.amazon.com/cli/')
    process.exit(1)
  }

  const env = { ...process.env }
  if (endpoint) {
    env.AWS_ENDPOINT_URL = endpoint
  }

  for (const { localPath, cdnPath, sourcePath: src } of files) {
    if (!src) {
      console.warn(`   ⚠️ Source file missing in both dist/ and src/, skipping: ${localPath}`)
      continue
    }
    const key = cdnPath
    const args = ['s3', 'cp', src, `s3://${bucket}/${key}`, '--region', region]

    if (DRY_RUN) {
      console.log(`   [dry-run] Would run: aws ${args.join(' ')}`)
      continue
    }

    await runCommand('aws', args, { env })
  }
}

// ─── OSS BACKEND (Aliyun) ───
async function uploadOss(files) {
  validateEnv(['CDN_OSS_BUCKET'])
  const bucket = process.env.CDN_OSS_BUCKET
  const endpoint = process.env.CDN_OSS_ENDPOINT

  try {
    await runCommand('ossutil', ['--version'])
  } catch {
    console.error('❌ ossutil not found. Install it: https://www.alibabacloud.com/help/en/oss/developer-reference/install-ossutil')
    process.exit(1)
  }

  for (const { localPath, cdnPath, sourcePath: src } of files) {
    if (!src) {
      console.warn(`   ⚠️ Source file missing in both dist/ and src/, skipping: ${localPath}`)
      continue
    }
    const args = ['cp', src, `oss://${bucket}/${cdnPath}`]
    if (endpoint) args.push('--endpoint', endpoint)

    if (DRY_RUN) {
      console.log(`   [dry-run] Would run: ossutil ${args.join(' ')}`)
      continue
    }

    await runCommand('ossutil', args)
  }
}

// ─── COS BACKEND (Tencent) ───
async function uploadCos(files) {
  validateEnv(['CDN_COS_BUCKET', 'CDN_COS_REGION'])
  const bucket = process.env.CDN_COS_BUCKET
  const region = process.env.CDN_COS_REGION

  try {
    await runCommand('coscli', ['--version'])
  } catch {
    console.error('❌ coscli not found. Install it: https://www.tencentcloud.com/document/product/436/63143')
    process.exit(1)
  }

  for (const { localPath, cdnPath, sourcePath: src } of files) {
    if (!src) {
      console.warn(`   ⚠️ Source file missing in both dist/ and src/, skipping: ${localPath}`)
      continue
    }
    const args = ['cp', src, `cos://${bucket}-${region}/${cdnPath}`]

    if (DRY_RUN) {
      console.log(`   [dry-run] Would run: coscli ${args.join(' ')}`)
      continue
    }

    await runCommand('coscli', args)
  }
}

// ─── MAIN ───
async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗')
  console.log('║      JoyJoin Mini Program — CDN Asset Uploader             ║')
  console.log('╚════════════════════════════════════════════════════════════╝')

  if (DRY_RUN) {
    console.log('\n🏷️  DRY-RUN MODE — no files will actually be uploaded\n')
  }

  if (!CDN_BASE_URL) {
    console.warn('⚠️  CDN_BASE_URL not set. Assets will upload but mini-program code')
    console.warn('   will fall back to local paths. Set TARO_APP_CDN_BASE_URL in .env.local')
  }

  let files
  let totalSize = 0

  if (SOURCE_DIR) {
    // Full directory mode
    if (!fs.existsSync(SOURCE_DIR)) {
      console.error(`❌ Source directory not found: ${SOURCE_DIR}`)
      process.exit(1)
    }
    function countFiles(dir) {
      let size = 0
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) size += countFiles(full)
        else if (entry.isFile()) size += fs.statSync(full).size
      }
      return size
    }
    totalSize = countFiles(SOURCE_DIR)
    logStep(`Backend: ${BACKEND}  |  Mode: full-directory  |  Source: ${SOURCE_DIR}  |  Size: ${formatSize(totalSize)}`)
  } else {
    // Manifest mode
    const manifest = readManifest()
    files = manifest.assets.map((asset) => ({
      ...asset,
      sourcePath: resolveManifestSource(asset.localPath),
    }))

    let missingCount = 0
    for (const { sourcePath } of files) {
      if (sourcePath) {
        totalSize += fs.statSync(sourcePath).size
      } else {
        missingCount++
      }
    }

    logStep(`Backend: ${BACKEND}  |  Files: ${files.length}  |  Total size: ${formatSize(totalSize)}`)
    if (missingCount > 0) {
      throw new Error(`${missingCount} manifest source file(s) are missing in both dist/ and src/`)
    }
  }

  const startTime = Date.now()

  switch (BACKEND) {
    case 'rsync':
      await uploadRsync(files)
      break
    case 's3':
      await uploadS3(files)
      break
    case 'oss':
      await uploadOss(files)
      break
    case 'cos':
      await uploadCos(files)
      break
    default:
      console.error(`❌ Unknown backend: ${BACKEND}`)
      console.error('   Supported: rsync, s3, oss, cos')
      process.exit(1)
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`\n✅ Upload complete in ${elapsed}s`)
  console.log(`   CDN base URL: ${CDN_BASE_URL || '(not set — local fallback)'}`)
  console.log(`   Next step: Set TARO_APP_CDN_BASE_URL=${CDN_BASE_URL || 'https://your-cdn.com'} in .env.local`)
  console.log(`   Then rebuild: npm run build:weapp`)
}

main().catch((err) => {
  console.error('\n❌ Upload failed:', err.message)
  process.exit(1)
})
