import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildGenericEventActivityGuide } from '@shared/copy/eventActivityGuide'
import EventActivityGuide from './EventActivityGuide'
import { haptics } from '../../lib/utils/haptics'

vi.mock('@tarojs/components', () => ({
  Text: (props: Record<string, unknown>) => <span {...props} />,
  View: (props: Record<string, unknown>) => <div {...props} />,
}))

vi.mock('../../lib/utils/accessibility', () => ({
  getSystemReducedMotion: () => true,
}))

vi.mock('../../lib/utils/haptics', () => ({
  haptics: vi.fn(),
}))

const here = dirname(fileURLToPath(import.meta.url))
const tsx = readFileSync(resolve(here, 'EventActivityGuide.tsx'), 'utf-8')
const scss = readFileSync(resolve(here, 'EventActivityGuide.scss'), 'utf-8')
const guide = buildGenericEventActivityGuide()

beforeEach(() => {
  vi.clearAllMocks()
})

describe('EventActivityGuide', () => {
  it('is collapsed by default and expands the shared four-step copy on tap', () => {
    render(<EventActivityGuide />)
    expect(screen.getByText(guide.title)).toBeTruthy()
    expect(screen.getByText(guide.summary)).toBeTruthy()
    expect(screen.queryByText(guide.steps[0].text)).toBeNull()

    const toggle = screen.getByRole('button', { name: /具体安排/ })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(toggle)

    expect(screen.getByRole('button', { name: /收起安排/ })).toBeTruthy()
    for (const step of guide.steps) {
      expect(screen.getByText(step.text)).toBeTruthy()
    }
    expect(screen.getByText(guide.approximateNote)).toBeTruthy()
    expect(vi.mocked(haptics)).toHaveBeenCalledWith('light')
  })

  it('collapses on the next tap without any permanent seen state', () => {
    render(<EventActivityGuide />)
    fireEvent.click(screen.getByRole('button', { name: /具体安排/ }))
    expect(screen.getByText(guide.steps[3].text)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /收起安排/ }))
    expect(screen.queryByText(guide.steps[0].text)).toBeNull()
    expect(screen.getByRole('button', { name: /具体安排/ })).toBeTruthy()
    expect(vi.mocked(haptics)).toHaveBeenCalledTimes(2)
  })

  it('keeps the tap target, body size, haptics and reduced-motion contract', () => {
    expect(scss).toContain('min-height: 88rpx')
    expect(scss).toContain('font-size: $font-size-sm')
    expect(scss).toContain('font-size: $font-size-base')
    expect(scss).toContain('@media (prefers-reduced-motion: reduce)')
    expect(tsx).toContain("haptics('light')")
    expect(tsx).toContain("hoverClass='event-activity-guide__summary--pressed'")
    expect(tsx).toContain('getSystemReducedMotion()')
    expect(tsx).not.toContain('ScrollView')
    expect(tsx).not.toContain('TIER_RUN_PLANS')
    expect(tsx).not.toContain('lastTierVibe')
  })
})
