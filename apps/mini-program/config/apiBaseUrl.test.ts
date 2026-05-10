import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import {
  DEFAULT_MINI_PROGRAM_API_BASE_URL,
  loadRepoRootEnvFile,
  resolveMiniProgramApiBaseUrl,
} from './apiBaseUrl'

const configSource = readFileSync(new URL('./index.ts', import.meta.url), 'utf8')
const tempDirs: string[] = []

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    rmSync(tempDir, { recursive: true, force: true })
  }
})

describe('mini-program build-time API base URL resolution', () => {
  // Guards against regression: the Taro build must explicitly read the repo
  // root .env so APP_URL can replace localhost in the generated bundle.
  it('loads the repo env file before resolving the mini-program API target', () => {
    expect(configSource).toContain("import { loadRepoRootEnvFile, resolveMiniProgramApiBaseUrl } from './apiBaseUrl'")
    expect(configSource).toContain('loadRepoRootEnvFile()')
    expect(configSource).toContain('const MINI_PROGRAM_API_BASE_URL = resolveMiniProgramApiBaseUrl()')
  })

  it('falls back to default when TARO_APP_API_BASE_URL is absent', () => {
    expect(resolveMiniProgramApiBaseUrl({
      APP_URL: 'http://192.168.100.105:5001/',
    })).toBe('http://localhost:5001')
  })

  it('loads APP_URL from the repo env file without overriding explicit env vars', () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), 'joyjoin-mini-program-env-'))
    tempDirs.push(tempDir)

    const envFilePath = path.join(tempDir, '.env')
    writeFileSync(envFilePath, [
      'APP_URL=http://192.168.100.105:5001/',
      'API_URL=http://192.168.100.106:5001/',
    ].join('\n'))

    const env: NodeJS.ProcessEnv = {
      TARO_APP_API_BASE_URL: 'http://override.example:5001/',
    }

    loadRepoRootEnvFile(envFilePath, env)

    expect(env).toMatchObject({
      TARO_APP_API_BASE_URL: 'http://override.example:5001/',
      API_URL: 'http://192.168.100.106:5001/',
      APP_URL: 'http://192.168.100.105:5001/',
    })
    expect(resolveMiniProgramApiBaseUrl(env)).toBe('http://override.example:5001')
  })

  it('falls back to the local default when no env target is present', () => {
    expect(resolveMiniProgramApiBaseUrl({})).toBe(DEFAULT_MINI_PROGRAM_API_BASE_URL)
  })
})