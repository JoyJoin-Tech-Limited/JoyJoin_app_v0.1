import { describe, expect, it } from 'vitest'
import {
  GLANCE_L1_WORD_REVEAL,
  GLANCE_L1_WORD_WAITING,
  GLANCE_L2_FRAMING_MICRO_CHALLENGE,
  GLANCE_L2_FRAMING_WARMUP,
  GLANCE_L2_HINT_MICRO_CHALLENGE,
  RITUAL_BEATS,
  RITUAL_CTA_START,
  RITUAL_CTA_WAIT,
  canOfferToastRitual,
  isHandshakeRitualGateOpen,
  resolveHandshakeRitualKind,
} from '../viewModels/glanceStackModel'

describe('glanceStackModel — locked spec strings (verbatim)', () => {
  it('ships the L1 words exactly as locked (spec §1.1/§1.2)', () => {
    expect(GLANCE_L1_WORD_WAITING).toBe('等人齐')
    expect(GLANCE_L1_WORD_REVEAL).toBe('揭晓')
  })

  it('ships the pilot L2 framing fragments exactly as locked (spec §3.3)', () => {
    expect(GLANCE_L2_FRAMING_WARMUP).toBe('这张卡问我们——')
    expect(GLANCE_L2_FRAMING_MICRO_CHALLENGE).toBe('一起来——')
    expect(GLANCE_L2_HINT_MICRO_CHALLENGE).toBe('做完了点一下')
  })

  it('ships the ritual CTA pair and beats exactly as locked (spec §6)', () => {
    expect(RITUAL_CTA_START).toBe('人齐了，开聊')
    expect(RITUAL_CTA_WAIT).toBe('再等等')
    expect(RITUAL_BEATS.countdown).toEqual(['3', '2', '1', '开聊！'])
    expect(RITUAL_BEATS.toast).toEqual(['这杯，敬新桌友——', '干杯！'])
    expect(RITUAL_BEATS.name_relay).toEqual(['我是 __ ，今天想聊 __ '])
  })
})

describe('glanceStackModel — ritual kind scene-split (locked §8 Q2/Q3)', () => {
  it('defaults to the unison countdown', () => {
    expect(resolveHandshakeRitualKind({})).toBe('countdown')
    expect(resolveHandshakeRitualKind({ vibe: 'balanced', tier: 'breeze' })).toBe('countdown')
  })

  it('reserves name relay for the 深聊 vibe regardless of tier or host pick', () => {
    expect(resolveHandshakeRitualKind({ vibe: 'deep_chat', tier: 'blaze', hostSelectedToast: true })).toBe('name_relay')
  })

  it('lets the host pick the toast only on glow/blaze tiers', () => {
    expect(resolveHandshakeRitualKind({ tier: 'glow', hostSelectedToast: true })).toBe('toast')
    expect(resolveHandshakeRitualKind({ tier: 'blaze', hostSelectedToast: true })).toBe('toast')
    expect(resolveHandshakeRitualKind({ tier: 'breeze', hostSelectedToast: true })).toBe('countdown')
    expect(resolveHandshakeRitualKind({ tier: 'custom', hostSelectedToast: true })).toBe('countdown')
  })

  it('offers the toast alternative to the host only on glow/blaze', () => {
    expect(canOfferToastRitual('glow')).toBe(true)
    expect(canOfferToastRitual('blaze')).toBe(true)
    expect(canOfferToastRitual('breeze')).toBe(false)
    expect(canOfferToastRitual(undefined)).toBe(false)
  })
})

describe('glanceStackModel — handshake ritual gate', () => {
  it('is open before any content signal exists', () => {
    expect(
      isHandshakeRitualGateOpen({ topicCount: 0, warmupTopicsStatus: 'idle', topicsError: false }),
    ).toBe(true)
  })

  it('closes on every server-observed start signal', () => {
    expect(isHandshakeRitualGateOpen({ topicCount: 3, topicsError: false })).toBe(false)
    expect(
      isHandshakeRitualGateOpen({ topicCount: 0, warmupTopicsStatus: 'generating', topicsError: false }),
    ).toBe(false)
    expect(
      isHandshakeRitualGateOpen({ topicCount: 0, topicsError: false, selectedMood: 'funny' }),
    ).toBe(false)
  })

  it('never traps a rejoining device (topics already dealt → closed)', () => {
    expect(
      isHandshakeRitualGateOpen({ topicCount: 5, warmupTopicsStatus: 'ready', topicsError: false }),
    ).toBe(false)
  })

  it('fails open to the normal error surface when generation failed', () => {
    expect(isHandshakeRitualGateOpen({ topicCount: 0, topicsError: true })).toBe(false)
  })
})
