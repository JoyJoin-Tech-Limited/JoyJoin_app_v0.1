import { z } from 'zod'
import type { SocialIcebreakerPhase } from './socialIcebreaker'

export const socialIcebreakerSelectPhaseSchema = z.object({
  phase: z.custom<SocialIcebreakerPhase>((val) => typeof val === 'string'),
  phaseSelectionId: z.string().min(1),
})

export type SocialIcebreakerSelectPhaseRequest = z.infer<typeof socialIcebreakerSelectPhaseSchema>

export const socialIcebreakerEndSessionSchema = z.object({
  phaseSelectionId: z.string().min(1),
})

export type SocialIcebreakerEndSessionRequest = z.infer<typeof socialIcebreakerEndSessionSchema>

export const socialIcebreakerAnalyticsEventSchema = z.object({
  eventType: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
  timestamp: z.string().optional(),
})

export type SocialIcebreakerAnalyticsEventRequest = z.infer<typeof socialIcebreakerAnalyticsEventSchema>
