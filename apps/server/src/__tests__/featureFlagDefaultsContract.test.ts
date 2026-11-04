import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { FEATURE_FLAG_DESCRIPTIONS } from "@shared/copy/featureFlags";

import { DEFAULT_FLAG_VALUES, FLAG_ENV_MAP } from "../lib/featureFlags";

/**
 * Contract: DEFAULT_FLAG_VALUES is the single source of truth for every flag's
 * default, and it must agree with (a) the call sites and (b) the admin copy.
 *
 * Origin (2026-10-22): 30 of 86 keys were absent from DEFAULT_FLAG_VALUES.
 * `getFeatureFlag(key, fallback)` resolves `DEFAULT_FLAG_VALUES[key] ?? fallback`,
 * but `listFeatureFlags()` — the admin portal's data source — resolves
 * `DEFAULT_FLAG_VALUES[key] ?? false`. The 18 missing keys whose call sites pass
 * `true` therefore rendered as 「关闭 / 来源:默认值」 in
 * /admin/feature-flags while running live (智能职业识别 being the reported one).
 * A second-order symptom: 4 copy descriptions claimed 「默认关闭」 for those same
 * live flags.
 *
 * These tests are static (no DB, no env) so they stay deterministic in CI.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_SRC = join(__dirname, "..");

/** Recursively collect server source files, excluding tests (they pass
 *  arbitrary fallbacks on purpose to exercise both branches). */
function collectSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__" || entry.name === "node_modules") continue;
      collectSourceFiles(full, acc);
    } else if (/\.tsx?$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

/** Strip comments so commented-out call sites cannot create false failures. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

describe("feature flag defaults contract", () => {
  const keys = Object.keys(FLAG_ENV_MAP);

  it("FLAG_ENV_MAP has flags to cover", () => {
    expect(keys.length).toBeGreaterThan(0);
  });

  it("every FLAG_ENV_MAP key has an explicit DEFAULT_FLAG_VALUES entry", () => {
    const missing = keys.filter((key) => !(key in DEFAULT_FLAG_VALUES));
    // A missing entry makes the admin portal report 「关闭 / 来源:默认值」 for a
    // flag that may be running live — the exact bug this contract exists for.
    expect(missing).toEqual([]);
  });

  it("has no orphan DEFAULT_FLAG_VALUES entries", () => {
    const orphans = Object.keys(DEFAULT_FLAG_VALUES).filter((key) => !(key in FLAG_ENV_MAP));
    expect(orphans).toEqual([]);
  });

  it("every literal call-site fallback matches DEFAULT_FLAG_VALUES", () => {
    const callSiteRe =
      /getFeatureFlag(?:Sync)?\(\s*["']([A-Za-z0-9_]+)["']\s*(?:,\s*([^)]*?))?\s*\)/g;

    const mismatches: string[] = [];
    let literalCallSites = 0;

    for (const file of collectSourceFiles(SERVER_SRC)) {
      const source = stripComments(readFileSync(file, "utf8"));
      let match: RegExpExecArray | null;
      while ((match = callSiteRe.exec(source)) !== null) {
        const [, key, rawFallback] = match;
        if (rawFallback === undefined) continue;
        const fallback = rawFallback.trim();
        // Only literal booleans are statically verifiable; dynamic fallbacks
        // (e.g. a variable) are resolved by DEFAULT_FLAG_VALUES at runtime.
        if (fallback !== "true" && fallback !== "false") continue;
        const expected = DEFAULT_FLAG_VALUES[key];
        if (expected === undefined) continue; // covered by the missing-keys test
        literalCallSites += 1;
        if (fallback !== String(expected)) {
          mismatches.push(
            `${key}: call site passes ${fallback}, DEFAULT_FLAG_VALUES is ${expected} (${relative(SERVER_SRC, file)})`,
          );
        }
      }
    }

    // Guard against a silently broken scanner (regex drift would make this test
    // pass vacuously).
    expect(literalCallSites).toBeGreaterThan(30);
    expect(mismatches).toEqual([]);
  });

  it("every admin description states the same default as DEFAULT_FLAG_VALUES", () => {
    const wrong: string[] = [];
    const silent: string[] = [];

    for (const key of keys) {
      const description = FEATURE_FLAG_DESCRIPTIONS[key] ?? "";
      const claimsOn = description.includes("默认开启");
      const claimsOff = description.includes("默认关闭");
      if (!claimsOn && !claimsOff) {
        silent.push(key);
        continue;
      }
      const expected = DEFAULT_FLAG_VALUES[key];
      if (claimsOn && expected !== true) wrong.push(`${key}: copy says 默认开启, default is ${expected}`);
      if (claimsOff && expected !== false) wrong.push(`${key}: copy says 默认关闭, default is ${expected}`);
    }

    expect(wrong).toEqual([]);
    expect(silent).toEqual([]);
  });

  /**
   * The FLAG_ENV_MAP JSDoc states `(default: true|false)` per flag. It is the
   * first thing an engineer reads before touching a default, and it drifted
   * silently: on 2026-11-04 `aigcLabelsEnabled` and
   * `contentModerationMsgSecCheckEnabled` both still said "default: false"
   * while running ON since 2026-10-22. A comment that contradicts the truth is
   * exactly how a compliance flag gets switched off by someone "restoring" its
   * documented default — so the claim is now part of the contract.
   */
  it("every FLAG_ENV_MAP comment default claim matches DEFAULT_FLAG_VALUES", () => {
    const source = readFileSync(join(SERVER_SRC, "lib/featureFlags.ts"), "utf8");
    const mapStart = source.indexOf("export const FLAG_ENV_MAP");
    const defaultsStart = source.indexOf("export const DEFAULT_FLAG_VALUES");
    expect(mapStart).toBeGreaterThan(-1);
    expect(defaultsStart).toBeGreaterThan(mapStart);

    const lines = source.slice(mapStart, defaultsStart).split("\n");
    const mismatches: string[] = [];
    let claimed: boolean | null = null;
    let checked = 0;

    for (const line of lines) {
      const claim = line.match(/\(default:\s*(true|false)\)/);
      if (claim) claimed = claim[1] === "true";

      const entry = line.match(/^\s*(\w+):\s*"[A-Z0-9_]+",/);
      if (!entry || claimed === null) continue;

      checked += 1;
      const actual = DEFAULT_FLAG_VALUES[entry[1]];
      if (actual !== claimed) {
        mismatches.push(
          `${entry[1]}: comment says default ${claimed}, DEFAULT_FLAG_VALUES is ${actual}`,
        );
      }
      claimed = null;
    }

    expect(mismatches).toEqual([]);
    // Guards against the regex rotting into a no-op.
    expect(checked).toBeGreaterThan(40);
  });
});
