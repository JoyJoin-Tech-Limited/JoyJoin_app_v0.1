import { logInfo } from '../utils/logger'

const ALANG_ANALYTICS_PREFIX = 'alang_'

export function alangAnalytics(event: string, data?: Record<string, unknown>) {
  const fullEvent = `${ALANG_ANALYTICS_PREFIX}${event}`
  logInfo(`[Analytics] ${fullEvent}`, data ?? {})
  try {
    // @ts-ignore — wx.reportAnalytics is WeChat runtime
    if (typeof wx !== 'undefined' && wx.reportAnalytics) {
      wx.reportAnalytics(fullEvent, data ?? {})
    }
  } catch {
    // ignore
  }
}

export const alangEvents = {
  // Discover entry
  discoverCardImpression: () => alangAnalytics('discover_card_impression'),
  discoverCardTap: () => alangAnalytics('discover_card_tap'),

  // Event detail
  eventDetailView: (slug: string) => alangAnalytics('event_detail_view', { slug }),
  startSearchTap: (slug: string) => alangAnalytics('start_search_tap', { slug }),

  // Search
  searchPageView: (slug: string) => alangAnalytics('search_page_view', { slug }),
  mapViewTap: (slug: string) => alangAnalytics('map_view_tap', { slug }),
  foundAuto: (slug: string) => alangAnalytics('found_auto', { slug }),

  // Dialogue
  dialoguePageView: (slug: string, nodeId: string) => alangAnalytics('dialogue_page_view', { slug, nodeId }),
  choiceMade: (slug: string, nodeId: string, choiceIndex: number) => alangAnalytics('choice_made', { slug, nodeId, choiceIndex }),

  // Companion
  companionPageView: (slug: string) => alangAnalytics('companion_page_view', { slug }),
  arrivalReached: (slug: string) => alangAnalytics('arrival_reached', { slug }),
  confirmArrivalTap: (slug: string) => alangAnalytics('confirm_arrival_tap', { slug }),

  // Result
  resultPageView: (slug: string) => alangAnalytics('result_page_view', { slug }),
  resultConfirmTap: (slug: string) => alangAnalytics('result_confirm_tap', { slug }),

  // Story
  storyListView: () => alangAnalytics('story_list_view'),
  storyDetailView: (archiveId: string) => alangAnalytics('story_detail_view', { archiveId }),

  // Debug
  debugResetTap: (slug: string) => alangAnalytics('debug_reset_tap', { slug }),
  debugMockGpsTap: (slug: string) => alangAnalytics('debug_mock_gps_tap', { slug }),
  debugForceNodeTap: (slug: string, nodeId: string) => alangAnalytics('debug_force_node_tap', { slug, nodeId }),
} as const
