import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// The action-handler layer moved into useSocialActions.ts (2026-08-12 split);
// the page keeps the derived flow-sync copy and render surfaces. Both files
// are covered so the contract survives refactors in either direction.
const source = readFileSync(resolve(__dirname, '../index.tsx'), 'utf8')
const actionsSource = readFileSync(resolve(__dirname, '../hooks/useSocialActions.ts'), 'utf8')

describe('icebreaker host action flow', () => {
  it('uses the fast social action sync pipeline for host flow changes', () => {
    expect(actionsSource).toContain("'select-phase',\n        '/select-phase'")
    expect(actionsSource).toContain("'end-session',\n        '/end-session'")
    expect(actionsSource).toContain("'set-tier',\n        '/set-tier'")
  })

  it('does not block custom phase or tier changes on a manual session refetch', () => {
    const customHandlers = actionsSource.slice(
      actionsSource.indexOf('const handleSelectCustomPhase = useCallback'),
      actionsSource.indexOf('const [topicsError'),
    )
    const tierHandler = actionsSource.slice(
      actionsSource.indexOf('const executeTierSwitch = useCallback'),
      actionsSource.indexOf('const handleConfirmTierSwitch'),
    )

    expect(customHandlers).not.toContain('await socialSessionQuery.refetch()')
    expect(tierHandler).not.toContain('await socialSessionQuery.refetch()')
  })

  it('keeps a visible sync state for phase-moving actions', () => {
    expect(source).toContain("case 'advance':")
    expect(source).toContain('正在进入下一环节')
    expect(source).toContain("case 'select-phase':")
    expect(source).toContain('正在同步玩法')
    expect(source).toContain('icebreaker__phase-shell--syncing')
  })

  it('does not declare hooks after the loading and error early returns', () => {
    const postEarlyReturnRender = source.slice(source.indexOf('const phaseHeader ='))

    expect(postEarlyReturnRender).not.toMatch(/\buse(?:Memo|Callback|Effect|State|Ref)\s*\(/)
  })
})
