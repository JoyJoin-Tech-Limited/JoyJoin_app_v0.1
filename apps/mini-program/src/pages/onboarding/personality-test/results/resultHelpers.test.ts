import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { ARCHETYPE_SEQUENCE } from './resultHelpers'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const spritesheetManifest = JSON.parse(
  readFileSync(path.join(currentDir, '../../assets/archetypes/archetype-spritesheet.json'), 'utf8'),
)

describe('resultHelpers regression guards', () => {
  // Critical invariant: the manifest grid order must match the animation
  // sequence exactly. If they drift, the slot lands on the wrong image.
  it('spritesheet manifest order matches ARCHETYPE_SEQUENCE', () => {
    const manifestOrder = Object.keys(spritesheetManifest.mapping)
    expect(manifestOrder).toEqual(ARCHETYPE_SEQUENCE)
  })

  // The slot animation relies on modulo-12 arithmetic. If the sequence
  // length changes without updating EXTENDED_COUNT / SNAP_THRESHOLD,
  // the animation will drift.
  it('ARCHETYPE_SEQUENCE has exactly 12 archetypes', () => {
    expect(ARCHETYPE_SEQUENCE).toHaveLength(12)
  })

  // Every archetype in the sequence must have a corresponding manifest entry.
  it('every ARCHETYPE_SEQUENCE entry has a spritesheet mapping', () => {
    for (const archetype of ARCHETYPE_SEQUENCE) {
      expect(spritesheetManifest.mapping).toHaveProperty(archetype)
    }
  })
})
