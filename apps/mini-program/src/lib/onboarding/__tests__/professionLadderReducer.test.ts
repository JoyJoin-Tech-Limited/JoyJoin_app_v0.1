import { describe, expect, it } from 'vitest'
import { OCCUPATIONS } from '@shared/occupations'
import { findSegmentById } from '@shared/industryTaxonomy'
import {
  applyTierCorrection,
  countResolvedTiers,
  createLadderStateFromClassification,
  deriveTiersFromOccupation,
  normalizeLabelForDedup,
  rescopeCorrectionCandidates,
  resolveVisibleLadderRows,
  shouldMergeSegmentAndRole,
  toPersistedClassificationFields,
  type LadderTier,
  type LadderValue,
  type ProfessionLadderState,
} from '../professionLadderReducer'

const category: LadderValue = { id: 'tech', label: '科技互联网' }
const segment: LadderValue = { id: 'software_dev', label: '软件开发' }
const niche: LadderValue = { id: 'backend', label: '后端工程师' }
const occupation: LadderValue = { id: 'backend_engineer', label: '后端工程师' }

function fullState(): ProfessionLadderState {
  return {
    category,
    segment,
    niche,
    occupation,
    standardizedOccupationId: 'backend_engineer',
    corrected: false,
  }
}

// Fixtures pinned to the committed taxonomy.
const SEEDED_WITH_NICHE = 'frontend_engineer' // seedMappings { category, segment, niche }
const SEEDED_WITHOUT_NICHE = 'mobile_engineer' // seedMappings { category, segment }
const UNSEEDED = 'data_analyst' // no seedMappings

describe('professionLadderReducer · cascade (AC-05 / REL-01)', () => {
  it('changing 类别 clears 细分 / niche / 角色', () => {
    const next = applyTierCorrection(fullState(), 'category', {
      id: 'finance',
      label: '金融服务',
    })

    expect(next.category).toEqual({ id: 'finance', label: '金融服务' })
    expect(next.segment).toBeNull()
    expect(next.niche).toBeNull()
    expect(next.occupation).toBeNull()
    expect(next.standardizedOccupationId).toBeNull()
    expect(next.corrected).toBe(true)
  })

  it('changing 细分 clears niche / 角色 and keeps 类别', () => {
    const next = applyTierCorrection(fullState(), 'segment', {
      id: 'ai_ml',
      label: '人工智能',
    })

    expect(next.category).toEqual(category)
    expect(next.segment).toEqual({ id: 'ai_ml', label: '人工智能' })
    expect(next.niche).toBeNull()
    expect(next.occupation).toBeNull()
    expect(next.standardizedOccupationId).toBeNull()
  })

  it('changing 角色 to an unseeded occupation keeps the confirmed upper rows (state c)', () => {
    expect(OCCUPATIONS.find((o) => o.id === UNSEEDED)?.seedMappings).toBeUndefined()

    const next = applyTierCorrection(fullState(), 'occupation', {
      id: UNSEEDED,
      label: '数据分析师',
    })

    expect(next.category).toEqual(category)
    expect(next.segment).toEqual(segment)
    // niche cannot be derived without seedMappings — never guessed
    expect(next.niche).toBeNull()
    expect(next.occupation).toEqual({ id: UNSEEDED, label: '数据分析师' })
    expect(next.standardizedOccupationId).toBe(UNSEEDED)
  })

  it('all cascade orders leave no mixed parent/child triple', () => {
    // category → segment → occupation, and a second pass back up
    let state = fullState()
    state = applyTierCorrection(state, 'category', { id: 'finance', label: '金融服务' })
    state = applyTierCorrection(state, 'segment', { id: 'pe_vc', label: 'PE/VC' })
    state = applyTierCorrection(state, 'occupation', {
      id: 'investment_banker',
      label: '投行(IBD)',
    })

    // The derived triple must be coherent: category/segment must be the
    // canonical parents of the selected occupation (or preserved as a pair).
    if (state.segment) {
      expect(state.category).not.toBeNull()
    }
    expect(state.standardizedOccupationId).toBe('investment_banker')
    expect(toPersistedClassificationFields(state).industryCategory).toBe(state.category?.id ?? null)
  })

  it('is total — every tier correction produces a non-null state', () => {
    // 细分 must belong to the current 类别 (mixed-parent guard) — use a valid pair
    const choices: Record<LadderTier, LadderValue> = {
      category: { id: 'finance', label: '金融服务' },
      segment: { id: 'ai_ml', label: '人工智能' },
      occupation: { id: 'x', label: 'X' },
    }
    for (const tier of ['category', 'segment', 'occupation'] as const) {
      const next = applyTierCorrection(fullState(), tier, choices[tier])
      expect(next).toBeTruthy()
      expect(next.corrected).toBe(true)
    }
  })

  it('rejects a 细分 that does not belong to the current 类别 (mixed-parent guard)', () => {
    // pe_vc is a finance segment; the current 类别 is tech
    expect(findSegmentById('tech', 'pe_vc')).toBeUndefined()
    expect(findSegmentById('finance', 'pe_vc')).toBeTruthy()

    const state = fullState()
    const rejected = applyTierCorrection(state, 'segment', { id: 'pe_vc', label: 'PE/VC' })

    // state returned untouched — no mixed category=tech + segment=pe_vc pair,
    // and the corrected flag is not flipped by a rejected choice
    expect(rejected).toBe(state)
    expect(rejected.segment).toEqual(segment)
    expect(rejected.corrected).toBe(false)

    // after correcting 类别 to finance the same segment is legitimately accepted
    const correctedCategory = applyTierCorrection(state, 'category', {
      id: 'finance',
      label: '金融服务',
    })
    const accepted = applyTierCorrection(correctedCategory, 'segment', { id: 'pe_vc', label: 'PE/VC' })
    expect(accepted.segment).toEqual({ id: 'pe_vc', label: 'PE/VC' })
    expect(accepted.corrected).toBe(true)
  })
})

