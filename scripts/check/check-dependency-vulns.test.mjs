/**
 * Unit tests for the dependency-vuln ratchet's runtime-surface resolution.
 *
 * Regression context (2026-10-22): `dirOf('apps/server')` returned '' for
 * workspace entries, so every workspace dependency was resolved from the repo
 * root. A package npm nested inside the workspace (e.g. the second
 * `drizzle-orm` copy under `apps/server/node_modules`) was therefore invisible
 * to the gate. The AC3 negative test — injecting a known-critical runtime
 * dependency — did NOT fail, which exposed it.
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { dirOf, resolveDep, collectRuntimeSurface } from './check-dependency-vulns.mjs'

test('dirOf keeps workspace roots so their own node_modules is searched first', () => {
  assert.equal(dirOf('apps/server'), 'apps/server')
  assert.equal(dirOf('packages/shared'), 'packages/shared')
  assert.equal(dirOf('apps/mini-program'), 'apps/mini-program')
})

test('dirOf strips node_modules segments down to the owning directory', () => {
  assert.equal(dirOf('node_modules/foo'), '')
  assert.equal(dirOf('apps/server/node_modules/foo'), 'apps/server')
  assert.equal(
    dirOf('node_modules/@tarojs/components/node_modules/swiper'),
    'node_modules/@tarojs/components',
  )
})

test('resolveDep prefers a workspace-local copy over the hoisted root copy', () => {
  const packages = {
    'apps/server': { dependencies: { 'drizzle-orm': '^0.45.4' } },
    'node_modules/drizzle-orm': { version: '0.39.1' },
    'apps/server/node_modules/drizzle-orm': { version: '0.45.4' },
  }
  assert.equal(
    resolveDep(packages, dirOf('apps/server'), 'drizzle-orm'),
    'apps/server/node_modules/drizzle-orm',
  )
})

test('resolveDep falls back to the hoisted root copy when the workspace has none', () => {
  const packages = {
    'apps/server': { dependencies: { pg: '^8.0.0' } },
    'node_modules/pg': { version: '8.16.0' },
  }
  assert.equal(resolveDep(packages, dirOf('apps/server'), 'pg'), 'node_modules/pg')
})

test('runtime surface includes nested workspace copies (form-data AC3 regression)', () => {
  const packages = {
    'apps/server': { dependencies: { 'form-data': '4.0.0' } },
    'node_modules/form-data': { version: '4.0.6' },
    'apps/server/node_modules/form-data': { version: '4.0.0', dependencies: {} },
  }
  const surface = collectRuntimeSurface(packages)
  assert.ok(
    surface.paths.has('apps/server/node_modules/form-data'),
    'a nested workspace copy is shipping surface and must be gated',
  )
})

test('dev-only nested copies stay off the shipping surface', () => {
  const packages = {
    'apps/mini-program': { dependencies: { '@tarojs/cli': '4.2.0' } },
    'node_modules/@tarojs/cli': { version: '4.2.0', dependencies: {} },
    'node_modules/@tarojs/cli/node_modules/lodash': { version: '4.17.21' },
    'node_modules/miniprogram-ci': { version: '1.0.0', dependencies: { lodash: '4.17.21' } },
    'node_modules/miniprogram-ci/node_modules/lodash': { version: '4.17.21' },
  }
  const surface = collectRuntimeSurface(packages)
  assert.ok(
    !surface.paths.has('node_modules/miniprogram-ci/node_modules/lodash'),
    'a dev-only build tool is not shipping surface',
  )
})

test('runtime surface walks transitive dependencies of runtime deps', () => {
  const packages = {
    'apps/server': { dependencies: { express: '^4.21.0' } },
    'node_modules/express': { version: '4.21.2', dependencies: { qs: '6.13.0' } },
    'node_modules/qs': { version: '6.13.0', dependencies: {} },
  }
  const surface = collectRuntimeSurface(packages)
  assert.ok(surface.paths.has('node_modules/express'))
  assert.ok(surface.paths.has('node_modules/qs'))
})
