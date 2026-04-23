import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const useAuthSource = readFileSync(new URL('./useAuth.ts', import.meta.url), 'utf8')
const authProviderSource = readFileSync(new URL('../providers/AuthProvider.tsx', import.meta.url), 'utf8')

describe('mini-program auth session gate', () => {
  it('keeps the auth query disabled until an explicit login activates the session', () => {
    expect(useAuthSource).toContain("isMiniProgramAuthSessionActivated")
    expect(useAuthSource).toContain('enabled: authSessionActivated')
  })

  it('skips foreground auth refreshes before an explicit login has occurred', () => {
    expect(authProviderSource).toContain("if (!isMiniProgramAuthSessionActivated()) {")
    expect(authProviderSource).toContain('void bootstrapMiniProgramAuthSession(client)')
  })
})
