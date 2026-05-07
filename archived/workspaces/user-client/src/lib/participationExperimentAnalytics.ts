/**
 * Participation Experiment Analytics
 *
 * Tracks Wave 2 experiment interactions so we can answer PM questions after
 * each experiment concludes. Follows the same pattern as onboardingAnalytics.ts:
 * events are POSTed to /api/analytics/participation_experiment and include a
 * session timestamp for funnel reconstruction.
 *
 * Metrics tracked per experiment:
 *
 * EXP_ATMOSPHERE_FRAMING
 *   atmosphere_framing_shown        — step rendered in experiment arm
 *   atmosphere_framing_selected     — user tapped an atmosphere tier
 *
 * EXP_SOCIAL_GOAL_REFRAMING
 *   goal_reframe_shown              — step rendered in experiment arm
 *   goal_reframe_primary_selected   — user chose a primary goal
 *   goal_reframe_secondary_added    — user added ≥ 1 secondary goal
 *
 * EXP_IGNITION_CONFIRMATION
 *   ignition_shown                  — swipe UI rendered
 *   ignition_swipe_started          — drag/swipe began
 *   ignition_swipe_completed        — drag crossed threshold → confirm fired
 *   ignition_swipe_abandoned        — drag released before threshold
 *   ignition_fallback_used          — accessible button tapped instead of swipe
 *
 * EXP_ARCHETYPE_WAITING
 *   archetype_waiting_shown         — personalised copy shown (includes archetype)
 */

import { apiRequest } from "./queryClient";

export type ParticipationExperimentEventType =
  // Atmosphere framing
  | "atmosphere_framing_shown"
  | "atmosphere_framing_selected"
  // Social goal reframing
  | "goal_reframe_shown"
  | "goal_reframe_primary_selected"
  | "goal_reframe_secondary_added"
  // Ignition confirmation
  | "ignition_shown"
  | "ignition_swipe_started"
  | "ignition_swipe_completed"
  | "ignition_swipe_abandoned"
  | "ignition_fallback_used"
  // Archetype waiting
  | "archetype_waiting_shown";

interface ParticipationExperimentEvent {
  eventType: ParticipationExperimentEventType;
  poolId?: string;
  metadata?: Record<string, unknown>;
  timestamp: number;
}

class ParticipationExperimentAnalytics {
  private track(
    eventType: ParticipationExperimentEventType,
    poolId?: string,
    metadata?: Record<string, unknown>,
  ): void {
    const event: ParticipationExperimentEvent = {
      eventType,
      poolId,
      metadata,
      timestamp: Date.now(),
    };

    // Fire-and-forget; failures are silent so they don't affect UX
    apiRequest("POST", "/api/analytics/participation_experiment", event).catch(
      () => {
        // Intentionally silenced — analytics must never break the user flow
      },
    );
  }

  atmosphereFramingShown(poolId: string): void {
    this.track("atmosphere_framing_shown", poolId);
  }

  atmosphereFramingSelected(poolId: string, tier: string): void {
    this.track("atmosphere_framing_selected", poolId, { tier });
  }

  goalReframeShown(poolId: string): void {
    this.track("goal_reframe_shown", poolId);
  }

  goalReframePrimarySelected(poolId: string, goal: string): void {
    this.track("goal_reframe_primary_selected", poolId, { goal });
  }

  goalReframeSecondaryAdded(poolId: string, goals: string[]): void {
    this.track("goal_reframe_secondary_added", poolId, {
      secondaryGoals: goals,
      count: goals.length,
    });
  }

  ignitionShown(poolId: string): void {
    this.track("ignition_shown", poolId);
  }

  ignitionSwipeStarted(poolId: string): void {
    this.track("ignition_swipe_started", poolId);
  }

  ignitionSwipeCompleted(poolId: string): void {
    this.track("ignition_swipe_completed", poolId);
  }

  ignitionSwipeAbandoned(poolId: string, progressPct: number): void {
    this.track("ignition_swipe_abandoned", poolId, { progressPct });
  }

  ignitionFallbackUsed(poolId: string): void {
    this.track("ignition_fallback_used", poolId);
  }

  archetypeWaitingShown(poolId: string, archetype: string): void {
    this.track("archetype_waiting_shown", poolId, { archetype });
  }
}

export const participationExperimentAnalytics =
  new ParticipationExperimentAnalytics();
