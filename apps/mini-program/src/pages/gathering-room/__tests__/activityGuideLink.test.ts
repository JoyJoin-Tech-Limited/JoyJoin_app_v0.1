import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Quiet Concierge: gathering-room must deep-link to the pool event-detail
 * surface that owns EventActivityGuide, not to a second in-room guide.
 */
describe('gathering-room activity guide deep link', () => {
  it('prefers poolId for event-detail and does not embed a second guide', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/pages/gathering-room/index.tsx'),
      'utf8',
    )
    expect(source).toContain('roomState?.poolId ?? blindBoxEventId')
    expect(source).toContain('blindBoxEventId || roomState?.poolId')
    expect(source).not.toContain('EventActivityGuide')
  })
})
