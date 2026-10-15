import { describe, expect, it } from 'vitest'
import { parseShareQrSceneCode } from './shareQrScene'

describe('parseShareQrSceneCode', () => {
  it('parses a plain ic= scene', () => {
    expect(parseShareQrSceneCode('ic=abc123')).toBe('abc123')
  })

  it('parses a URL-encoded scene (WeChat delivery)', () => {
    expect(parseShareQrSceneCode('ic%3Dabc123')).toBe('abc123')
  })

  it('returns empty for missing or non-string scenes', () => {
    expect(parseShareQrSceneCode(undefined)).toBe('')
    expect(parseShareQrSceneCode(null)).toBe('')
    expect(parseShareQrSceneCode('')).toBe('')
  })

  it('returns empty for foreign scenes (other qr sources)', () => {
    expect(parseShareQrSceneCode('poolId=42')).toBe('')
    expect(parseShareQrSceneCode('xyzabc123')).toBe('')
  })

  it('returns empty when the code violates the charset whitelist', () => {
    expect(parseShareQrSceneCode('ic=有repost')).toBe('')
    expect(parseShareQrSceneCode('ic=ab c')).toBe('')
    expect(parseShareQrSceneCode('ic=')).toBe('')
  })

  it('returns empty for over-length scenes', () => {
    expect(parseShareQrSceneCode(`ic=${'a'.repeat(40)}`)).toBe('')
  })
})
