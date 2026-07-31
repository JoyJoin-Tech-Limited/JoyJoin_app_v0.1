import {
  EXPERIENCE_DETAIL_COPY,
  FLOW1_ENTRY_COPY,
  FLOW2_NODE_COPY,
  resolveFlow2NodeDescription,
  type FlowLifecycleFacts,
} from '@shared/copy/flowAnimationCopy'
import type { ExperienceDefinition, FlowIconName, FlowAccent, FlowStepDefinition } from './flowAnimation.types'

export const FLOW_ANIMATION_TIMING = {
  /** Flow 1 entrance: packed-box beat + dual-banner settle. */
  boxBeatMs: 1_200,
  bannerSettleMs: 1_200,
  entranceTotalMs: 2_400,
  /** Flow 1 dual-banner / card reveal; starts as the box beat resolves (1.2s)
   *  so entrance box beat + reveal settle land at ~2.4s total. */
  experienceRevealMs: 1_200,
  /** Flow 2 lifecycle dwell curve: 0.8s / 4×1.2s / 1.5s ≈ 7.1s. */
  lifecycleStageDurationsMs: [800, 1_200, 1_200, 1_200, 1_200, 1_500] as const,
  /** Haptic at box lid apex during Flow 1 entrance. */
  boxApexMs: 550,
  /** Flow 2 completion beat. */
  glowSweepStartMs: 250,
  glowSweepDurationMs: 600,
  completionHapticMs: 850,
  ctaCrossfadeStartMs: 950,
  ctaCrossfadeDurationMs: 280,
  /** Timeline traveling indicator. */
  nodeTravelSettleMs: 300,
  nodeRingFadeMs: 240,
  /** Shared progress tick. */
  progressTickMs: 80,
} as const

interface StepMeta {
  id: string
  icon: FlowIconName
  accent: FlowAccent
}

const EVENT_STEP_META: readonly StepMeta[] = [
  { id: 'discover', icon: 'activity-discovery', accent: 'human' },
  { id: 'register', icon: 'activity-ticket', accent: 'human' },
  { id: 'match', icon: 'ai-match', accent: 'brand' },
  { id: 'offline', icon: 'offline-experience', accent: 'story' },
] as const

const STREET_STEP_META: readonly StepMeta[] = [
  { id: 'clue', icon: 'explore-location', accent: 'city' },
  { id: 'task', icon: 'street-task', accent: 'brand' },
  { id: 'explore', icon: 'city-exploration', accent: 'city' },
  { id: 'story', icon: 'city-story', accent: 'story' },
] as const

function buildSteps(
  copy: readonly { title: string; description: string }[],
  meta: readonly StepMeta[],
): FlowStepDefinition[] {
  return meta.map((m, index) => ({
    id: m.id,
    title: copy[index]?.title ?? '',
    description: copy[index]?.description ?? '',
    icon: m.icon,
    accent: m.accent,
  }))
}

export const EXPERIENCE_DEFINITIONS: readonly ExperienceDefinition[] = [
  {
    id: 'event',
    eyebrow: FLOW1_ENTRY_COPY.event.eyebrow,
    title: FLOW1_ENTRY_COPY.event.title,
    bannerLine: FLOW1_ENTRY_COPY.event.bannerLine,
    icon: 'formal-blind-box',
    detail: {
      heroSubtitle: EXPERIENCE_DETAIL_COPY.event.heroSubtitle,
      sceneTitle: EXPERIENCE_DETAIL_COPY.event.sceneTitle,
      closing: EXPERIENCE_DETAIL_COPY.event.closing,
    },
    steps: buildSteps(EXPERIENCE_DETAIL_COPY.event.steps, EVENT_STEP_META),
  },
  {
    id: 'street',
    eyebrow: FLOW1_ENTRY_COPY.street.eyebrow,
    title: FLOW1_ENTRY_COPY.street.title,
    bannerLine: FLOW1_ENTRY_COPY.street.bannerLine,
    icon: 'street-blind-box',
    detail: {
      heroSubtitle: EXPERIENCE_DETAIL_COPY.street.heroSubtitle,
      sceneTitle: EXPERIENCE_DETAIL_COPY.street.sceneTitle,
      closing: EXPERIENCE_DETAIL_COPY.street.closing,
    },
    steps: buildSteps(EXPERIENCE_DETAIL_COPY.street.steps, STREET_STEP_META),
  },
] as const

const LIFECYCLE_STEP_META: readonly StepMeta[] = [
  { id: 'registered', icon: 'activity-ticket', accent: 'brand' },
  { id: 'matching', icon: 'ai-match', accent: 'brand' },
  { id: 'grouped', icon: 'group-formed', accent: 'brand' },
  { id: 'revealed', icon: 'activity-reveal', accent: 'city' },
  { id: 'offline', icon: 'offline-experience', accent: 'city' },
  { id: 'story', icon: 'city-story', accent: 'story' },
] as const

/** Builds the six lifecycle nodes with the just-registered pool's real facts
 *  interpolated (client-side props only — never a fetch). Missing facts fall
 *  back to designed generic copy via resolveFlow2NodeDescription. */
export function buildLifecycleSteps(facts?: FlowLifecycleFacts | null): FlowStepDefinition[] {
  return LIFECYCLE_STEP_META.map((meta, index) => {
    const node = FLOW2_NODE_COPY[index]
    return {
      id: meta.id,
      title: node?.title ?? '',
      description: resolveFlow2NodeDescription(node?.description ?? '', facts),
      icon: meta.icon,
      accent: meta.accent,
    }
  })
}

/** Static no-facts variant (generic explainer fallback). */
export const LIFECYCLE_STEPS: readonly FlowStepDefinition[] = buildLifecycleSteps()
