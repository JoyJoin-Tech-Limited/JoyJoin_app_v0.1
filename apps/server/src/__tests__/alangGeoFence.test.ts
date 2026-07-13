import { describe, expect, it } from "vitest";
import type { AlangGpsPoint } from "@shared/alang/missionTypes";
import { checkGpsArrival } from "../lib/alang/alangGeoFence";

const TARGET = { latitude: 22.518, longitude: 113.944, radiusMeters: 5 };

function point(ts: number): AlangGpsPoint {
  return {
    latitude: TARGET.latitude,
    longitude: TARGET.longitude,
    accuracy: 3,
    ts,
  };
}

describe("Alang GPS arrival", () => {
  it("requires three consecutive in-radius reports", () => {
    const first = checkGpsArrival(TARGET.latitude, TARGET.longitude, TARGET, [point(1)]);
    expect(first).toMatchObject({ arrived: false, stableCount: 1 });

    const second = checkGpsArrival(TARGET.latitude, TARGET.longitude, TARGET, [point(1), point(2)]);
    expect(second).toMatchObject({ arrived: false, stableCount: 2 });

    const third = checkGpsArrival(TARGET.latitude, TARGET.longitude, TARGET, [point(1), point(2), point(3)]);
    expect(third).toMatchObject({ arrived: true, stableCount: 3 });
  });

  it("resets the stable count after an out-of-radius report", () => {
    const outside = {
      latitude: TARGET.latitude + 0.001,
      longitude: TARGET.longitude,
      accuracy: 3,
      ts: 2,
    };
    const result = checkGpsArrival(
      TARGET.latitude,
      TARGET.longitude,
      TARGET,
      [point(1), outside, point(3)],
    );
    expect(result).toMatchObject({ arrived: false, stableCount: 1 });
  });

  it("never lets content or debug data widen the fixed five-metre fence", () => {
    const aboutElevenMetresAway = TARGET.latitude + 0.0001;
    const result = checkGpsArrival(
      aboutElevenMetresAway,
      TARGET.longitude,
      { ...TARGET, radiusMeters: 500 },
      [{
        latitude: aboutElevenMetresAway,
        longitude: TARGET.longitude,
        accuracy: 3,
        ts: 1,
      }],
    );

    expect(result.radiusMeters).toBe(5);
    expect(result.arrived).toBe(false);
    expect(result.distanceMeters).toBeGreaterThan(5);
  });
});
