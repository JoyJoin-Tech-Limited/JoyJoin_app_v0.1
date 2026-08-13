import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AUDIO_MAX_TRACK_MS,
  AUDIO_PATTERN_TRACK,
  AUDIO_TRACK_PATHS,
  createSessionAudioPlayer,
} from './sessionAudio'
import { SOCIAL_HAPTIC_GRAMMAR, type SocialHapticPattern } from './haptics'

const taro = vi.hoisted(() => ({
  createInnerAudioContext: vi.fn(),
}))

vi.mock('@tarojs/taro', () => ({
  default: { createInnerAudioContext: taro.createInnerAudioContext },
}))

const ASSETS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../assets/audio')
const SAMPLE_RATE = 22050

function mockContext() {
  return {
    src: '',
    volume: 1,
    play: vi.fn(),
    stop: vi.fn(),
    destroy: vi.fn(),
  }
}

function wavDurationMs(filePath: string): number {
  const buffer = fs.readFileSync(filePath)
  const dataBytes = buffer.readUInt32LE(40)
  return (dataBytes / 2 / SAMPLE_RATE) * 1000
}

describe('S9 audio seasoning — grammar mirror', () => {
  it('mirrors EVERY S1 haptic pattern one-to-one', () => {
    expect(Object.keys(AUDIO_PATTERN_TRACK).sort()).toEqual(Object.keys(SOCIAL_HAPTIC_GRAMMAR).sort())
  })

  it('keeps the host Nudge audibly distinct from the group Nudge (separate track)', () => {
    expect(AUDIO_PATTERN_TRACK.socialHostNudge).not.toBe(AUDIO_PATTERN_TRACK.socialNudge)
    expect(AUDIO_TRACK_PATHS[AUDIO_PATTERN_TRACK.socialHostNudge]).not.toBe(
      AUDIO_TRACK_PATHS[AUDIO_PATTERN_TRACK.socialNudge],
    )
  })

  it('maps every pattern to an existing, sub-1s playable WAV placeholder', () => {
    for (const pattern of Object.keys(AUDIO_PATTERN_TRACK) as SocialHapticPattern[]) {
      const trackId = AUDIO_PATTERN_TRACK[pattern]
      const cdnPath = AUDIO_TRACK_PATHS[trackId]
      const fileName = path.basename(cdnPath)
      const filePath = path.join(ASSETS_DIR, fileName)
      expect(fs.existsSync(filePath), `${fileName} missing`).toBe(true)
      const buffer = fs.readFileSync(filePath)
      expect(buffer.toString('ascii', 0, 4)).toBe('RIFF')
      expect(buffer.toString('ascii', 8, 12)).toBe('WAVE')
      expect(wavDurationMs(filePath)).toBeLessThanOrEqual(AUDIO_MAX_TRACK_MS)
    }
  })
})

describe('S9 audio seasoning — player lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    taro.createInnerAudioContext.mockImplementation(() => mockContext())
  })

  it('preloads exactly one context per track (bounded ≤6)', () => {
    const player = createSessionAudioPlayer()
    player.prepare()
    expect(taro.createInnerAudioContext).toHaveBeenCalledTimes(6)
  })

  it('plays stop-then-play on the matching context (no stacking) and returns true', () => {
    const player = createSessionAudioPlayer()
    player.prepare()
    const ctx = taro.createInnerAudioContext.mock.results[0].value
    const fired = player.play('socialNudge')
    expect(fired).toBe(true)
    expect(ctx.stop).toHaveBeenCalled()
    expect(ctx.play).toHaveBeenCalled()
    expect(ctx.src).toContain('s1-nudge.wav')
    expect(ctx.volume).toBeLessThan(1)
  })

  it('never throws into the sensory pipeline when the bridge rejects', () => {
    taro.createInnerAudioContext.mockImplementation(() => {
      throw new Error('bridge down')
    })
    const player = createSessionAudioPlayer()
    expect(() => player.prepare()).not.toThrow()
    expect(player.play('socialReveal')).toBe(false)
  })

  it('returns false after destroy and tears down every context', () => {
    const player = createSessionAudioPlayer()
    player.prepare()
    const ctx = taro.createInnerAudioContext.mock.results[0].value
    player.destroy()
    expect(ctx.destroy).toHaveBeenCalled()
    expect(player.play('socialNudge')).toBe(false)
    const callCount = taro.createInnerAudioContext.mock.calls.length
    player.play('socialNudge')
    expect(taro.createInnerAudioContext.mock.calls.length).toBe(callCount)
  })
})
