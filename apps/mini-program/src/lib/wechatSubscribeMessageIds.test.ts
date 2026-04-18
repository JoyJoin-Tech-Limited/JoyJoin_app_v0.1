import { describe, expect, it } from 'vitest'
import { parseTemplateIds } from './wechatSubscribeMessageIds'

describe('parseTemplateIds', () => {
  it('splits comma-separated ids and trims', () => {
    expect(parseTemplateIds(' abc , def ')).toEqual(['abc', 'def'])
  })

  it('returns empty for undefined or empty', () => {
    expect(parseTemplateIds(undefined)).toEqual([])
    expect(parseTemplateIds('')).toEqual([])
  })
})
