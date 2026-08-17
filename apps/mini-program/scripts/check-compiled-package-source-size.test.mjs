import { afterEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  calculateCompiledPackageSourceSize,
  JOYJOIN_MAIN_PACKAGE_SAFETY_LIMIT_BYTES,
  WECHAT_MAIN_PACKAGE_LIMIT_BYTES,
} from './check-compiled-package-source-size.mjs'

const temporaryDirectories = []

function writeFixture(relativePath, size, root) {
  const filePath = path.join(root, relativePath)
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, Buffer.alloc(size))
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

describe('compiled package source size', () => {
  it('counts the exact compiled main package and excludes every subpackage root', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'joyjoin-compiled-size-'))
    temporaryDirectories.push(root)
    fs.writeFileSync(
      path.join(root, 'app.json'),
      JSON.stringify({
        subPackages: [
          { root: 'pages/onboarding', pages: ['index'] },
          { root: 'pages/alang', pages: ['dialogue/index'] },
        ],
      }),
    )
    writeFixture('common.js', 100, root)
    writeFixture('assets/icon.png', 20, root)
    writeFixture('pages/onboarding/index.js', 500, root)
    writeFixture('pages/alang/dialogue/index.js', 700, root)
    writeFixture('pages/alang-extra/index.js', 30, root)

    const appJsonBytes = fs.statSync(path.join(root, 'app.json')).size
    expect(calculateCompiledPackageSourceSize(root)).toEqual({
      mainPackageBytes: appJsonBytes + 150,
      totalBytes: appJsonBytes + 1_350,
      subpackageRoots: ['pages/onboarding', 'pages/alang'],
      crossPackageRequires: [],
    })
  })

  it('rejects a main chunk that reaches back into a subpackage chunk', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'joyjoin-compiled-size-'))
    temporaryDirectories.push(root)
    fs.writeFileSync(
      path.join(root, 'app.json'),
      JSON.stringify({ subPackages: [{ root: 'pages/onboarding', pages: ['index'] }] }),
    )
    fs.writeFileSync(
      path.join(root, 'common.js'),
      'require("./pages/onboarding/sub-common.js")',
    )

    expect(calculateCompiledPackageSourceSize(root).crossPackageRequires).toEqual([
      { file: 'common.js', packageRoot: 'pages/onboarding' },
    ])
  })

  it('keeps a safety margin below WeChat hard limit', () => {
    expect(JOYJOIN_MAIN_PACKAGE_SAFETY_LIMIT_BYTES).toBeLessThan(
      WECHAT_MAIN_PACKAGE_LIMIT_BYTES,
    )
    expect(
      WECHAT_MAIN_PACKAGE_LIMIT_BYTES - JOYJOIN_MAIN_PACKAGE_SAFETY_LIMIT_BYTES,
    ).toBeGreaterThanOrEqual(100 * 1024)
  })
})
