/**
 * Onboarding Discovery Payload
 * Pure function: resolves deterministic personality display data from archetype ID.
 * The mini-program calls this locally (imports from @joyjoin/shared/personality).
 */

import { getArchetype } from './archetypeRegistry';

import type { AIResponseMeta } from '../types/aiMeta';

export interface XiaoyueAnalysisPublicResult {
  headline: string;
  analysis: string;
  socialRole: string;
  bestScene: string;
  microAction: string;
  shareLine: string;
  stateLabel: string;
  whyThisFits: string;
  blendLine: string;
  expressionTags: string[];
  shareVariants: {
    selfIntro: string;
    friendCallout: string;
    socialInvite: string;
  };
  /** Standard AI observability metadata with AIGC compliance flags. */
  meta?: AIResponseMeta;
}

export interface DiscoveryPayload {
  assetKey: string;
  gradientKey: string;
  tagline: string;
  traits: string[];
  description: string;
  nickname: string;
  nameCn: string;
}

export function buildDiscoveryPayload(archetypeId: string): DiscoveryPayload | null {
  const record = getArchetype(archetypeId);
  if (!record) return null;
  return {
    assetKey: record.assetKey,
    gradientKey: record.displayTokens.gradientKey,
    tagline: record.narrative.tagline,
    traits: record.narrative.traits,
    description: record.narrative.description,
    nickname: record.narrative.nickname,
    nameCn: record.name,
  };
}
