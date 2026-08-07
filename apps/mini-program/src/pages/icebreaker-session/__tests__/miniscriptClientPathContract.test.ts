import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const indexSource = readFileSync(
  resolve(process.cwd(), 'src/pages/icebreaker-session/index.tsx'),
  'utf8',
)
const bonusGateSource = readFileSync(
  resolve(process.cwd(), 'src/pages/icebreaker-session/overlays/BonusGateOverlay.tsx'),
  'utf8',
)
const configModalSource = readFileSync(
  resolve(process.cwd(), 'src/pages/icebreaker-session/overlays/MiniScriptConfigModal.tsx'),
  'utf8',
)

// The server mounts the whole mini-script surface under `/api/miniscript/*`
// (domains/icebreaker.ts -> domains/miniscript.ts), with socialSessionId read
// from the request BODY. The client must never post to the session-scoped
// `/api/social-icebreaker/:id/miniscript/*` alias — those routes do not exist
// and return 404, which previously blocked the bonus gate and every action
// after generate (2026-08-06).
describe('MiniScript client-server path contract', () => {
  it('posts all mini-script actions to /api/miniscript/* with socialSessionId in the body', () => {
    expect(indexSource).toMatch(
      /performSocialAction\('miniscript-assign-roles', '\/api\/miniscript\/assign-roles', \{\s*socialSessionId,/,
    )
    expect(indexSource).toMatch(
      /performSocialAction\('miniscript-reveal-act', '\/api\/miniscript\/reveal-act', \{\s*socialSessionId,\s*targetAct,/,
    )
    expect(indexSource).toMatch(
      /performSocialAction\('miniscript-vote', '\/api\/miniscript\/vote', \{\s*socialSessionId,\s*vote,/,
    )
    expect(indexSource).toMatch(
      /performSocialAction\('miniscript-reveal-solution', '\/api\/miniscript\/reveal-solution', \{\s*socialSessionId,/,
    )
    expect(indexSource).toMatch(
      /performSocialAction\('miniscript-ready', '\/api\/miniscript\/ready', \{\s*socialSessionId,\s*ready,/,
    )
    expect(indexSource).toContain("path: '/api/miniscript/generate'")
  })

  it('never sends mini-script actions through the session-scoped social-icebreaker path', () => {
    expect(indexSource).not.toContain("buildSocialPath(socialSessionId, '/miniscript/")
    expect(indexSource).not.toContain("'/miniscript/assign-roles'")
    expect(indexSource).not.toContain("'/miniscript/reveal-act'")
    expect(indexSource).not.toContain("'/miniscript/vote'")
    expect(indexSource).not.toContain("'/miniscript/reveal-solution'")
    expect(indexSource).not.toContain("'/miniscript/ready'")
  })

  it('closes the generation modal before refreshing session state', () => {
    const submitStart = indexSource.indexOf('const submitMiniScriptGenerate')
    const submitEnd = indexSource.indexOf('// PR1', submitStart)
    const submitSource = indexSource.slice(submitStart, submitEnd)
    const closeIndex = submitSource.indexOf('setMiniScriptModalOpen(false)')
    const refetchIndex = submitSource.indexOf('socialSessionQuery.refetch()')

    expect(closeIndex).toBeGreaterThan(-1)
    expect(refetchIndex).toBeGreaterThan(closeIndex)
    expect(submitSource).not.toContain('await socialSessionQuery.refetch()')
  })

  it('polls real server progress and renders a determinate generation bar', () => {
    expect(indexSource).toContain("path: `/api/miniscript/generation-status?socialSessionId=")
    expect(configModalSource).toContain("role='progressbar'")
    expect(configModalSource).toContain('aria-valuenow={progress}')
    expect(configModalSource).toContain('estimatedTotalMs')
  })

  it('posts bonus-gate responses to the mounted /api/miniscript/bonus/* routes', () => {
    expect(bonusGateSource).toContain("path: '/api/miniscript/bonus/respond'")
    expect(bonusGateSource).toContain("path: '/api/miniscript/bonus/sentiment'")
    expect(bonusGateSource).not.toContain('social-icebreaker/${socialSessionId}/bonus')
  })
})
