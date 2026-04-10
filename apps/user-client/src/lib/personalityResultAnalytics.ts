import { apiRequest } from "@/lib/queryClient";

export type PersonalityResultEventType =
  | "personality_result_viewed"
  | "personality_text_share_copied"
  | "personality_share_variant_copied"
  | "personality_poster_opened"
  | "personality_native_share_used";

class PersonalityResultAnalytics {
  track(eventType: PersonalityResultEventType, metadata?: Record<string, unknown>): void {
    apiRequest("POST", "/api/analytics/personality_result", {
      eventType,
      metadata,
      timestamp: Date.now(),
    }).catch(() => {
      // Analytics must not block UX.
    });
  }
}

export const personalityResultAnalytics = new PersonalityResultAnalytics();
