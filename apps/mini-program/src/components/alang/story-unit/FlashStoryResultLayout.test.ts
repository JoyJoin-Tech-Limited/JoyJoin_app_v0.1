import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sourceRoot = resolve(process.cwd(), 'src')
const flashStyles = readFileSync(resolve(sourceRoot, 'pages/alang/flash.scss'), 'utf8')

function ruleBody(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return flashStyles.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`))?.[1] ?? ''
}

describe('Flash settled-story short viewport contract', () => {
  it('keeps the compact completion action inside the result card without native scrolling', () => {
    const resultScroller = ruleBody('.flash-dialogue__story-panel--result .flash-dialogue__story-panel-scroll')
    const resultPanel = ruleBody('.flash-dialogue__story-panel--result')
    const exitDock = ruleBody('.flash-dialogue__story-result-exit')
    const compactButton = ruleBody('.flash-dialogue__story-result-exit .flash-button')

    expect(resultScroller).toBe('')
    expect(resultPanel).toContain('height: auto')
    expect(resultPanel).toContain('overflow: hidden')
    expect(exitDock).not.toContain('position: absolute')
    expect(exitDock).not.toContain('bottom:')
    expect(exitDock).toContain('min-height: 88rpx')
    expect(exitDock).toContain('flex: none')
    expect(compactButton).toContain('width: auto')
  })
})
