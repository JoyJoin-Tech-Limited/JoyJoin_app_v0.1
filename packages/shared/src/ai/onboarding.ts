/**
 * AI Onboarding Response Contracts
 * AI入门AI响应契约
 *
 * Minimal shared types for AI-generated copy surfaces that appear
 * during onboarding (Concept 1 — profile preview card tagline).
 *
 * Design principles:
 *  - Purpose-specific: one type per onboarding AI surface
 *  - Non-authoritative: content is presentation-only; never drives
 *    onboarding progression or completion flags
 *  - Fallback-safe: every field that maps to rendered copy has a
 *    deterministic fallback value baked in at the service layer
 *  - Observable: AIResponseMeta is always included so the trace viewer
 *    can record provider, latency, and fallback usage
 *
 * Import via:
 *   import type { ProfileTaglineResponse } from '@shared/ai/onboarding';
 */

import type { AIResponseMeta } from '../types/aiMeta';

/**
 * Response shape for GET /api/onboarding/profile-tagline
 *
 * A single warm insight line that appears inside the existing
 * ProfilePortraitCard during the FinalProfileReviewPage.
 *
 * Guardrails:
 *  - insightLine is always present (service falls back to a curated
 *    archetype-keyed line if the LLM call fails or is unavailable)
 *  - content is presentation-only: no branching, no completion flags
 */
export interface ProfileTaglineResponse {
  /**
   * A short one-line social insight derived from the user's archetype,
   * top interests, and intent.  Reads in under ~2 seconds.
   * Max recommended length: 40 Chinese characters.
   */
  insightLine: string;

  /**
   * Observability metadata — provider, latency bucket, fallback flag.
   */
  meta: AIResponseMeta;
}
