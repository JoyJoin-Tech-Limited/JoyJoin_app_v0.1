import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// 2026-07-28 device-recording audit (反馈 flow): five monochrome-purple faces
// at 64rpx + 0.5 opacity were indistinguishable on device, and the labels
// existed only in aria-labels. These locks keep the legibility fix shipped.
const RATING_FACE_TSX = resolve(__dirname, '..', 'RatingFace.tsx')
const RATING_FACE_SCSS = resolve(__dirname, '..', 'RatingFace.scss')

describe('RatingFace legibility (2026-07-28 audit)', () => {
  const tsx = readFileSync(RATING_FACE_TSX, 'utf-8')
  const scss = readFileSync(RATING_FACE_SCSS, 'utf-8')

  it('renders faces at 88rpx (was 64rpx — illegible silhouette art)', () => {
    expect(tsx).toContain('const sizeRpx = 88')
    expect(tsx).not.toContain('const sizeRpx = 64')
  })

  it('keeps unselected faces legible (0.72, was a washed-out 0.5)', () => {
    expect(tsx).toContain('opacity: isSelected ? 1 : 0.72')
    expect(tsx).not.toContain('opacity: isSelected ? 1 : 0.5')
  })

  it('shows the selected rating label as visible text, not aria-only', () => {
    expect(tsx).toContain("className='rating-face__caption'")
    expect(tsx).toContain('RATING_LABELS[value - 1]')
    // Caption reserves its line to avoid a layout jump on first selection.
    expect(scss).toContain('&__caption')
    expect(scss).toContain('min-height: 32rpx')
  })

  it('ships CSS for the new row/caption structure (class-coverage contract)', () => {
    expect(scss).toContain('&__row')
    expect(scss).toContain('&__container')
  })
})
