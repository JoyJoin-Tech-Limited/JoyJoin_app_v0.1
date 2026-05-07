import { describe, expect, it } from "vitest";
import {
  getDiscoverJoinRoute,
  getEventPoolRegistrationRoute,
  getJoinPoolIdFromUrl,
} from "../poolRegistrationRouting";

describe("pool registration routing", () => {
  it("maps deep links onto the discover join-sheet flow", () => {
    expect(getEventPoolRegistrationRoute("pool-1")).toBe("/event-pool-registration/pool-1");
    expect(getDiscoverJoinRoute("pool-1")).toBe("/discover?joinPool=pool-1");
    expect(getJoinPoolIdFromUrl("/discover?joinPool=pool-1")).toBe("pool-1");
  });
});
