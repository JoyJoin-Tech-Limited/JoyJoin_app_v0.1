import { describe, expect, it } from 'vitest'

import { ERROR_CODE_GENERIC_FALLBACK } from '@shared/copy/errorBaselines'

import type { ApiError } from '../../lib/api/api'
import {
  describeSubmitError,
  isAlreadyRegisteredError,
  resolveMessage,
} from '../useOptimisticRegistration'

/**
 * Client half of the duplicate-submit trap fix (2026-09-10): the server now
 * returns code ALREADY_REGISTERED on duplicate pool-registration submits.
 * The client must detect it (terminal joined state, not a failure), map it
 * to governed copy instead of the generic fallback, and keep the raw server
 * code/message in diagnostics instead of swallowing them.
 */
function makeApiError(body: unknown, statusCode = 400): ApiError {
  const error = new Error(
    body && typeof body === 'object' && 'message' in body
      ? String((body as { message?: unknown }).message)
      : 'Request failed',
  ) as ApiError
  error.statusCode = statusCode
  error.data = body
  return error
}

describe('isAlreadyRegisteredError', () => {
  it('detects the ALREADY_REGISTERED code on the error body', () => {
    const err = makeApiError({ message: '你已经报名过这个活动了', code: 'ALREADY_REGISTERED' })
    expect(isAlreadyRegisteredError(err)).toBe(true)
  })

  it('rejects other codes, missing data, and non-object bodies', () => {
    expect(isAlreadyRegisteredError(makeApiError({ message: 'x', code: 'POOL_FULL' }))).toBe(false)
    expect(isAlreadyRegisteredError(makeApiError({ message: 'x' }))).toBe(false)
    expect(isAlreadyRegisteredError(makeApiError('<html>502</html>', 502))).toBe(false)
    expect(isAlreadyRegisteredError(new Error('network down'))).toBe(false)
    expect(isAlreadyRegisteredError(undefined)).toBe(false)
  })
})

describe('resolveMessage with ALREADY_REGISTERED', () => {
  it('maps to the governed duplicate-registration copy, not the generic fallback', () => {
    const err = makeApiError({ message: '你已经报名过这个活动了', code: 'ALREADY_REGISTERED' })
    const message = resolveMessage(err, 'submit-failed')
    expect(message).toBe('你已经报过名啦')
    expect(message).not.toBe(ERROR_CODE_GENERIC_FALLBACK)
  })
})

describe('resolveMessage — no generic-fallback swallowing', () => {
  it('maps every registration/payment code the server can emit', () => {
    const codes = [
      'POOL_NOT_FOUND',
      'ATTENDANCE_NOT_READY',
      'GATHERING_ROOM_DISABLED',
      'INVALID_COUPON',
      'NO_ACTIVE_ENTITLEMENT',
      'NO_AVAILABLE_EVENT_PACK_CREDITS',
      'PAYMENT_CREATION_FAILED',
      'WECHAT_BINDING_REQUIRED',
      'REGISTRATION_FAILED',
      'REGISTRATION_DISABLED',
      'PAYMENTS_DISABLED',
    ] as const
    for (const code of codes) {
      const message = resolveMessage(makeApiError({ message: 'x', code }), 'submit-failed')
      expect(message, `${code} must not fall back to the generic sentinel`).not.toBe(
        ERROR_CODE_GENERIC_FALLBACK,
      )
    }
  })

  it('surfaces the server Chinese message when the code is unmapped', () => {
    const err = makeApiError({ message: '这个局已经不能再加入了', code: 'SOME_FUTURE_CODE' })
    expect(resolveMessage(err, 'submit-failed')).toBe('这个局已经不能再加入了')
  })

  it('surfaces a localized transport message (Chinese, no body)', () => {
    expect(resolveMessage(new Error('请求超时，换个网络再试试'), 'submit-failed')).toBe(
      '请求超时，换个网络再试试',
    )
  })

  it('still falls back for English/technical errors (no leakage)', () => {
    expect(resolveMessage(makeApiError({ message: 'Internal Server Error' }, 500), 'submit-failed')).toBe(
      '提交没成功，再试一次',
    )
    expect(resolveMessage(new Error('boom'), 'submit-failed')).toBe('提交没成功，再试一次')
  })
})

describe('describeSubmitError', () => {
  it('surfaces raw status/code/message so mapped copy cannot swallow diagnostics', () => {
    const err = makeApiError({ message: '你已经报名过这个活动了', code: 'ALREADY_REGISTERED' })
    expect(describeSubmitError(err)).toEqual({
      statusCode: 400,
      serverCode: 'ALREADY_REGISTERED',
      serverMessage: '你已经报名过这个活动了',
    })
  })

  it('omits fields that are absent (non-API errors)', () => {
    expect(describeSubmitError(new Error('boom'))).toEqual({
      statusCode: undefined,
      serverCode: undefined,
      serverMessage: 'boom',
    })
  })
})
