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
  it('pins the completion footer independently from the native ScrollView flex implementation', () => {
    const resultScroller = ruleBody('.flash-dialogue__story-panel--result .flash-dialogue__story-panel-scroll')
    const resultContent = ruleBody('.flash-dialogue__story-panel--result .flash-dialogue__story-panel-content')
    const footer = ruleBody('.flash-dialogue__story-panel-footer')

    expect(resultScroller).toContain('height: 100%')
    expect(resultScroller).not.toMatch(/(?:^|\n)\s*height:\s*0;/)
    expect(resultContent).toContain('padding-bottom: $flash-story-result-footer-reserve')
    expect(footer).toContain('position: absolute')
    expect(footer).toContain('right: 0')
    expect(footer).toContain('bottom: 0')
    expect(footer).toContain('left: 0')
  })
})
