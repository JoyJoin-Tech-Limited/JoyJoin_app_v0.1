import { describe, expect, it } from 'vitest'
import {
  ACTIVE_PERSONA_REGISTRATION_STATUSES,
  determineStateBand,
} from '../eventPoolPersonaRepo'
import type { PoolPersonaSnapshotResponse } from '@shared/api'

function makeDimension(
  key: string,
  total: number,
  clusters: Array<{ label: string; count: number; percentage: number }>,
  disclosed: boolean,
): PoolPersonaSnapshotResponse['dimensions'][number] {
  return {
    key: key as PoolPersonaSnapshotResponse['dimensions'][number]['key'],
    label: key,
    total,
    disclosed,
    clusters,
  }
}

const archetypeDisclosed = makeDimension(
  'archetype',
  5,
  [{ label: '开心柯基', count: 3, percentage: 60 }],
  true,
)
const archetypeUndisclosed = makeDimension(
  'archetype',
  2,
  [{ label: '开心柯基', count: 1, percentage: 50 }],
  false,
)
const industryDisclosed = makeDimension(
  'industry',
  7,
  [
    { label: '互联网/科技', count: 4, percentage: 57 },
    { label: '金融', count: 3, percentage: 43 },
  ],
  true,
)
const intentDisclosed = makeDimension(
  'intent',
  8,
  [
    { label: '深度聊天', count: 5, percentage: 63 },
    { label: '轻松破冰', count: 3, percentage: 38 },
  ],
  true,
)
const demographicsDisclosed = [
  makeDimension(
    'age',
    12,
    [
      { label: '25-29岁', count: 7, percentage: 58 },
      { label: '30-34岁', count: 5, percentage: 42 },
    ],
    true,
  ),
  makeDimension(
    'gender',
    12,
    [
      { label: '男生', count: 7, percentage: 58 },
      { label: '女生', count: 5, percentage: 42 },
    ],
    true,
  ),
]

describe('determineStateBand', () => {
  it('returns seed for empty pools', () => {
    expect(determineStateBand(0, [])).toBe('seed')
  })

  it('returns glimmer when no dimension thresholds are met but at least 3 have registered', () => {
    const dimensions = [archetypeUndisclosed]
    expect(determineStateBand(3, dimensions)).toBe('glimmer')
  })

  it('returns glimmer when exactly one dimension is disclosed', () => {
    const dimensions = [archetypeDisclosed, archetypeUndisclosed]
    expect(determineStateBand(5, dimensions)).toBe('glimmer')
  })

  it('returns outline when exactly two dimensions are disclosed', () => {
    const dimensions = [archetypeDisclosed, industryDisclosed]
    expect(determineStateBand(8, dimensions)).toBe('outline')
  })

  it('returns clear when three dimensions are disclosed', () => {
    const dimensions = [archetypeDisclosed, industryDisclosed, intentDisclosed]
    expect(determineStateBand(12, dimensions)).toBe('clear')
  })

  it('returns clear when all dimensions are disclosed but total is below full threshold', () => {
    const dimensions = [archetypeDisclosed, industryDisclosed, intentDisclosed, ...demographicsDisclosed]
    expect(determineStateBand(15, dimensions)).toBe('clear')
  })

  it('returns full when all dimensions are disclosed and total meets the full threshold', () => {
    const dimensions = [archetypeDisclosed, industryDisclosed, intentDisclosed, ...demographicsDisclosed]
    expect(determineStateBand(16, dimensions)).toBe('full')
  })

  it('does not return full if any dimension is missing', () => {
    const dimensions = [archetypeDisclosed, industryDisclosed, intentDisclosed, demographicsDisclosed[0]]
    expect(determineStateBand(20, dimensions)).toBe('clear')
  })
})

describe('pool persona registration scope', () => {
  it('includes every active registration shown by the pool card', () => {
    expect(ACTIVE_PERSONA_REGISTRATION_STATUSES).toEqual(['pending', 'matched'])
  })
})
