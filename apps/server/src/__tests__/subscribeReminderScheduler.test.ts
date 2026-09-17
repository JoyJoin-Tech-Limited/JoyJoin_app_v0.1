import { describe, expect, it } from "vitest";
import { resolvePoolReminderMoment } from "../lib/subscribeReminderScheduler";

/**
 * Moment-window contract for the subscribe reminder scheduler (notification
 * strategy 2026-09-16): event_day fires 3–12h before the event during
 * 08:00–22:00; recap fires 20–30h after during 09:00–21:00. Everything else
 * stays silent.
 */
describe("resolvePoolReminderMoment", () => {
  // 2026-09-20 was a Saturday; construct times in local time via Date parts.
  const at = (day: number, hour: number, minute = 0) => new Date(2026, 8, day, hour, minute);

  it("fires event_day for an evening event on the same morning", () => {
    expect(resolvePoolReminderMoment(at(20, 19), at(20, 9))).toBe("event_day");
  });

  it("fires event_day at the window boundaries", () => {
    expect(resolvePoolReminderMoment(at(20, 14), at(20, 10))).toBe("event_day"); // +4h
    expect(resolvePoolReminderMoment(at(20, 22), at(20, 10))).toBe("event_day"); // +12h
  });

  it("holds event_day when the event is too far ahead or too close", () => {
    expect(resolvePoolReminderMoment(at(21, 19), at(20, 9))).toBeNull(); // +34h
    expect(resolvePoolReminderMoment(at(20, 12), at(20, 10))).toBeNull(); // +2h < 3h floor
  });

  it("never pushes event_day outside waking hours", () => {
    expect(resolvePoolReminderMoment(at(21, 12), at(20, 23))).toBeNull(); // night
    expect(resolvePoolReminderMoment(at(21, 12), at(20, 6))).toBeNull(); // pre-08:00
  });

  it("fires recap 20–30h after the event during recap hours", () => {
    expect(resolvePoolReminderMoment(at(19, 19), at(20, 17))).toBe("recap"); // +22h ago
    expect(resolvePoolReminderMoment(at(19, 19), at(20, 20))).toBe("recap"); // +25h ago
  });

  it("holds recap when too fresh, too stale, or too late at night", () => {
    expect(resolvePoolReminderMoment(at(19, 19), at(20, 10))).toBeNull(); // 15h ago
    expect(resolvePoolReminderMoment(at(18, 19), at(20, 10))).toBeNull(); // 39h ago
    expect(resolvePoolReminderMoment(at(19, 19), at(20, 22))).toBeNull(); // after 21:00
  });
});
