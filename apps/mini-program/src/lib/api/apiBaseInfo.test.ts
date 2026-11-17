import { describe, expect, it } from 'vitest'

import {
  DEFAULT_MINI_PROGRAM_API_BASE_URL,
  PRODUCTION_API_BASE_URL,
  STAGING_API_BASE_URL,
  resolveApiBaseInfo,
} from './apiBaseInfo'

describe('mini-program API base info', () => {
  it('forces the production backend for release builds regardless of build env', () => {
    expect(resolveApiBaseInfo('release', STAGING_API_BASE_URL)).toEqual({
      baseUrl: PRODUCTION_API_BASE_URL,
      envVersion: 'release',
      source: 'env-version',
    })
  })

  it('forces the staging backend for trial builds regardless of build env', () => {
    expect(resolveApiBaseInfo('trial', PRODUCTION_API_BASE_URL)).toEqual({
      baseUrl: STAGING_API_BASE_URL,
      envVersion: 'trial',
      source: 'env-version',
    })
  })

  it('uses the baked build target for develop builds', () => {
    expect(resolveApiBaseInfo('develop', `${PRODUCTION_API_BASE_URL}/`)).toEqual({
      baseUrl: PRODUCTION_API_BASE_URL,
      envVersion: 'develop',
      source: 'build-time',
    })
    expect(resolveApiBaseInfo('develop', STAGING_API_BASE_URL).baseUrl).toBe(STAGING_API_BASE_URL)
  })

  it('falls back to localhost when the build target is absent', () => {
    expect(resolveApiBaseInfo(undefined, undefined)).toEqual({
      baseUrl: DEFAULT_MINI_PROGRAM_API_BASE_URL,
      envVersion: 'unknown',
      source: 'build-time',
    })
  })
})
