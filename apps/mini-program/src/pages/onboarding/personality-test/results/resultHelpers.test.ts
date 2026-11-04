import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import { ARCHETYPE_DEFINITIONS } from '@shared/personality/archetypeNames'
import { archetypeRegistry } from '@shared/personality/archetypeRegistry'
import { getArchetypeSkills } from '@shared/personality/archetypeSkills'
import { ARCHETYPE_ASSET_MAP } from '../../../../lib/utils/archetypeAssets'
import {
  ARCHETYPE_SEQUENCE,
  buildAuthUserResultState,
  buildTypicalityLabel,
  getTraitEntries,
  resolveCurrentCanvasImage,
} from './resultHelpers'

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

describe('personality result data truthfulness', () => {
  it.each([
    ['missing', undefined],
    ['null', null],
    ['numeric text', '72'],
    ['non-numeric text', 'not-a-score'],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['-Infinity', Number.NEGATIVE_INFINITY],
  ])('omits a %s trait instead of synthesizing a score', (_caseName, value) => {
    const result = { traitScores: { A: value } } as unknown as Parameters<typeof getTraitEntries>[0]

    expect(getTraitEntries(result)).toEqual([])
  })

  it('returns no trait rows when the trait map is missing', () => {
    expect(getTraitEntries({ primaryArchetype: 'koala' })).toEqual([])
    expect(getTraitEntries(null)).toEqual([])
    expect(getTraitEntries(undefined)).toEqual([])
  })

  it('keeps a genuine numeric zero while omitting malformed sibling traits', () => {
    const result = {
      traitScores: {
        A: 0,
        O: null,
        C: '80',
        E: Number.NaN,
        X: Number.POSITIVE_INFINITY,
        P: 64.4,
      },
    } as unknown as Parameters<typeof getTraitEntries>[0]

    expect(getTraitEntries(result)).toEqual([
      { key: 'A', label: '亲和力', value: 0 },
      { key: 'P', label: '快乐值', value: 64 },
    ])
  })

  it.each([
    [true, '典型'],
    [false, '非典型'],
  ] as const)('maps anonymous isDecisive=%s to %s without changing the archetype', (isDecisive, prefix) => {
    expect(buildTypicalityLabel(isDecisive, '树洞考拉', '#516678')).toEqual({
      prefix,
      name: '树洞考拉',
      accent: '#516678',
    })
  })

  it('makes no typicality claim for an anonymous result with undefined isDecisive', () => {
    expect(buildTypicalityLabel(undefined, '树洞考拉', '#516678')).toBeUndefined()
  })

  it('builds an auth fallback without inventing match score, confidence, traits, or typicality', () => {
    const resolved = buildAuthUserResultState({ id: 'user-1', primaryArchetype: 'koala' })

    expect(resolved?.result.primaryArchetype).toBe('koala')
    expect(resolved?.result.traitScores ?? {}).toEqual({})
    expect(resolved?.result.topMatches ?? []).toEqual([])
    expect(resolved?.result.archetypeConfidence).toBeUndefined()
    expect(resolved?.result.isDecisive).toBeUndefined()
    expect(resolved?.topMatches).toEqual([])
    expect(getTraitEntries(resolved?.result)).toEqual([])
    expect(buildTypicalityLabel(resolved?.result.isDecisive, '树洞考拉', '#516678')).toBeUndefined()
  })

  it('applies the same malformed-trait truth table to an auth payload', () => {
    const resolved = buildAuthUserResultState({
      primaryArchetype: 'koala',
      traitScores: {
        A: undefined,
        O: null,
        C: '72',
        E: Number.NaN,
        X: Number.POSITIVE_INFINITY,
        P: 0,
      } as unknown as Record<string, number>,
    })

    expect(getTraitEntries(resolved?.result)).toEqual([
      { key: 'P', label: '快乐值', value: 0 },
    ])
  })

  it('uses genuine auth result fields, including zero and false, when present', () => {
    const topArchetypes = [{ archetype: 'corgi', score: 0, confidence: 0 }]
    const resolved = buildAuthUserResultState({
      id: 'user-2',
      archetype: 'koala',
      secondaryArchetype: 'owl',
      traitScores: { A: 0, O: 72 },
      topArchetypes,
      archetypeConfidence: 0,
      isDecisive: false,
    })

    expect(resolved?.result).toMatchObject({
      primaryArchetype: 'koala',
      secondaryArchetype: 'owl',
      traitScores: { A: 0, O: 72 },
      topMatches: topArchetypes,
      archetypeConfidence: 0,
      isDecisive: false,
    })
    expect(resolved?.topMatches).toEqual(topArchetypes)
    expect(getTraitEntries(resolved?.result)).toEqual([
      { key: 'A', label: '亲和力', value: 0 },
      { key: 'O', label: '开放性', value: 72 },
    ])
    expect(buildTypicalityLabel(resolved?.result.isDecisive, '树洞考拉', '#516678')?.prefix).toBe('非典型')
  })

  it('preserves a genuine decisive auth result as typical', () => {
    const resolved = buildAuthUserResultState({
      primaryArchetype: 'koala',
      archetypeConfidence: 0.72,
      isDecisive: true,
    })

    expect(resolved?.result.archetypeConfidence).toBe(0.72)
    expect(buildTypicalityLabel(resolved?.result.isDecisive, '树洞考拉', '#516678')?.prefix).toBe('典型')
  })
})
