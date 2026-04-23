import { readdir, rm } from 'node:fs/promises'
import path from 'node:path'
import type { Plugin } from 'vite'

const STALE_WEAPP_PNG_PREFIXES = [
  'assets/personality/xiaoyue/',
  'pages/onboarding/assets/personality/archetypes/',
  'pages/experience/assets/empty-state/',
  'pages/experience/assets/matching/',
  'pages/experience/assets/qr/',
] as const
const WEAPP_ONLY_PRUNED_FILES = new Set<string>([
  'assets/fonts/Alimama/AlimamaFangYuanTiVF-Thin.ttf',
])

async function collectFiles(targetDir: string): Promise<string[]> {
  const entries = await readdir(targetDir, { withFileTypes: true })
  const nestedFiles = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(targetDir, entry.name)
    if (entry.isDirectory()) {
      return collectFiles(entryPath)
    }

    return entry.isFile() ? [entryPath] : []
  }))

  return nestedFiles.flat()
}

function normalizeRelativePath(targetPath: string, baseDir: string): string {
  return path.relative(baseDir, targetPath).split(path.sep).join('/')
}

function shouldDeleteFile(relativePath: string): boolean {
  if (WEAPP_ONLY_PRUNED_FILES.has(relativePath)) {
    return true
  }

  if (relativePath.endsWith('.map')) {
    return true
  }

  return relativePath.endsWith('.png')
    && STALE_WEAPP_PNG_PREFIXES.some((prefix) => relativePath.startsWith(prefix))
}

async function pruneWeappDist(distDir: string): Promise<void> {
  const files = await collectFiles(distDir)
  const removableFiles = files.filter((filePath) => shouldDeleteFile(normalizeRelativePath(filePath, distDir)))

  await Promise.all(removableFiles.map((filePath) => rm(filePath, { force: true })))
}

export function createPruneWeappDistPlugin(distDir: string): Plugin {
  return {
    name: 'joyjoin-prune-weapp-dist',
    apply: 'build',
    async closeBundle() {
      await pruneWeappDist(distDir)
    },
  }
}
