import { describe, expect, it } from 'vitest'

import { XIAOYUE_EXPRESSION_MATRIX } from './xiaoyueExpressionMatrix'
import { XIAOYUE_ASSET_BY_EXPRESSION, type XiaoyueExpressionId } from './xiaoyueExpressions'

describe('xiaoyue expression matrix', () => {
  it('maps every matrix row to a defined asset', () => {
    XIAOYUE_EXPRESSION_MATRIX.forEach((row) => {
      const path = XIAOYUE_ASSET_BY_EXPRESSION[row.expressionId]
      expect(path, row.surface).toMatch(/^\/assets\/personality\/xiaoyue\//)
    })
  })

  it('covers all expression ids in the asset map', () => {
    const ids = new Set(Object.keys(XIAOYUE_ASSET_BY_EXPRESSION) as XiaoyueExpressionId[])
    const used = new Set(XIAOYUE_EXPRESSION_MATRIX.map((r) => r.expressionId))
    ids.forEach((id) => {
      expect(used.has(id), `expression ${id} should appear in matrix`).toBe(true)
    })
  })
})
