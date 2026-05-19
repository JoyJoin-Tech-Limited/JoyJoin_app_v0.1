import { describe, it, expect } from 'vitest'
import {
  sortPoolsByProximity,
  getClusterIdByDistrictName,
  getClusterProximity,
} from '../districts'

describe('getClusterIdByDistrictName', () => {
  it('maps internal districts correctly', () => {
    expect(getClusterIdByDistrictName('南山区')).toBe('nanshan')
    expect(getClusterIdByDistrictName('福田区')).toBe('futian')
  })

  it('maps external districts correctly', () => {
    expect(getClusterIdByDistrictName('罗湖区')).toBe('futian')
    expect(getClusterIdByDistrictName('宝安区')).toBe('nanshan')
    expect(getClusterIdByDistrictName('龙岗区')).toBe('futian')
  })

  it('normalizes trailing spaces', () => {
    expect(getClusterIdByDistrictName('南山区 ')).toBe('nanshan')
    expect(getClusterIdByDistrictName(' 福田区 ')).toBe('futian')
  })

  it('returns undefined for unknown districts', () => {
    expect(getClusterIdByDistrictName('未知区')).toBeUndefined()
    expect(getClusterIdByDistrictName('')).toBeUndefined()
  })
})

describe('getClusterProximity', () => {
  it('returns 0 for same cluster', () => {
    expect(getClusterProximity('nanshan', 'nanshan')).toBe(0)
    expect(getClusterProximity('futian', 'futian')).toBe(0)
  })

  it('returns positive value for different clusters', () => {
    expect(getClusterProximity('nanshan', 'futian')).toBe(20)
    expect(getClusterProximity('futian', 'nanshan')).toBe(20)
  })

  it('returns 999 for unknown clusters', () => {
    expect(getClusterProximity('nanshan', 'unknown')).toBe(999)
    expect(getClusterProximity('unknown', 'futian')).toBe(999)
  })
})

describe('sortPoolsByProximity', () => {
  const makePool = (district: string | null, dateTime: string) => ({
    id: `${district ?? 'null'}-${dateTime}`,
    district,
    dateTime,
  })

  it('returns empty array for empty input', () => {
    expect(sortPoolsByProximity([], 'nanshan')).toEqual([])
  })

  it('returns copy for single item', () => {
    const pools = [makePool('南山区', '2024-01-15T10:00:00Z')]
    const result = sortPoolsByProximity(pools, 'nanshan')
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual(pools[0])
    expect(result).not.toBe(pools) // should be a new array
  })

  it('sorts by proximity when reference cluster is provided', () => {
    const pools = [
      makePool('福田区', '2024-01-15T10:00:00Z'), // futian = 20min from nanshan
      makePool('南山区', '2024-01-15T10:00:00Z'), // nanshan = 0min
    ]
    const result = sortPoolsByProximity(pools, 'nanshan')
    expect(result[0].district).toBe('南山区')
    expect(result[1].district).toBe('福田区')
  })

  it('sorts by time when proximity is equal', () => {
    const pools = [
      makePool('南山区', '2024-01-15T12:00:00Z'), // later
      makePool('南山区', '2024-01-15T10:00:00Z'), // earlier
    ]
    const result = sortPoolsByProximity(pools, 'nanshan')
    expect(result[0].dateTime).toBe('2024-01-15T10:00:00Z')
    expect(result[1].dateTime).toBe('2024-01-15T12:00:00Z')
  })

  it('sorts unknown districts to the end', () => {
    const pools = [
      makePool('罗湖区', '2024-01-15T10:00:00Z'), // mapped to futian = 20
      makePool('未知区', '2024-01-15T10:00:00Z'), // unknown = 999
      makePool('南山区', '2024-01-15T10:00:00Z'), // nanshan = 0
    ]
    const result = sortPoolsByProximity(pools, 'nanshan')
    expect(result[0].district).toBe('南山区')
    expect(result[1].district).toBe('罗湖区')
    expect(result[2].district).toBe('未知区')
  })

  it('sorts by time when no reference cluster', () => {
    const pools = [
      makePool('福田区', '2024-01-15T12:00:00Z'),
      makePool('南山区', '2024-01-15T10:00:00Z'),
    ]
    const result = sortPoolsByProximity(pools, null)
    expect(result[0].dateTime).toBe('2024-01-15T10:00:00Z')
    expect(result[1].dateTime).toBe('2024-01-15T12:00:00Z')
  })

  it('handles pools with null district gracefully', () => {
    const pools = [
      makePool(null, '2024-01-15T10:00:00Z'),
      makePool('南山区', '2024-01-15T10:00:00Z'),
    ]
    const result = sortPoolsByProximity(pools, 'nanshan')
    expect(result[0].district).toBe('南山区')
    expect(result[1].district).toBeNull()
  })

  it('does not mutate original array', () => {
    const pools = [
      makePool('福田区', '2024-01-15T10:00:00Z'),
      makePool('南山区', '2024-01-15T10:00:00Z'),
    ]
    const originalOrder = pools.map((p) => p.district)
    sortPoolsByProximity(pools, 'nanshan')
    expect(pools.map((p) => p.district)).toEqual(originalOrder)
  })
})
