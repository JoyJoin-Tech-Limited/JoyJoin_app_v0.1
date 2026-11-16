import { describe, expect, it } from 'vitest'
import { resolveVenueDealCardState } from './venueDealCardState'
import type { VenueDealSummary } from '@shared/api'

const deal: VenueDealSummary = {
  id: 'deal-1',
  kind: 'discount',
  valueOffPercent: 20,
  title: '悦聚同桌专属折扣',
  method: 'code',
  code: '悦聚同桌',
  venueName: '山止川行·南山店',
}

const base = { flagEnabled: true, venueAssignmentStatus: 'assigned' as const }

describe('resolveVenueDealCardState 真值表', () => {
  it('非保底池、有 deal → 正常票券', () => {
    expect(resolveVenueDealCardState({ ...base, deal })).toBe('ticket')
  })

  it('有效保底、未 assigned → locked', () => {
    expect(resolveVenueDealCardState({
      flagEnabled: true, hasGuaranteedDeal: true, hasGuaranteedDealBinding: true,
      venueAssignmentStatus: 'unassigned',
    })).toBe('locked')
  })

  it('保底权益被停用后：hasGuaranteedDeal=false、deal=null，但绑定仍在 → adjusted（整卡不得静默消失）', () => {
    expect(resolveVenueDealCardState({
      ...base, hasGuaranteedDeal: false, hasGuaranteedDealBinding: true, deal: null,
    })).toBe('adjusted')
  })

  it('保底有效但跨店/装配失败（正常响应 null）→ adjusted', () => {
    expect(resolveVenueDealCardState({
      ...base, hasGuaranteedDeal: true, hasGuaranteedDealBinding: true, deal: null,
    })).toBe('adjusted')
  })

  it('真实 refetch error 且有承诺/绑定 → error；deal 仍在时优先票券', () => {
    expect(resolveVenueDealCardState({ ...base, hasGuaranteedDeal: true, queryError: true })).toBe('error')
    expect(resolveVenueDealCardState({ ...base, hasGuaranteedDealBinding: true, queryError: true })).toBe('error')
    expect(resolveVenueDealCardState({ ...base, deal, queryError: true })).toBe('ticket')
  })

  it('非保底、正常响应无 deal → 不渲染', () => {
    expect(resolveVenueDealCardState({ ...base })).toBe('hidden')
  })

  it('flag off → 一切隐藏（含已有 deal）', () => {
    expect(resolveVenueDealCardState({ ...base, flagEnabled: false, deal })).toBe('hidden')
    expect(resolveVenueDealCardState({ ...base, flagEnabled: false, hasGuaranteedDealBinding: true })).toBe('hidden')
  })

  it('collapsed 小组不渲染', () => {
    expect(resolveVenueDealCardState({ ...base, isCollapsedGroup: true, deal })).toBe('hidden')
  })

  it('queryError 时不再落 adjusted（两种失败语义不混）', () => {
    expect(resolveVenueDealCardState({
      ...base, hasGuaranteedDealBinding: true, queryError: true,
    })).not.toBe('adjusted')
  })
})
