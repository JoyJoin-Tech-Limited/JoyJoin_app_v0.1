import { apiRequest } from '../api/api'
import { logWarn } from '../utils/logger'

export interface InteractionLatencyEvent {
  eventType: string
  metadata: {
    durationMs: number
    t0: number
  }
  timestamp: number
}

class InteractionLatency {
  /**
   * Marks the start of an interaction. Returns the tap timestamp (t0) that the
   * caller must hold and pass back to `trackInteraction` — sites stay
   * independent and never close over globals.
   */
  startInteraction(): number {
    return Date.now()
  }

  /**
   * Fire-and-forget baseline for tap-to-first-feedback latency. Never blocks
   * the UI and never changes state; failures are only logged.
   */
  trackInteraction(name: string, t0: number, feedbackAt?: number): void {
    const durationMs = (feedbackAt ?? Date.now()) - t0
    const event: InteractionLatencyEvent = {
      eventType: `interaction_${name}`,
      metadata: { durationMs, t0 },
      timestamp: Date.now(),
    }

    void apiRequest<{ success?: boolean }>({
      path: '/api/analytics/interaction',
      method: 'POST',
      data: event,
      handleUnauthorized: false,
    }).catch((error) => {
      const message = error instanceof Error ? error.message : 'unknown error'
      logWarn('[InteractionLatency] Failed to send interaction event', {
        eventType: event.eventType,
        message,
      })
    })
  }
}

/** Shared singleton instance — one fire-and-forget POST-tracker for interaction latency. */
export const interactionLatency = new InteractionLatency()
