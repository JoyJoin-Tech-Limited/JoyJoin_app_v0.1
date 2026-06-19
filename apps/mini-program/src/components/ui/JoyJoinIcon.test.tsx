import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import JoyJoinIcon from './JoyJoinIcon'

vi.mock('@tarojs/components', () => ({
  Image: (props: Record<string, unknown>) => <img {...props} />,
  Text: (props: Record<string, unknown>) => <span {...props} />,
}))

describe('JoyJoinIcon', () => {
  it('keeps a stable hook order when switching from fallback text to a mapped icon', () => {
    const view = render(<JoyJoinIcon emoji='unmapped-icon' />)

    expect(view.getByText('unmapped-icon')).toBeTruthy()
    expect(() => view.rerender(<JoyJoinIcon emoji='✨' tier='mood' />)).not.toThrow()
  })
})