describe('professionLadderReducer · niche derivation (AC-06)', () => {
  it('state (a): seedMappings WITH niche → category + segment + niche', () => {
    const occ = OCCUPATIONS.find((o) => o.id === SEEDED_WITH_NICHE)
    expect(occ?.seedMappings?.niche).toBeTruthy()

    const derived = deriveTiersFromOccupation(SEEDED_WITH_NICHE)
    expect(derived).not.toBeNull()
    expect(derived?.category.id).toBeTruthy()
    expect(derived?.segment.id).toBeTruthy()
    expect(derived?.niche).not.toBeNull()
    expect(derived?.niche?.id).toBe(occ?.seedMappings?.niche)
  })

  it('state (b): seedMappings WITHOUT a niche key → category/segment + niche = null', () => {
    const occ = OCCUPATIONS.find((o) => o.id === SEEDED_WITHOUT_NICHE)
    expect(occ?.seedMappings).toBeTruthy()
    expect(occ?.seedMappings && 'niche' in occ.seedMappings).toBe(false)

    const derived = deriveTiersFromOccupation(SEEDED_WITHOUT_NICHE)
    expect(derived).not.toBeNull()
    expect(derived?.category.id).toBeTruthy()
    expect(derived?.segment.id).toBeTruthy()
    expect(derived?.niche).toBeNull()
  })

  it('state (c): no seedMappings → null (caller preserves upper rows)', () => {
    expect(deriveTiersFromOccupation(UNSEEDED)).toBeNull()
  })

  it('rejects unknown / empty ids instead of guessing', () => {
    expect(deriveTiersFromOccupation('not_a_real_occupation')).toBeNull()
    expect(deriveTiersFromOccupation('')).toBeNull()
    expect(deriveTiersFromOccupation(null)).toBeNull()
    expect(deriveTiersFromOccupation(undefined)).toBeNull()
  })

  it('role correction backfills upper tiers from one canonical source (state a)', () => {
    const startingState: ProfessionLadderState = {
      category: { id: 'finance', label: '金融服务' },
      segment: { id: 'pe_vc', label: 'PE/VC' },
      niche: { id: 'venture_capital', label: '风险投资' },
      occupation: { id: 'pe_vc', label: 'PE/VC投资' },
      standardizedOccupationId: 'pe_vc',
      corrected: false,
    }

    const next = applyTierCorrection(startingState, 'occupation', {
      id: SEEDED_WITH_NICHE,
      label: '前端工程师',
    })
    const derived = deriveTiersFromOccupation(SEEDED_WITH_NICHE)

    expect(next.category).toEqual(derived?.category)
    expect(next.segment).toEqual(derived?.segment)
    expect(next.niche).toEqual(derived?.niche)
    // upper tier reconciled from the same canonical source — never a mixed triple
    expect(next.category?.id).not.toBe(startingState.category?.id)
    expect(next.category?.id).toBe('tech')
  })
})

