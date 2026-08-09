import { describe, expect, it, vi } from 'vitest'

describe('mini-program location privacy declarations', () => {
  it('declares every WeChat location API used by the foreground map flow', async () => {
    vi.stubGlobal('defineAppConfig', (config: unknown) => config)
    const { default: config } = await import('./app.config')

    expect(config.requiredPrivateInfos).toEqual(expect.arrayContaining([
      'getLocation',
      'startLocationUpdate',
      'onLocationChange',
    ]))
  })
})
