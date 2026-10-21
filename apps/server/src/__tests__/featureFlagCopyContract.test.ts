import { describe, expect, it } from "vitest";
import { FLAG_ENV_MAP } from "../lib/featureFlags";
import {
  FEATURE_FLAG_DESCRIPTIONS,
  FEATURE_FLAG_LABELS,
  FEATURE_FLAG_SECTIONS,
  FEATURE_FLAG_SECTION_BY_KEY,
} from "@shared/copy/featureFlags";

/**
 * Contract: every key in FLAG_ENV_MAP (the server-side flag authority that
 * powers GET /api/admin/feature-flags) must have a non-empty Chinese display
 * label and description in the shared copy module. The admin portal renders
 * these; a missing entry silently falls back to the raw camelCase key with an
 * empty description — the exact UX problem this contract exists to prevent.
 */
describe("feature flag copy contract", () => {
  const keys = Object.keys(FLAG_ENV_MAP);

  it("FLAG_ENV_MAP has flags to cover", () => {
    expect(keys.length).toBeGreaterThan(0);
  });

  it("every flag key has a non-empty Chinese label", () => {
    const missing = keys.filter((key) => !FEATURE_FLAG_LABELS[key]?.trim());
    expect(missing).toEqual([]);
  });

  it("every flag key has a non-empty description", () => {
    const missing = keys.filter((key) => !FEATURE_FLAG_DESCRIPTIONS[key]?.trim());
    expect(missing).toEqual([]);
  });

  it("labels are Chinese product language, not raw keys or English identifiers", () => {
    const bad = keys.filter((key) => {
      const label = FEATURE_FLAG_LABELS[key] ?? "";
      return label === key || !/[\u4e00-\u9fff]/.test(label);
    });
    expect(bad).toEqual([]);
  });

  it("no stale copy entries for flags removed from FLAG_ENV_MAP", () => {
    const staleLabels = Object.keys(FEATURE_FLAG_LABELS).filter(
      (key) => !(key in FLAG_ENV_MAP),
    );
    const staleDescriptions = Object.keys(FEATURE_FLAG_DESCRIPTIONS).filter(
      (key) => !(key in FLAG_ENV_MAP),
    );
    expect({ staleLabels, staleDescriptions }).toEqual({
      staleLabels: [],
      staleDescriptions: [],
    });
  });
});
