import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { missionContentSchema } from '@shared/alang/contentSchema'
import type { AlangMissionProgress } from '@shared/schema'
import {
  canRevealCompanionDestination,
  redactMissionCoordinates,
} from '../lib/alang/alangDisclosure'

const storyPath = fileURLToPath(
  new URL('../../content/alang/stories/demo-story.json', import.meta.url),
)

function progressAt(stage: string): AlangMissionProgress {
  return { stage } as AlangMissionProgress
}

describe('Alang coordinate disclosure boundary', () => {
  it.each(['not_started', 'configuring', 'searching', 'found', 'dialogue'])(
    'does not reveal a route destination during %s',
    (stage) => {
      expect(canRevealCompanionDestination(progressAt(stage))).toBe(false)
    },
  )

  it.each(['companion', 'arrived', 'closing', 'result', 'completed'])(
    'allows the companion destination during %s',
    (stage) => {
      expect(canRevealCompanionDestination(progressAt(stage))).toBe(true)
    },
  )

  it('removes every search and companion coordinate from story content', () => {
    const raw = JSON.parse(readFileSync(storyPath, 'utf8'))
    const parsed = missionContentSchema.parse(raw)
    const redacted = redactMissionCoordinates(parsed)

    expect(redacted.meta?.defaultTargetLocation).toBeUndefined()
    expect(redacted.meta?.defaultCompanionEndLocation).toBeUndefined()
    expect(redacted.nodes.every((node) => node.gpsTrigger === undefined)).toBe(true)
  })
})
