/**
 * Unit tests for `resolveConnectionsContext`.
 *
 * Coverage:
 *   - empty events → no-events
 *   - upcoming events take priority over past events
 *   - past events without feedback → feedback-pending (most recent first)
 *   - all past events have feedback → feedback-complete
 *   - invalid/missing dateTime values are ignored
 */

import { describe, expect, it } from "vitest";
import { resolveConnectionsContext } from "../lib/connectionsContextResolver";

function makeEvent(id: string, title: string, dateTime: Date): { id: string; title?: string; dateTime?: string } {
  return { id, title, dateTime: dateTime.toISOString() };
}

describe("resolveConnectionsContext", () => {
  const now = new Date("2026-06-17T12:00:00.000Z");

  it("returns no-events when the user has joined no events", () => {
    const result = resolveConnectionsContext([], new Set(), now);
    expect(result).toEqual({ mode: "no-events" });
  });

  it("prioritizes upcoming events over past events", () => {
    const events = [
      makeEvent("past-1", "Past Event", new Date("2026-06-15T10:00:00.000Z")),
      makeEvent("future-1", "Future Event", new Date("2026-06-18T10:00:00.000Z")),
      makeEvent("past-2", "Another Past Event", new Date("2026-06-14T10:00:00.000Z")),
    ];

    const result = resolveConnectionsContext(events, new Set(), now);
    expect(result).toEqual({
      mode: "upcoming-event",
      upcomingEventTitle: "Future Event",
    });
  });

  it("picks the nearest upcoming event when multiple exist", () => {
    const events = [
      makeEvent("future-2", "Later Event", new Date("2026-06-20T10:00:00.000Z")),
      makeEvent("future-1", "Sooner Event", new Date("2026-06-18T10:00:00.000Z")),
    ];

    const result = resolveConnectionsContext(events, new Set(), now);
    expect(result).toEqual({
      mode: "upcoming-event",
      upcomingEventTitle: "Sooner Event",
    });
  });

  it("returns feedback-pending for the most recent past event without feedback", () => {
    const events = [
      makeEvent("past-1", "Oldest Event", new Date("2026-06-10T10:00:00.000Z")),
      makeEvent("past-2", "Recent Event", new Date("2026-06-16T10:00:00.000Z")),
      makeEvent("past-3", "Middle Event", new Date("2026-06-14T10:00:00.000Z")),
    ];

    const result = resolveConnectionsContext(events, new Set(), now);
    expect(result).toEqual({
      mode: "feedback-pending",
      nextFeedbackEventId: "past-2",
      nextFeedbackEventTitle: "Recent Event",
    });
  });

  it("skips past events that already have feedback and picks the next pending one", () => {
    const events = [
      makeEvent("past-1", "Recent Event", new Date("2026-06-16T10:00:00.000Z")),
      makeEvent("past-2", "Pending Event", new Date("2026-06-14T10:00:00.000Z")),
    ];

    const result = resolveConnectionsContext(events, new Set(["past-1"]), now);
    expect(result).toEqual({
      mode: "feedback-pending",
      nextFeedbackEventId: "past-2",
      nextFeedbackEventTitle: "Pending Event",
    });
  });

  it("returns feedback-complete when all past events have feedback", () => {
    const events = [
      makeEvent("past-1", "Recent Event", new Date("2026-06-16T10:00:00.000Z")),
      makeEvent("past-2", "Older Event", new Date("2026-06-14T10:00:00.000Z")),
    ];

    const result = resolveConnectionsContext(events, new Set(["past-1", "past-2"]), now);
    expect(result).toEqual({ mode: "feedback-complete" });
  });

  it("ignores events with invalid or missing dateTime", () => {
    const events = [
      { id: "bad-1", title: "No Date" },
      { id: "bad-2", title: "Invalid Date", dateTime: "not-a-date" },
      makeEvent("good-1", "Good Event", new Date("2026-06-18T10:00:00.000Z")),
    ];

    const result = resolveConnectionsContext(events, new Set(), now);
    expect(result).toEqual({
      mode: "upcoming-event",
      upcomingEventTitle: "Good Event",
    });
  });

  it("falls back to no-events when all events have invalid dateTime", () => {
    const events = [
      { id: "bad-1", title: "No Date" },
      { id: "bad-2", title: "Invalid Date", dateTime: "not-a-date" },
    ];

    const result = resolveConnectionsContext(events, new Set(), now);
    expect(result).toEqual({ mode: "no-events" });
  });
});
