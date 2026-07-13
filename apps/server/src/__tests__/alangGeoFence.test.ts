import { describe, expect, it } from "vitest";
import type { AlangGpsPoint } from "@shared/alang/missionTypes";
import { checkGpsArrival } from "../lib/alang/alangGeoFence";

const TARGET = { lat: 22.518, lng: 113.944, radiusMeters: 5 };

function point(ts: number): AlangGpsPoint {
  return { lat: TARGET.lat, lng: TARGET.lng, accuracy: 3, ts };
}

describe("Alang GPS arrival", () => {
  it("requires three consecutive in-radius reports", () => {
    const first = checkGpsArrival(TARGET.lat, TARGET.lng, TARGET, [point(1)]);
    expect(first).toMatchObject({ arrived: false, stableCount: 1 });

    const second = checkGpsArrival(TARGET.lat, TARGET.lng, TARGET, [point(1), point(2)]);
    expect(second).toMatchObject({ arrived: false, stableCount: 2 });

    const third = checkGpsArrival(TARGET.lat, TARGET.lng, TARGET, [point(1), point(2), point(3)]);
    expect(third).toMatchObject({ arrived: true, stableCount: 3 });
  });

  it("resets the stable count after an out-of-radius report", () => {
    const outside = { lat: TARGET.lat + 0.001, lng: TARGET.lng, accuracy: 3, ts: 2 };
    const result = checkGpsArrival(TARGET.lat, TARGET.lng, TARGET, [point(1), outside, point(3)]);
    expect(result).toMatchObject({ arrived: false, stableCount: 1 });
  });
});
