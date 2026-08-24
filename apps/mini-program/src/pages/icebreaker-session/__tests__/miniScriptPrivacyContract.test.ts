import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  resolve(process.cwd(), 'src/pages/icebreaker-session/phases/MiniScriptHeroView.tsx'),
  'utf8',
)
const styles = readFileSync(
  resolve(process.cwd(), 'src/pages/icebreaker-session/phases/MiniScriptHeroView.scss'),
  'utf8',
)

describe('MiniScript PM privacy and reveal contract', () => {
  it('does not show the generated premise to players before role assignment', () => {
    // Player pre-assignment copy is the wait line; the premise renders only in
    // the host-gated preview content (and, post-assignment, behind the
    // collapsed 故事背景 disclosure).
    expect(source).toContain("'剧本已生成，等待主持人分配角色。'")
    expect(source).toContain("subPhase === 'preview' && isHost")
    expect(source).not.toContain('prompt={isHost ? framework.premise')
  })

  it('gives the host a structured pre-assignment story preview', () => {
    // Wave-2 restructure: headline title + meta + role chips + flow timeline,
    // with the full beats behind a collapsed disclosure.
    expect(source).toContain('查看完整剧本')
    expect(source).toContain('characters.map')
    expect(source).toContain('framework.act_flow.map')
  })

  it('renders the revealed who / what / why solution from server state', () => {
    expect(source).toContain('session.miniScriptRevealedSolution')
    expect(source).toContain('真相人物')
    expect(source).toContain('发生了什么')
    expect(source).toContain('背后原因')
  })

  it('mirrors the server vote-progress authority instead of a client all-voted gate', () => {
    // Wave-1 contract: canReveal (quorum OR vote open ≥ 90s) comes from the
    // server-recomputed miniScriptVoteProgress; the old client-side
    // all-assigned-voted gate is gone, and a 400 WAITING_FOR_VOTES surfaces
    // the remaining count rather than dead-ending.
    expect(source).toContain('voteProgress.canReveal')
    expect(source).not.toContain('allAssignedPlayersVoted')
    expect(source).toContain('WAITING_FOR_VOTES')
  })

  it('casts structured suspect-slot votes, not three required free-text inputs', () => {
    expect(source).toContain('suspectRoleSlot')
    expect(source).toContain('点一个你最怀疑的角色。')
    expect(source).not.toContain('miniscript-hero__vote-field')
  })

  it('keeps long role-card content inside a vertically scrollable back face', () => {
    expect(source).toMatch(/<ScrollView[\s\S]*?className='miniscript-hero__role-back-scroll'[\s\S]*?scrollY/)
    expect(source).toContain('向上滑动查看更多')
    expect(styles).toMatch(/&__role-front,\s*&__role-back\s*{[^}]*height:\s*520rpx;/s)
    expect(styles).toMatch(/&__role-back-scroll\s*{[^}]*min-height:\s*0;[^}]*flex:\s*1;/s)
    expect(styles).toMatch(/&__role-back-line\s*{[^}]*word-break:\s*normal;[^}]*overflow-wrap:\s*normal;/s)
  })
})
