import { describe, expect, it } from 'vitest'
import {
  dedupeProfessionTags,
  isDuplicateProfessionSubmission,
  isUsableProfessionResponse,
  isUsableStoredProfessionClassification,
  normalizeProfessionSubmissionKey,
} from './professionSubmissionGuard'

describe('professionSubmissionGuard', () => {
  it('normalizes repeated submissions for comparison', () => {
    expect(normalizeProfessionSubmissionKey('  Product   Manager  ')).toBe('product manager')
    expect(isDuplicateProfessionSubmission(' 产品经理 ', { occupationId: '产品经理' })).toBe(true)
  })

  it('rejects fallback and unstructured profession responses', () => {
    expect(isUsableProfessionResponse({
      classification: { standardizedOccupationId: null, category: null, segment: null, niche: null },
      source: 'model',
      confidence: 0.9,
    })).toBe(false)

    expect(isUsableProfessionResponse({
      classification: { standardizedOccupationId: null, category: { id: 'tech', label: '技术' }, segment: null, niche: null },
      source: 'timeout_fallback',
      confidence: 0.9,
    })).toBe(false)
  })

  it('accepts structured profession responses with enough confidence', () => {
    expect(isUsableProfessionResponse({
      classification: { standardizedOccupationId: null, category: { id: 'tech', label: '技术' }, segment: null, niche: null },
      source: 'model',
      confidence: 0.62,
    })).toBe(true)
  })

  it('guards stored classification before final submit', () => {
    expect(isUsableStoredProfessionClassification({
      occupationId: '产品经理',
      industryCategory: 'product',
      industrySource: 'model',
      industryConfidence: 0.72,
    })).toBe(true)

    expect(isUsableStoredProfessionClassification({
      occupationId: 'ki',
      industryCategory: null,
      industrySource: 'fallback',
      industryConfidence: 0,
    })).toBe(false)
  })

  it('deduplicates display tags without keeping blank tags', () => {
    expect(dedupeProfessionTags([' 情绪高 ', '', '情绪高', '组织者'])).toEqual(['情绪高', '组织者'])
  })
})
