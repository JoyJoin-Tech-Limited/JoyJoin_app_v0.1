import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const indexSource = readFileSync(
  resolve(process.cwd(), 'src/pages/icebreaker-session/index.tsx'),
  'utf8',
)
// Mini-script action handlers live in the useSocialActions hook (2026-08-12
// page split) — the path contract is asserted against the hook's source.
const actionsSource = readFileSync(
  resolve(process.cwd(), 'src/pages/icebreaker-session/hooks/useSocialActions.ts'),
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
const shellSource = readFileSync(
  resolve(process.cwd(), 'src/components/ui/AiGenerationShell.tsx'),
  'utf8',
)
const generationHookSource = readFileSync(
  resolve(process.cwd(), 'src/pages/icebreaker-session/hooks/useMiniScriptGeneration.ts'),
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
    expect(actionsSource).toMatch(
      /performSocialAction\('miniscript-assign-roles', '\/api\/miniscript\/assign-roles', \{\s*socialSessionId,/,
    )
    expect(actionsSource).toMatch(
      /performSocialAction\('miniscript-reveal-act', '\/api\/miniscript\/reveal-act', \{\s*socialSessionId,\s*targetAct,/,
    )
    expect(actionsSource).toMatch(
      /performSocialAction\('miniscript-vote', '\/api\/miniscript\/vote', \{\s*socialSessionId,\s*vote,/,
    )
    expect(actionsSource).toMatch(
      /performSocialAction\('miniscript-reveal-solution', '\/api\/miniscript\/reveal-solution', \{\s*socialSessionId,/,
    )
    expect(actionsSource).toMatch(
      /performSocialAction\('miniscript-ready', '\/api\/miniscript\/ready', \{\s*socialSessionId,\s*ready,/,
    )
    expect(generationHookSource).toContain("path: '/api/miniscript/generate'")
  })

  it('never sends mini-script actions through the session-scoped social-icebreaker path', () => {
    expect(actionsSource).not.toContain("buildSocialPath(socialSessionId, '/miniscript/")
    expect(actionsSource).not.toContain("'/miniscript/assign-roles'")
    expect(actionsSource).not.toContain("'/miniscript/reveal-act'")
    expect(actionsSource).not.toContain("'/miniscript/vote'")
    expect(actionsSource).not.toContain("'/miniscript/reveal-solution'")
    expect(actionsSource).not.toContain("'/miniscript/ready'")
  })

  it('keeps the library open after generation and refreshes session state without blocking', () => {
    // The hook initiates a non-blocking refetch inside the generation pipeline.
    expect(generationHookSource).toContain('void refetchSession()')
    expect(generationHookSource).not.toContain('await refetchSession()')
    // The page leaves the library open so the host can choose the generated script.
    const submitStart = indexSource.indexOf('const handleMiniScriptSubmit')
    const submitEnd = indexSource.indexOf('const handleMiniScriptModalClose', submitStart)
    const submitSource = indexSource.slice(submitStart, submitEnd)
    expect(submitSource).toContain('return submitMiniScriptGenerate(payload)')
    expect(submitSource).not.toContain('setMiniScriptModalOpen(false)')
  })

  it('polls real server progress and renders a determinate generation bar', () => {
    expect(generationHookSource).toContain("path: `/api/miniscript/generation-status?socialSessionId=")
    expect(configModalSource).toContain('AiGenerationShell')
    expect(shellSource).toContain("role='progressbar'")
    expect(shellSource).toContain('aria-valuenow={safeProgress}')
    expect(shellSource).toContain('estimatedTotalMs')
  })

  it('posts bonus-gate responses to the mounted /api/miniscript/bonus/* routes', () => {
    expect(bonusGateSource).toContain("path: '/api/miniscript/bonus/respond'")
    expect(bonusGateSource).toContain("path: '/api/miniscript/bonus/sentiment'")
    expect(bonusGateSource).not.toContain('social-icebreaker/${socialSessionId}/bonus')
  })

  // ── V2 P2 additions (2026-08-28, contract: additive only — existing
  // assertions above are never modified) ────────────────────────────────────

  it('posts V2 P2 actions to /api/miniscript/* with socialSessionId in the body', () => {
    // present-evidence: { socialSessionId, evidenceId, targetRoleSlot }
    expect(actionsSource).toMatch(
      /performSocialAction<\{ reactionText\?: string \}>\(\s*'miniscript-present-evidence',\s*'\/api\/miniscript\/present-evidence',\s*\{\s*socialSessionId,\s*evidenceId,\s*targetRoleSlot,/,
    )
    // open-motive-vote (host): { socialSessionId }
    expect(actionsSource).toMatch(
      /performSocialAction\('miniscript-open-motive-vote', '\/api\/miniscript\/open-motive-vote', \{\s*socialSessionId,/,
    )
  })

  it('never sends V2 P2 actions through the session-scoped social-icebreaker path', () => {
    expect(actionsSource).not.toContain("'/miniscript/present-evidence'")
    expect(actionsSource).not.toContain("'/miniscript/open-motive-vote'")
  })

  it('round-2 ballots ride the existing /api/miniscript/vote route with voteRound + motiveChoice', () => {
    // The hero view submits motive ballots through the SAME onVote action
    // (single vote route); the round discriminator travels inside the vote
    // object, never in the URL.
    const heroSource = readFileSync(
      resolve(process.cwd(), 'src/pages/icebreaker-session/phases/MiniScriptHeroView.tsx'),
      'utf8',
    )
    expect(heroSource).toContain('onVote({ voteRound: 2, motiveChoice })')
    expect(actionsSource).not.toContain("'/api/miniscript/vote-motive'")
    expect(actionsSource).not.toContain("'/api/miniscript/vote/round2'")
  })

  // ── V2 P3 additions (contract: additive only — existing assertions above
  // are never modified) ─────────────────────────────────────────────────────

  it('posts V2 P3 actions to /api/miniscript/* with socialSessionId in the body', () => {
    // confirm-read (presenter early release): { socialSessionId, evidenceId, targetRoleSlot }
    expect(actionsSource).toMatch(
      /performSocialAction\(\s*'miniscript-confirm-read',\s*'\/api\/miniscript\/confirm-read',\s*\{\s*socialSessionId,\s*evidenceId,\s*targetRoleSlot,/,
    )
    // advance-ceremony (host-paced beats): { socialSessionId }
    expect(actionsSource).toMatch(
      /performSocialAction\(\s*'miniscript-advance-ceremony',\s*'\/api\/miniscript\/advance-ceremony',\s*\{\s*socialSessionId,/,
    )
  })

  it('never sends V2 P3 actions through the session-scoped social-icebreaker path', () => {
    expect(actionsSource).not.toContain("'/miniscript/confirm-read'")
    expect(actionsSource).not.toContain("'/miniscript/advance-ceremony'")
  })
})
