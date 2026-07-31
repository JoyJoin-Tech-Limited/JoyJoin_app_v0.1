import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import { ARCHETYPE_DEFINITIONS } from '@shared/personality/archetypeNames'
import { archetypeRegistry } from '@shared/personality/archetypeRegistry'
import { getArchetypeSkills } from '@shared/personality/archetypeSkills'
import { ARCHETYPE_ASSET_MAP } from '../../../../lib/utils/archetypeAssets'
import { ARCHETYPE_SEQUENCE, resolveCurrentCanvasImage } from './resultHelpers'

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

  it('keeps every standalone character asset keyed to its canonical archetype', () => {
    for (const archetype of ARCHETYPE_SEQUENCE) {
      const assetPath = path.join(currentDir, `../../assets/archetypes/archetype-${archetype}.webp`)
      expect(() => readFileSync(assetPath)).not.toThrow()
    }
  })

  it('keeps all 12 character, name, keyword, skill, and asset records on one canonical ID', () => {
    for (const definition of ARCHETYPE_DEFINITIONS) {
      const record = archetypeRegistry[definition.id]
      const skills = getArchetypeSkills(definition.id)
      const assets = ARCHETYPE_ASSET_MAP[definition.id]

      expect(record?.id).toBe(definition.id)
      expect(record?.name).toBe(definition.nameCn)
      expect(record?.assetKey).toBe(definition.assetKey)
      expect(record?.narrative.traits).toHaveLength(3)
      expect(skills?.activeSkill.name).toBeTruthy()
      expect(skills?.passiveSkill.name).toBeTruthy()
      expect(assets?.webp).toContain(`archetype-${definition.assetKey}.webp`)
      expect(assets?.png).toContain(`archetype-${definition.assetKey}.png`)
    }
  })

  it('does not reuse a canvas image cached for a different archetype asset', async () => {
    const resolveImage = vi.fn().mockResolvedValue({ path: 'local://koala.webp' })

    const resolved = await resolveCurrentCanvasImage(
      'koala',
      ['/assets/archetype-koala.webp'],
      { asset: '/assets/archetype-hamster_praise.webp', path: 'local://hamster.webp' },
      resolveImage,
    )

    expect(resolveImage).toHaveBeenCalledWith({ src: '/assets/archetype-koala.webp' })
    expect(resolved).toEqual({
      asset: 'koala',
      path: 'local://koala.webp',
    })
  })

  it('falls back to the same archetype PNG when WebP resolution fails', async () => {
    const resolveImage = vi.fn()
      .mockRejectedValueOnce(new Error('local WebP unsupported'))
      .mockRejectedValueOnce(new Error('CDN WebP unsupported'))
      .mockResolvedValueOnce({ path: 'local://koala.png' })

    const resolved = await resolveCurrentCanvasImage(
      'koala',
      ['local://koala.webp', 'cdn://koala.webp', 'cdn://koala.png'],
      null,
      resolveImage,
      50,
    )

    expect(resolveImage).toHaveBeenCalledTimes(3)
    expect(resolved).toEqual({ asset: 'koala', path: 'local://koala.png' })
  })
})
