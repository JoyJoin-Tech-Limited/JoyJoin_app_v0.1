import { describe, expect, it } from 'vitest'
import { evaluateProfessionInputQuality, isMeaningfulProfessionInput } from './professionInputQuality'

describe('professionInputQuality', () => {
  it('rejects empty, symbol-only, and low-information input', () => {
    expect(evaluateProfessionInputQuality('').reason).toBe('empty')
    expect(evaluateProfessionInputQuality(' ~ ').reason).toBe('symbol_only')
    expect(evaluateProfessionInputQuality('ki').reason).toBe('too_short')
    expect(evaluateProfessionInputQuality('kkkk').reason).toBe('repeated')
  })

  it('accepts common Chinese profession descriptions', () => {
    expect(isMeaningfulProfessionInput('产品经理')).toBe(true)
    expect(isMeaningfulProfessionInput('自由职业')).toBe(true)
    expect(isMeaningfulProfessionInput('学生')).toBe(true)
  })

  it('accepts short Latin profession abbreviations that users actually type', () => {
    expect(isMeaningfulProfessionInput('HR')).toBe(true)
    expect(isMeaningfulProfessionInput('IT')).toBe(true)
    expect(isMeaningfulProfessionInput('UI')).toBe(true)
    expect(isMeaningfulProfessionInput('PM')).toBe(true)
    expect(isMeaningfulProfessionInput('dev')).toBe(true)
  })
})
