import { afterEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  calculateCompiledPackageSourceSize,
  evaluateCompiledPackageSizes,
  JOYJOIN_MAIN_PACKAGE_HEADROOM_MARGIN_BYTES,
  JOYJOIN_MAIN_PACKAGE_SAFETY_LIMIT_BYTES,
  JOYJOIN_SUBPACKAGE_SAFETY_LIMIT_BYTES,
  WECHAT_MAIN_PACKAGE_LIMIT_BYTES,
  WECHAT_SOURCE_SIZE_OVERHEAD_BYTES,
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
      subpackages: [
        { root: 'pages/onboarding', bytes: 500 },
        { root: 'pages/alang', bytes: 700 },
      ],
      crossPackageRequires: [],
    })
  })

  it('attributes nested roots to the longest match and reports empty roots', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'joyjoin-compiled-size-'))
    temporaryDirectories.push(root)
    fs.writeFileSync(
      path.join(root, 'app.json'),
      JSON.stringify({
        subPackages: [
          { root: 'pages/alang', pages: ['dialogue/index'] },
          { root: 'pages/alang-story', pages: ['index'] },
          { root: 'pages/city-unlock', pages: ['index'] },
        ],
      }),
    )
    writeFixture('pages/alang/dialogue/index.js', 400, root)

    expect(calculateCompiledPackageSourceSize(root).subpackages).toEqual([
      { root: 'pages/alang', bytes: 400 },
      { root: 'pages/alang-story', bytes: 0 },
      { root: 'pages/city-unlock', bytes: 0 },
    ])
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

  it('accounts for the measured gap between this script and WeChat source accounting', () => {
    // 2026-10-15: this script measured 1909.1 KiB while WeChat refused the same
    // package ("main package source size 2063KB exceed max limit 2048KB"), so a
    // raw comparison would report headroom that does not exist. The overhead is
    // an estimate applied to a warning, not a gate: the upload is authoritative.
    expect(WECHAT_SOURCE_SIZE_OVERHEAD_BYTES).toBeGreaterThanOrEqual(150 * 1024)
    expect(
      JOYJOIN_MAIN_PACKAGE_SAFETY_LIMIT_BYTES +
        WECHAT_SOURCE_SIZE_OVERHEAD_BYTES +
        JOYJOIN_MAIN_PACKAGE_HEADROOM_MARGIN_BYTES,
    ).toBe(WECHAT_MAIN_PACKAGE_LIMIT_BYTES)
  })

  it('applies the same ceiling to subpackages, which WeChat limits per package', () => {
    expect(JOYJOIN_SUBPACKAGE_SAFETY_LIMIT_BYTES).toBe(
      JOYJOIN_MAIN_PACKAGE_SAFETY_LIMIT_BYTES,
    )
    expect(JOYJOIN_SUBPACKAGE_SAFETY_LIMIT_BYTES).toBeLessThan(
      WECHAT_MAIN_PACKAGE_LIMIT_BYTES - WECHAT_SOURCE_SIZE_OVERHEAD_BYTES,
    )
  })

  it('warns instead of failing when the estimated size exceeds the limit', () => {
    // 2026-10-15: the compiled main package measured 1909.5 KiB — byte-identical
    // to the pre-move run — while 175 KiB of room art had just left the main
    // package, because the compiler omits assets referenced only from JS string
    // literals. A size verdict on this basis must therefore never gate the build;
    // the authoritative verdict is the WeChat upload that runs right after.
    const { warnings, failures } = evaluateCompiledPackageSizes({
      mainPackageBytes: JOYJOIN_MAIN_PACKAGE_SAFETY_LIMIT_BYTES + 1,
      subpackages: [
        { root: 'pages/alang', bytes: JOYJOIN_SUBPACKAGE_SAFETY_LIMIT_BYTES + 1 },
      ],
      crossPackageRequires: [],
    })

    expect(failures).toEqual([])
    expect(warnings).toHaveLength(2)
    expect(warnings[0]).toContain('main source')
    expect(warnings[1]).toContain('subpackage pages/alang')
  })

  it('keeps cross-package requires fatal regardless of the size estimate', () => {
    const { warnings, failures } = evaluateCompiledPackageSizes({
      mainPackageBytes: 1,
      subpackages: [],
      crossPackageRequires: [{ file: 'common.js', packageRoot: 'pages/onboarding' }],
    })

    expect(warnings).toEqual([])
    expect(failures).toHaveLength(1)
    expect(failures[0]).toContain('common.js -> pages/onboarding')
  })
})
