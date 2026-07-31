import Taro from '@tarojs/taro'
import { apiRequest } from '../api/api'
import { logWarn } from '../utils/logger'

export type FlowKind = 'intro' | 'lifecycle'
export type FlowBannerId = 'event' | 'street'

export type FlowEventType =
  | 'flow_view'
  | 'flow_skip'
  | 'flow_cta_tap'
  | 'flow_banner_tap'
  | 'flow_detail_open'
  | 'flow_detail_back'
  | 'flow_node_tap'
  | 'flow_tap_ahead'
  | 'flow_complete'
  | 'flow_street_gate_hit'

/** Storage flag set when the user taps the 街头盲盒 banner. Read by the alang
 *  event page to attribute later gate-state views back to banner demand
 *  (D7 tripwire: >25% gate-hit ratio triggers a PM revisit). */
export const STREET_BANNER_TAPPED_STORAGE_KEY = 'jj_flow_street_banner_tapped:v1'

export function markStreetBannerTapped(): void {
  try {
    Taro.setStorageSync(STREET_BANNER_TAPPED_STORAGE_KEY, true)
  } catch {
    // Analytics-adjacent storage must never block the journey.
  }
}

export function takeStreetBannerTapped(): boolean {
  try {
    return Taro.getStorageSync(STREET_BANNER_TAPPED_STORAGE_KEY) === true
  } catch {
    return false
  }
}

export interface FlowAnalyticsEvent {
  eventType: FlowEventType
  metadata?: Record<string, unknown>
  timestamp: number
}

class FlowAnalytics {
  trackView(flow: FlowKind): void {
    this.track('flow_view', { flow })
  }

  trackSkip(flow: FlowKind, dwellMs: number): void {
    this.track('flow_skip', { flow, dwell_ms: dwellMs })
  }

  trackCtaTap(flow: FlowKind): void {
    this.track('flow_cta_tap', { flow })
  }

  trackBannerTap(banner: FlowBannerId, alangEnabled: boolean): void {
    if (banner === 'street') {
      markStreetBannerTapped()
    }
    this.track('flow_banner_tap', { flow: 'intro', banner, alang_enabled: alangEnabled })
  }

  trackDetailOpen(experience: FlowBannerId): void {
    this.track('flow_detail_open', { flow: 'intro', experience })
  }

  trackDetailBack(experience: FlowBannerId, dwellMs: number): void {
    this.track('flow_detail_back', { flow: 'intro', experience, dwell_ms: dwellMs })
  }

  trackNodeTap(flow: FlowKind, nodeId: string, nodeIndex: number): void {
    this.track('flow_node_tap', { flow, node_id: nodeId, node_index: nodeIndex })
  }

  trackTapAhead(flow: FlowKind): void {
    this.track('flow_tap_ahead', { flow })
  }

  trackComplete(flow: FlowKind, dwellMs: number, tappedAhead: boolean, nodesActivated: number): void {
    this.track('flow_complete', {
      flow,
      dwell_ms: dwellMs,
      tapped_ahead: tappedAhead,
      nodes_activated: nodesActivated,
    })
  }

  /** Fired by the alang event page when a gate state renders for a user who
   *  previously tapped the street banner. */
  trackStreetGateHit(gate: string): void {
    this.track('flow_street_gate_hit', { gate, source: 'street_banner_storage_flag' })
  }

  private track(
    eventType: FlowEventType,
    metadata?: Record<string, unknown>,
  ): void {
    const event: FlowAnalyticsEvent = {
      eventType,
      metadata: {
        ...metadata,
        appSurface: 'mini-program',
        runtime: 'taro',
      },
      timestamp: Date.now(),
    }

    void apiRequest<{ success?: boolean }>({
      path: '/api/analytics/flow',
      method: 'POST',
      data: event,
      handleUnauthorized: false,
    }).catch((error) => {
      const message = error instanceof Error ? error.message : 'unknown error'
      logWarn('[FlowAnalytics] Failed to send event', {
        eventType,
        message,
      })
    })
  }
}

/** Shared singleton instance — fire-and-forget, never throws into UI code. */
export const flowAnalytics = new FlowAnalytics()
