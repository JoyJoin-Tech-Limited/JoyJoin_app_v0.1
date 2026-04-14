import { describe, expect, it, vi } from 'vitest'

vi.mock('@tarojs/taro', () => ({
  default: {
    getStorageSync: vi.fn(),
    setStorageSync: vi.fn(),
    getCurrentPages: vi.fn().mockReturnValue([]),
    getSystemInfoSync: vi.fn().mockReturnValue({}),
  },
}))

import { buildMiniProgramOnboardingAnalyticsEvent } from './onboardingAnalytics'

describe('mini-program onboarding analytics event builder', () => {
  it('builds runtime-safe event metadata and durations', () => {
    expect(
      buildMiniProgramOnboardingAnalyticsEvent({
        step: 'essential-data',
        eventType: 'step_completed',
        now: 2_000,
        sessionStartTime: 500,
        stepStartTime: 1_200,
        route: 'pages/onboarding/essential-data/index',
        systemInfo: {
          platform: 'ios',
          system: 'iOS 18.2',
          brand: 'Apple',
          model: 'iPhone 15 Pro',
          version: '8.0.0',
          language: 'zh_CN',
          screenWidth: 393,
          screenHeight: 852,
        },
        metadata: {
          nextStep: 'extended-data',
        },
      }),
    ).toEqual({
      step: 'essential-data',
      eventType: 'step_completed',
      timestamp: 2_000,
      sessionDuration: 1_500,
      stepDuration: 800,
      userAgent: 'joyjoin-mini-program | ios | iOS 18.2 | Apple | iPhone 15 Pro | 8.0.0',
      screenSize: '393x852',
      metadata: {
        nextStep: 'extended-data',
        appSurface: 'mini-program',
        runtime: 'taro',
        route: 'pages/onboarding/essential-data/index',
        platform: 'ios',
        system: 'iOS 18.2',
        brand: 'Apple',
        model: 'iPhone 15 Pro',
        version: '8.0.0',
        language: 'zh_CN',
        taroEnv: 'unknown',
      },
    })
  })

  it('fails closed on invalid duration inputs and missing device data', () => {
    expect(
      buildMiniProgramOnboardingAnalyticsEvent({
        step: 'personality-test',
        eventType: 'validation_failed',
        now: 900,
        sessionStartTime: 1_000,
        stepStartTime: 1_100,
      }),
    ).toEqual({
      step: 'personality-test',
      eventType: 'validation_failed',
      timestamp: 900,
      sessionDuration: 0,
      stepDuration: 0,
      userAgent: 'joyjoin-mini-program | unknown-platform | unknown-system | unknown-brand | unknown-model | unknown-version',
      screenSize: 'unknown',
      metadata: {
        appSurface: 'mini-program',
        runtime: 'taro',
        route: 'unknown',
        platform: 'unknown',
        system: 'unknown',
        brand: 'unknown',
        model: 'unknown',
        version: 'unknown',
        language: 'unknown',
        taroEnv: 'unknown',
      },
    })
  })
})