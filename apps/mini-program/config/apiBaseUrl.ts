import { readFileSync } from 'node:fs'
import path from 'path'

export const REPO_ENV_PATH = path.resolve(__dirname, '..', '..', '..', '.env')
export const MINI_PROGRAM_ENV_PATH = path.resolve(__dirname, '..', '.env.local')
export const DEFAULT_MINI_PROGRAM_API_BASE_URL = 'http://localhost:5001'

export function parseEnvFile(envFileContent: string): Record<string, string> {
  const envEntries: Record<string, string> = {}

  for (const rawLine of envFileContent.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (line === '' || line.startsWith('#')) {
      continue
    }

    const normalizedLine = line.startsWith('export ')
      ? line.slice('export '.length).trim()
      : line
    const separatorIndex = normalizedLine.indexOf('=')

    if (separatorIndex <= 0) {
      continue
    }

    const key = normalizedLine.slice(0, separatorIndex).trim()
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      continue
    }

    let value = normalizedLine.slice(separatorIndex + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    envEntries[key] = value
  }

  return envEntries
}

export function loadRepoRootEnvFile(
  envPath = REPO_ENV_PATH,
  env: NodeJS.ProcessEnv = process.env,
): void {
  let envFileContent: string

  try {
    envFileContent = readFileSync(envPath, 'utf8')
  } catch {
    return
  }

  const envEntries = parseEnvFile(envFileContent)
  for (const [key, value] of Object.entries(envEntries)) {
    if (env[key] === undefined) {
      env[key] = value
    }
  }
}

export interface LoadMiniProgramEnvOptions {
  /**
   * Keys that already exist in the real process environment (CI-injected or
   * explicitly exported by the caller). Those must never be overridden by a
   * checked-in file, so production/staging build targets stay authoritative.
   */
  preserveKeys?: ReadonlySet<string>
}

export function loadMiniProgramEnvFile(
  envPath = MINI_PROGRAM_ENV_PATH,
  env: NodeJS.ProcessEnv = process.env,
  options: LoadMiniProgramEnvOptions = {},
): void {
  let envFileContent: string

  try {
    envFileContent = readFileSync(envPath, 'utf8')
  } catch {
    return
  }

  const envEntries = parseEnvFile(envFileContent)
  for (const [key, value] of Object.entries(envEntries)) {
    // .env.local is authoritative for mini-program builds: it overrides the
    // repo-root .env, which config/index.ts loads first. Keys supplied by the
    // real process environment (CI/CLI) still win so an explicit build target
    // is never silently replaced.
    if (options.preserveKeys?.has(key)) {
      continue
    }
    env[key] = value
  }
}

export function resolveMiniProgramApiBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  return (
    env.TARO_APP_API_BASE_URL ||
    DEFAULT_MINI_PROGRAM_API_BASE_URL
  ).replace(/\/$/, '')
}