describe('professionLadderReducer · label de-dup (AC-22)', () => {
  it('normalizes role suffixes so 前端开发 ≈ 前端工程师', () => {
    expect(normalizeLabelForDedup('前端开发')).toBe(normalizeLabelForDedup('前端工程师'))
    expect(normalizeLabelForDedup(' 前端 工程师 ')).toBe('前端')
    expect(normalizeLabelForDedup('')).toBe('')
  })

  it('merges near-duplicate 细分 / 角色 labels', () => {
    expect(
      shouldMergeSegmentAndRole({ id: 'software_dev', label: '前端开发' }, {
        id: 'frontend_engineer',
        label: '前端工程师',
      }),
    ).toBe(true)

    expect(
      shouldMergeSegmentAndRole({ id: 'data_analytics', label: '数据' }, {
        id: 'data_analyst',
        label: '数据分析师',
      }),
    ).toBe(true)
  })

  it('keeps genuinely different tiers as separate rows', () => {
    expect(
      shouldMergeSegmentAndRole({ id: 'software_dev', label: '软件开发' }, {
        id: 'frontend_engineer',
        label: '前端工程师',
      }),
    ).toBe(false)

    expect(shouldMergeSegmentAndRole(null, occupation)).toBe(false)
    expect(shouldMergeSegmentAndRole(segment, null)).toBe(false)
  })

  it('drops the 细分 row when merged so the ladder never looks duplicated', () => {
    const mergedState: ProfessionLadderState = {
      ...fullState(),
      segment: { id: 'software_dev', label: '前端开发' },
      occupation: { id: 'frontend_engineer', label: '前端工程师' },
    }
    const rows = resolveVisibleLadderRows(mergedState)

    expect(rows.map((row) => row.tier)).toEqual(['category', 'occupation'])
    expect(rows.find((row) => row.tier === 'occupation')?.merged).toBe(true)

    const distinct = resolveVisibleLadderRows(fullState())
    expect(distinct.map((row) => row.tier)).toEqual(['category', 'segment', 'occupation'])
    expect(distinct.map((row) => row.label)).toEqual(['类别', '细分', '角色'])
  })
})

describe('professionLadderReducer · classification state + persistence', () => {
  it('builds all rows from a complete classification', () => {
    const state = createLadderStateFromClassification({
      occupationId: '前端工程师',
      standardizedOccupationId: 'frontend_engineer',
      industryCategory: 'tech',
      industryCategoryLabel: '科技互联网',
      industrySegmentNew: 'software_dev',
      industrySegmentLabel: '软件开发',
      industryNiche: 'frontend',
      industryNicheLabel: '前端工程师',
    })

    expect(countResolvedTiers(state)).toBe(3)
    expect(state?.occupation?.label).toBe('前端工程师')
    expect(state?.standardizedOccupationId).toBe('frontend_engineer')
    expect(state?.corrected).toBe(false)
  })

  it('falls back to the niche label during the §7.4 parallel-rollout window', () => {
    const state = createLadderStateFromClassification({
      occupationId: '前端开发',
      standardizedOccupationId: 'frontend', // legacy niche id, not an OCCUPATIONS.id
      industryCategory: 'tech',
      industryCategoryLabel: '科技互联网',
      industrySegmentNew: 'software_dev',
      industrySegmentLabel: '软件开发',
      industryNiche: 'frontend',
      industryNicheLabel: '前端工程师',
    })

    expect(state?.occupation?.label).toBe('前端工程师')
  })

  it('leaves 角色 unresolved when no canonical id exists (never uses raw text)', () => {
    const state = createLadderStateFromClassification({
      occupationId: '我是个很特别的自由职业者',
      standardizedOccupationId: null,
      industryCategory: 'tech',
      industryCategoryLabel: '科技互联网',
      industrySegmentNew: null,
      industrySegmentLabel: null,
      industryNiche: null,
      industryNicheLabel: null,
    })

    expect(state?.occupation).toBeNull()
    expect(countResolvedTiers(state)).toBe(1)
  })

  it('marks corrected state with source=user / confidence=1.0 (AC-07)', () => {
    const initial = createLadderStateFromClassification({
      standardizedOccupationId: 'backend_engineer',
      industryCategory: 'tech',
      industryCategoryLabel: '科技互联网',
      industrySegmentNew: 'software_dev',
      industrySegmentLabel: '软件开发',
      industryNiche: 'backend',
      industryNicheLabel: '后端工程师',
    })
    expect(initial).not.toBeNull()

    const uncorrected = toPersistedClassificationFields(initial!)
    expect(uncorrected.industrySource).toBeUndefined()

    const corrected = applyTierCorrection(initial!, 'occupation', {
      id: UNSEEDED,
      label: '数据分析师',
    })
    const fields = toPersistedClassificationFields(corrected)

    expect(fields.industrySource).toBe('user')
    expect(fields.industryConfidence).toBe(1)
    expect(fields.standardizedOccupationId).toBe(UNSEEDED)
    expect(fields.industryNiche).toBeNull()
    // codes and labels always move together
    expect(fields.industryCategoryLabel).toBe(corrected.category?.label ?? null)
  })

  it('returns null for a missing classification', () => {
    expect(createLadderStateFromClassification(null)).toBeNull()
    expect(createLadderStateFromClassification(undefined)).toBeNull()
    expect(resolveVisibleLadderRows(null)).toEqual([])
    expect(countResolvedTiers(null)).toBe(0)
  })
})

