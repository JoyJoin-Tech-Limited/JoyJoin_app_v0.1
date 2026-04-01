import { describe, expect, it } from "vitest";
import { buildIcebreakerSessionDetailsResponse } from "../routes/domains/icebreakerSessions";

describe("icebreaker session contract", () => {
  it("returns the session-details shape expected by the client", () => {
    const result = buildIcebreakerSessionDetailsResponse({
      id: "session-1",
      eventId: "event-1",
      eventSource: "blind_box",
      eventTitle: "周三 19:00 · 饭局",
      eventType: "饭局",
      expectedAttendees: 4,
      atmosphereType: "balanced",
      participants: [
        {
          userId: "user-1",
          displayName: "小悦",
          archetype: "柯基",
          interests: ["城市漫步"],
          topicsHappy: ["城市漫步"],
          topicsAvoid: [],
        },
      ],
    });

    expect(result).toEqual({
      id: "session-1",
      eventId: "event-1",
      eventSource: "blind_box",
      eventTitle: "周三 19:00 · 饭局",
      eventType: "饭局",
      expectedAttendees: 4,
      atmosphereType: "balanced",
      participants: [
        {
          userId: "user-1",
          displayName: "小悦",
          archetype: "柯基",
          interests: ["城市漫步"],
          topicsHappy: ["城市漫步"],
          topicsAvoid: [],
        },
      ],
    });
  });
});
