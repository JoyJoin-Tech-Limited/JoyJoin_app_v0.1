import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const flags = readFileSync(resolve(__dirname, '../lib/featureFlags.ts'), 'utf8')
const auth = readFileSync(resolve(__dirname, '../lib/buildAuthUserResponse.ts'), 'utf8')

describe('S5 venueDealPromiseEnabled flag', () => {
  it('DB flag + env fallback，默认 false', () => {
    expect(flags).toContain('venueDealPromiseEnabled: "VENUE_DEAL_PROMISE_ENABLED"')
    expect(flags).toContain('venueDealPromiseEnabled: false')
  })

  it('通过 /api/auth/user features 暴露，客户端不读本地 env', () => {
    expect(auth).toContain("getFeatureFlag('venueDealPromiseEnabled', false)")
    expect(auth).toContain('venueDealPromiseEnabled,')
  })
})
