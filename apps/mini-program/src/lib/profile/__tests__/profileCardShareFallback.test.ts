import { describe, expect, it, vi } from 'vitest'

import { generateProfileCardWithFallback } from '../profileCardShareFallback'

describe('profile card share fallback', () => {
  it('returns a shareable avatar-and-date card when the primary poster fails', async () => {
    const fallbackCard = {
      displayName: '小悦',
      tagline: '10月27日 周二',
      pixelArchetypeId: 'corgi',
    }
    const generate = vi.fn()
      .mockRejectedValueOnce(new Error('equipment layer failed'))
      .mockResolvedValueOnce('/tmp/gathering-room-memory-fallback.png')

    const result = await generateProfileCardWithFallback(
      { displayName: '小悦', qrCodeImagePath: '/tmp/qr.png' },
      fallbackCard,
      generate,
    )

    expect(result).toEqual({
      filePath: '/tmp/gathering-room-memory-fallback.png',
      usedFallback: true,
    })
    expect(generate).toHaveBeenNthCalledWith(2, fallbackCard)
    expect(generate.mock.calls[1][0]).toMatchObject({
      pixelArchetypeId: 'corgi',
      tagline: '10月27日 周二',
    })
  })

  it('preserves the original failure when no fallback was supplied', async () => {
    const failure = new Error('canvas missing')
    const generate = vi.fn().mockRejectedValue(failure)

    await expect(generateProfileCardWithFallback(
      { displayName: '小悦' },
      undefined,
      generate,
    )).rejects.toThrow('canvas missing')
    expect(generate).toHaveBeenCalledTimes(1)
  })
})
