import { describe, expect, it } from 'vitest'
import { resolveWelcomeGiftError } from './welcomeGiftError'

describe('resolveWelcomeGiftError', () => {
  it('classifies timeout without leaking the raw error', () => {
    const result = resolveWelcomeGiftError(new Error('Timeout after 12000ms at private-url'))
    expect(result.diagnostics).toEqual({ category: 'timeout' })
    expect(result.message).toContain('不影响进入发现')
    expect(result.message).not.toContain('private-url')
  })

  it('classifies transport failures as offline', () => {
    const error = Object.assign(new Error('request:fail private socket'), { isTransportError: true })
    const result = resolveWelcomeGiftError(error)
    expect(result.diagnostics).toEqual({ category: 'offline' })
    expect(result.message).toContain('网络')
  })

  it('keeps only the coded HTTP diagnostics and gives the unconfigured gift honest copy', () => {
    const error = Object.assign(new Error('secret server body'), {
      statusCode: 404,
      data: { code: 'WELCOME_COUPON_NOT_FOUND', debugMessage: 'never expose' },
      requestUrl: 'https://private.example',
    })
    const result = resolveWelcomeGiftError(error)
    expect(result.diagnostics).toEqual({
      category: 'http',
      statusCode: 404,
      code: 'WELCOME_COUPON_NOT_FOUND',
    })
    expect(result.message).toContain('暂未配置')
    expect(result.message).not.toContain('secret')
  })

  it('uses the server failure code without exposing its payload', () => {
    const error = Object.assign(new Error('SQL private details'), {
      statusCode: 500,
      data: { code: 'WELCOME_COUPON_CLAIM_FAILED', message: 'Failed to claim welcome coupon' },
    })
    expect(resolveWelcomeGiftError(error).diagnostics).toEqual({
      category: 'http',
      statusCode: 500,
      code: 'WELCOME_COUPON_CLAIM_FAILED',
    })
  })

  it('fails closed to an unknown category', () => {
    expect(resolveWelcomeGiftError({ unexpected: 'payload' }).diagnostics).toEqual({ category: 'unknown' })
  })
})
