import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const pageRoot = resolve(process.cwd(), 'src/pages/icebreaker-session')

describe('AdvanceFuseBanner compact action layout', () => {
  it('keeps the primary action label on one line in WeChat buttons', () => {
    const component = readFileSync(resolve(pageRoot, 'components/AdvanceFuseBanner.tsx'), 'utf8')
    const styles = readFileSync(resolve(pageRoot, 'index.scss'), 'utf8')

    expect(component).toContain("className='icebreaker__stall-nudge-btn-label'")
    expect(styles).toContain('&__stall-nudge-btn-label')
    expect(styles).not.toMatch(/&__stall-nudge-btn\s*\{[^}]*\n\s*width:\s*0;/s)
  })
})
