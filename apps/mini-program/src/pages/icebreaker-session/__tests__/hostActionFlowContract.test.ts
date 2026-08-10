import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(resolve(__dirname, '../index.tsx'), 'utf8')

function extractBlock(startToken: string, endToken: string): string {
  const start = source.indexOf(startToken)
  const end = source.indexOf(endToken, start)

  expect(start).toBeGreaterThanOrEqual(0)
  expect(end).toBeGreaterThan(start)

  return source.slice(start, end)
}

describe('icebreaker host action flow', () => {
  it('uses the fast social action sync pipeline for host flow changes', () => {
    expect(source).toContain("'select-phase',\n        '/select-phase'")
    expect(source).toContain("'end-session',\n        '/end-session'")
    expect(source).toContain("'set-tier',\n        '/set-tier'")
  })

  it('does not block custom phase or tier changes on a manual session refetch', () => {
    const customHandlers = extractBlock('const handleSelectCustomPhase = useCallback', 'const [topicsError')
    const tierHandler = extractBlock('const executeTierSwitch = useCallback', 'const handleConfirmTierSwitch')

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
})
