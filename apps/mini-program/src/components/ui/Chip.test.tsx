import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import Chip from './Chip'

vi.mock('@tarojs/components', () => ({
  View: (props: Record<string, unknown>) => <div {...props} />,
  Text: (props: Record<string, unknown>) => <span {...props} />,
}))

function chipClass(view: ReturnType<typeof render>) {
  return view.container.querySelector('.chip')?.className ?? ''
}

describe('Chip heat mode', () => {
  it.each([1, 2, 3] as const)('assembles chip--selected chip--level-%s chip--heat', (level) => {
    const view = render(<Chip label='火锅' selected level={level} heat />)
    const classes = chipClass(view).split(' ')
    expect(classes).toContain('chip--selected')
    expect(classes).toContain(`chip--level-${level}`)
    expect(classes).toContain('chip--heat')
  })

  it('heat without level keeps chip--heat but adds no level class', () => {
    const view = render(<Chip label='火锅' selected heat />)
    const classes = chipClass(view).split(' ')
    expect(classes).toContain('chip--heat')
    expect(classes.some((item) => item.startsWith('chip--level-'))).toBe(false)
  })

  it('non-heat level semantics (e.g. PersonalityDice difficulty) never get chip--heat', () => {
    const view = render(<Chip label='简单' selected level={2} />)
    const classes = chipClass(view).split(' ')
    expect(classes).toContain('chip--level-2')
    expect(classes).not.toContain('chip--heat')
  })

  it('unselected chip carries neither selected nor level heat classes', () => {
    const view = render(<Chip label='火锅' heat level={1} />)
    const classes = chipClass(view).split(' ')
    expect(classes).not.toContain('chip--selected')
    expect(classes).toContain('chip--heat')
  })
})
