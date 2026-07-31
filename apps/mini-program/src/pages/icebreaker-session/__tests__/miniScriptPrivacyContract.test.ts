import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  resolve(process.cwd(), 'src/pages/icebreaker-session/phases/MiniScriptHeroView.tsx'),
  'utf8',
)

describe('MiniScript PM privacy and reveal contract', () => {
  it('does not show the generated premise to players before role assignment', () => {
    expect(source).toContain("prompt={isHost ? framework.premise : '剧本已生成，等待主持人分配角色。'}")
  })

  it('gives the host an explicit pre-assignment story preview', () => {
    expect(source).toContain('主持人预览')
    expect(source).toContain('framework.characters.map')
    expect(source).toContain('framework.act_flow.map')
  })

  it('renders the revealed who / what / why solution from server state', () => {
    expect(source).toContain('session.miniScriptRevealedSolution')
    expect(source).toContain('真相人物')
    expect(source).toContain('发生了什么')
    expect(source).toContain('背后原因')
  })
})