describe('professionLadderReducer · candidate re-scoping (REL-01)', () => {
  const candidates = {
    category: [
      { id: 'finance', label: '金融服务' },
      { id: 'tech', label: '科技互联网' },
    ],
    segment: [
      { id: 'ai_ml', label: '人工智能' }, // tech
      { id: 'software_dev', label: '软件开发' }, // tech
    ],
    occupation: [
      { id: 'frontend_engineer', label: '前端工程师' }, // seeded tech/software_dev
      { id: 'data_analyst', label: '数据分析师' }, // unseeded — unverifiable
    ],
  }

  it('drops seeded child-tier candidates of the old 类别 but keeps unseeded ones', () => {
    const next = rescopeCorrectionCandidates(candidates, 'category', {
      id: 'finance',
      label: '金融服务',
    })

    // segment candidates ai_ml/software_dev belong to tech, not finance -> dropped.
    expect(next?.segment).toEqual([])
    // frontend_engineer is seeded under tech -> dropped; data_analyst has no
    // seedMappings, so it is legitimate (spec §7.5 r3) and must be kept.
    expect(next?.occupation).toEqual([{ id: 'data_analyst', label: '数据分析师' }])
    // the parent-tier candidates stay untouched
    expect(next?.category).toEqual(candidates.category)
  })

  it('keeps child-tier candidates that provably belong to the new 类别 (and unseeded ones)', () => {
    const withFinanceChild = {
      ...candidates,
      occupation: [
        ...candidates.occupation,
        { id: 'investment_banker', label: '投行(IBD)' }, // seeded finance/investment_banking
      ],
    }
    const next = rescopeCorrectionCandidates(withFinanceChild, 'category', {
      id: 'finance',
      label: '金融服务',
    })

    // investment_banker (finance) survives; data_analyst (unseeded) survives;
    // frontend_engineer (seeded tech) is dropped.
    expect(next?.occupation).toEqual([
      { id: 'data_analyst', label: '数据分析师' },
      { id: 'investment_banker', label: '投行(IBD)' },
    ])
  })

  it('drops seeded 角色 candidates of the old 细分 but keeps unseeded ones', () => {
    const next = rescopeCorrectionCandidates(candidates, 'segment', {
      id: 'ai_ml',
      label: '人工智能',
    })

    // frontend_engineer is seeded under software_dev (not ai_ml) -> dropped;
    // data_analyst is unseeded -> kept.
    expect(next?.occupation).toEqual([{ id: 'data_analyst', label: '数据分析师' }])
    expect(next?.segment).toEqual(candidates.segment)
  })

  it('passes candidates through for 角色 corrections and null input', () => {
    expect(
      rescopeCorrectionCandidates(candidates, 'occupation', {
        id: 'frontend_engineer',
        label: '前端工程师',
      }),
    ).toBe(candidates)
    expect(rescopeCorrectionCandidates(null, 'category', { id: 'finance', label: '金融服务' })).toBeNull()
  })
})
