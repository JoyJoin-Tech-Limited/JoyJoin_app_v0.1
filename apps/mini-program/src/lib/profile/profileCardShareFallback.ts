import {
  generateProfileCardPoster,
  type ProfileCardPosterInput,
} from './profileCardPoster'

export type ShareableProfileCard = Omit<ProfileCardPosterInput, 'qrCodeImagePath'>

export interface ProfileCardGenerationResult {
  filePath: string
  usedFallback: boolean
}

/**
 * A share action must not become a dead end when the fully equipped poster
 * cannot be drawn. The optional fallback is a simpler, still-shareable card;
 * if it also fails, its error propagates to the existing error UI.
 */
export async function generateProfileCardWithFallback(
  primaryCard: ProfileCardPosterInput,
  fallbackCard?: ShareableProfileCard,
  generate: (input: ProfileCardPosterInput) => Promise<string> = generateProfileCardPoster,
): Promise<ProfileCardGenerationResult> {
  try {
    return { filePath: await generate(primaryCard), usedFallback: false }
  } catch (primaryError) {
    if (!fallbackCard) throw primaryError
    return { filePath: await generate({ ...fallbackCard }), usedFallback: true }
  }
}
