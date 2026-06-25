/**
 * Tests for Match Compass default seeding and registration copy behavior.
 *
 * Coverage:
 *   - resolveEffectivePreferenceDNA uses persisted user defaults when present
 *   - resolveEffectivePreferenceDNA falls back to archetype-derived DNA when defaults are null
 *   - buildEventPoolRegistrationInsert copies DNA into registration columns
 *   - buildEventPoolRegistrationInsert uses safe defaults (strictness=50, acceptPairs=true) when DNA is absent
 */

import { describe, it, expect } from "vitest";
import {
  buildEventPoolRegistrationInsert,
  type EventPoolRegistrationPreferenceDNA,
} from "../lib/eventPoolRegistration";
import {
  buildDefaultPreferencesFromArchetype,
  resolveEffectivePreferenceDNA,
} from "../lib/matchCompass";

const baseUser = {
  primaryArchetype: "corgi",
  archetype: null as string | null,
  defaultPreferenceStrictness: null as number | null,
  defaultAcceptPairs: null as boolean | null,
  defaultGenderComposition: null as string | null,
  defaultPreferredDistricts: null as string[] | null,
  defaultKolComfort: null as string | null,
};

describe("resolveEffectivePreferenceDNA", () => {
  it("uses persisted user defaults when strictness is set", () => {
    const user = {
      ...baseUser,
      defaultPreferenceStrictness: 35,
      defaultAcceptPairs: true,
      defaultGenderComposition: "mixed",
      defaultPreferredDistricts: ["南山区"],
      defaultKolComfort: "comfortable",
    };

    const dna = resolveEffectivePreferenceDNA(user);
    expect(dna.strictness).toBe(35);
    expect(dna.acceptPairs).toBe(true);
    expect(dna.genderComposition).toBe("mixed");
    expect(dna.preferredDistricts).toEqual(["南山区"]);
    expect(dna.kolComfort).toBe("comfortable");
  });

  it("falls back to archetype-derived DNA when no defaults are persisted", () => {
    const user = { ...baseUser };
    const expected = buildDefaultPreferencesFromArchetype("corgi");

    const dna = resolveEffectivePreferenceDNA(user);
    expect(dna.strictness).toBe(expected.strictness);
    expect(dna.acceptPairs).toBe(expected.acceptPairs);
    expect(dna.genderComposition).toBe(expected.genderComposition);
  });

  it("prefers primaryArchetype over legacy archetype for fallback", () => {
    const user = {
      ...baseUser,
      primaryArchetype: null as string | null,
      archetype: "owl" as string | null,
    };

    const dna = resolveEffectivePreferenceDNA(user);
    const expected = buildDefaultPreferencesFromArchetype("owl");
    expect(dna.strictness).toBe(expected.strictness);
    expect(dna.acceptPairs).toBe(expected.acceptPairs);
  });

  it("uses default strictness 50 for unknown archetypes without persisted defaults", () => {
    const user = {
      ...baseUser,
      primaryArchetype: "unknown_archetype" as string | null,
    };

    const dna = resolveEffectivePreferenceDNA(user);
    expect(dna.strictness).toBe(50);
    expect(dna.acceptPairs).toBe(true);
  });
});

describe("buildEventPoolRegistrationInsert with preferenceDNA", () => {
  it("copies non-null DNA into registration columns", () => {
    const dna: EventPoolRegistrationPreferenceDNA = {
      strictness: 40,
      acceptPairs: true,
      genderComposition: "mixed",
      preferredDistricts: ["福田区", "南山区"],
      kolComfort: "comfortable",
    };

    const { values } = buildEventPoolRegistrationInsert({
      poolId: "pool-1",
      userId: "user-1",
      payload: null,
      preferenceDNA: dna,
    });

    expect(values.preferenceStrictness).toBe(40);
    expect(values.acceptPairs).toBe(true);
    expect(values.genderCompositionPreference).toBe("mixed");
    expect(values.preferredDistricts).toEqual(["福田区", "南山区"]);
    expect(values.kolComfortLevel).toBe("comfortable");
  });

  it("uses safe defaults when DNA is not provided", () => {
    const { values } = buildEventPoolRegistrationInsert({
      poolId: "pool-1",
      userId: "user-1",
      payload: null,
    });

    expect(values.preferenceStrictness).toBe(50);
    expect(values.acceptPairs).toBe(true);
    expect(values.genderCompositionPreference).toBeNull();
    expect(values.preferredDistricts).toBeNull();
    expect(values.kolComfortLevel).toBeNull();
  });

  it("preserves registration payload fields alongside DNA", () => {
    const dna: EventPoolRegistrationPreferenceDNA = {
      strictness: 55,
      acceptPairs: false,
      genderComposition: "no_pref",
      preferredDistricts: null,
      kolComfort: null,
    };

    const { values } = buildEventPoolRegistrationInsert({
      poolId: "pool-1",
      userId: "user-1",
      payload: {
        budgetRange: ["100-200"],
        eventIntent: ["expand_circle"],
      },
      preferenceDNA: dna,
    });

    expect(values.preferenceStrictness).toBe(55);
    expect(values.budgetRange).toEqual(["100-200"]);
    expect(values.eventIntent).toEqual(["expand_circle"]);
  });
});
