// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { ONBOARDING_VOICE_STEP_IDS, getOnboardingVoiceLine } from '@shared/copy/onboardingVoice'
import { ESSENTIAL_DATA_STEP_IDS } from './stepIds'

describe('essential-data ↔ voice matrix key mapping', () => {
  it('every essential-data step id resolves to a voice line', () => {
    for (const id of ESSENTIAL_DATA_STEP_IDS) {
      const key = `essential-${id}`
      expect(
        ONBOARDING_VOICE_STEP_IDS as readonly string[],
        `voice matrix missing key ${key}`,
      ).toContain(key)
      expect(getOnboardingVoiceLine(key as never, 'corgi')).toBeTruthy()
      expect(getOnboardingVoiceLine(key as never, null)).toBeTruthy()
    }
  })
})
