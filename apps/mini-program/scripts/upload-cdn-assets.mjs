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

function logSkip(file) {
  console.log(`   ✓ ${file} (already uploaded, skipping)`)
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
      if (code !== 0) reject(new Error(`Command failed with exit code ${code}: ${cmd} ${args.join(' ')}\n${stderr}`))
      else resolve(stdout)
    })
  })
}

// ─── RSYNC BACKEND ───
async function uploadRsync(files) {
  validateEnv(['CDN_RSYNC_HOST', 'CDN_RSYNC_PATH'])
  const host = process.env.CDN_RSYNC_HOST
  const user = process.env.CDN_RSYNC_USER ?? process.env.USER
  const remotePath = process.env.CDN_RSYNC_PATH
  const key = process.env.CDN_RSYNC_KEY

  const sshArgs = ['-o', 'StrictHostKeyChecking=no', '-o', 'UserKnownHostsFile=/dev/null']
  if (key) sshArgs.push('-i', key)

  // Quote args with spaces for shell command strings used by rsync -e
  const sshArgsQuoted = sshArgs.map((a) => (a.includes(' ') ? `'${a}'` : a))

  // Ensure remote directory exists
  if (!DRY_RUN) {
    await runCommand('ssh', [...sshArgs, `${user}@${host}`, `mkdir -p ${remotePath}`])
  }

  // Full directory mode — rsync whole source dir
  if (SOURCE_DIR) {
    const src = SOURCE_DIR.replace(/\/$/, '') + '/'
    const dest = `${user}@${host}:${remotePath}/`
    const rsyncCmd = ['rsync', '-avz', '--delete', '--checksum', '-e', `ssh ${sshArgsQuoted.join(' ')}`, src, dest]
    if (DRY_RUN) {
      console.log(`   [dry-run] Would rsync: ${src} → ${dest}`)
    } else {
      await runCommand('rsync', ['-avz', '--delete', '--checksum', '-e', `ssh ${sshArgsQuoted.join(' ')}`, src, dest])
    }
    return
  }

  // Manifest mode — upload individual files
  for (const { localPath, cdnPath } of files) {
    const srcInDist = path.join(DIST_DIR, localPath)
    const srcInSrc = path.join(SRC_DIR, localPath)
    const src = fs.existsSync(srcInDist) ? srcInDist : fs.existsSync(srcInSrc) ? srcInSrc : null
    if (!src) {
      console.warn(`   ⚠️ Source file missing in both dist/ and src/, skipping: ${localPath}`)
      continue
    }
    const dest = `${user}@${host}:${path.posix.join(remotePath, cdnPath)}`
    const destDir = path.posix.join(remotePath, path.posix.dirname(cdnPath))

    if (DRY_RUN) {
      console.log(`   [dry-run] Would rsync: ${src} → ${dest}`)
      continue
    }

    await runCommand('ssh', [...sshArgs, `${user}@${host}`, `mkdir -p ${destDir}`])
    await runCommand('rsync', ['-avz', '--checksum', '-e', `ssh ${sshArgsQuoted.join(' ')}`, src, dest])
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

  for (const { localPath, cdnPath } of files) {
    const srcInDist = path.join(DIST_DIR, localPath)
    const srcInSrc = path.join(SRC_DIR, localPath)
    const src = fs.existsSync(srcInDist) ? srcInDist : fs.existsSync(srcInSrc) ? srcInSrc : null
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

  for (const { localPath, cdnPath } of files) {
    const srcInDist = path.join(DIST_DIR, localPath)
    const srcInSrc = path.join(SRC_DIR, localPath)
    const src = fs.existsSync(srcInDist) ? srcInDist : fs.existsSync(srcInSrc) ? srcInSrc : null
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

  for (const { localPath, cdnPath } of files) {
    const srcInDist = path.join(DIST_DIR, localPath)
    const srcInSrc = path.join(SRC_DIR, localPath)
    const src = fs.existsSync(srcInDist) ? srcInDist : fs.existsSync(srcInSrc) ? srcInSrc : null
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
    files = manifest.assets

    let missingCount = 0
    for (const { localPath } of files) {
      const src = path.join(DIST_DIR, localPath)
      if (fs.existsSync(src)) {
        totalSize += fs.statSync(src).size
      } else {
        missingCount++
      }
    }

    logStep(`Backend: ${BACKEND}  |  Files: ${files.length}  |  Total size: ${formatSize(totalSize)}`)
    if (missingCount > 0) {
      console.warn(`   ⚠️ ${missingCount} source files are missing (run npm run build:weapp first)`)
    }

    if (!fs.existsSync(DIST_DIR)) {
      console.error(`❌ dist/ directory not found: ${DIST_DIR}`)
      console.error('   Run npm run build:weapp first.')
      process.exit(1)
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
