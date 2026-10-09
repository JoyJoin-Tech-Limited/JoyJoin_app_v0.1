import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  districtNameToClusterId,
  externalDistrictToClusterId,
  getClusterIdByDistrictName,
  shenzhenClusters,
} from "@shared/districts";

const TEST_FILE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_FILE_DIR, "../../../..");

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}

const ADMIN_DISTRICTS_PATH = "apps/admin-client/src/lib/cityDistricts.ts";

/**
 * District catalog parity contract (2026-10-05).
 *
 * Three hand-maintained lists must stay in sync or the Discover coverage map
 * (LocationFilterDrawer) silently lies:
 *   1. Admin `CITY_DISTRICTS['深圳']` — what ops can pick when creating pools.
 *   2. Shared `districtNameToClusterId` + `externalDistrictToClusterId` — how
 *      pool.district maps to a drawer cluster (unmapped → count invisible).
 *   3. `shenzhenClusters` — the drawer's live tiles + "即将开放" pending chips.
 *
 * Drift mode this locks: ops adds a district in admin without touching shared
 * (pool becomes unmappable), or shared flips a district live without admin
 * (pool selectable but never renderable).
 */
describe("district catalog parity contract", () => {
  const adminSource = readRepoFile(ADMIN_DISTRICTS_PATH);

  function extractAdminDistricts(city: string): string[] {
    const block = adminSource.match(new RegExp(`${city}:\\s*\\[([^\\]]*)\\]`));
    expect(block, `${city} block must exist in ${ADMIN_DISTRICTS_PATH}`).toBeTruthy();
    return [...block![1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  }

  const adminShenzhen = extractAdminDistricts("深圳");

  const liveClusterKeys = Object.keys(districtNameToClusterId).filter((k) => k.endsWith("区"));
  const externalKeys = Object.keys(externalDistrictToClusterId).filter((k) => k.endsWith("区"));
  const sharedCatalog = [...liveClusterKeys, ...externalKeys];

  it("every admin-selectable 深圳 district maps to a drawer cluster", () => {
    for (const district of adminShenzhen) {
      expect(
        getClusterIdByDistrictName(district),
        `admin district ${district} is unmappable — pools created with it never surface in the coverage map`,
      ).toBeDefined();
    }
  });

  it("admin 深圳 list and shared catalog cover exactly the same districts", () => {
    expect([...adminShenzhen].sort()).toEqual([...sharedCatalog].sort());
  });

  it("drawer pending chips equal the external (即将开放) districts", () => {
    const pendingCluster = shenzhenClusters.find((c) =>
      c.districts.every((d) => d.heat === "pending"),
    );
    expect(pendingCluster, "a fully-pending cluster must exist").toBeDefined();
    const pendingNames = pendingCluster!.districts.map((d) => d.name).sort();
    expect(pendingNames).toEqual([...externalKeys].sort());
  });

  it("live cluster display names are the shared live district keys", () => {
    const liveDisplayNames = shenzhenClusters
      .filter((c) => c.districts.some((d) => d.heat !== "pending"))
      .map((c) => c.displayName)
      .sort();
    expect(liveDisplayNames).toEqual([...liveClusterKeys].sort());
  });

  it("geo reverse-geocode bbox fallback names are all mappable", () => {
    // routes/domains/geo.ts keeps a hand-written lat/lng bbox list as the
    // offline reverse-geocode fallback — a 4th district list that must
    // resolve through the same shared mapping.
    const geoSource = readRepoFile("apps/server/src/routes/domains/geo.ts");
    const bboxNames = [...geoSource.matchAll(/name:\s*"([^"]+)",\s*minLat/g)].map((m) => m[1]);
    expect(bboxNames.length).toBeGreaterThan(0);
    for (const name of bboxNames) {
      expect(
        getClusterIdByDistrictName(name),
        `geo bbox fallback district ${name} is unmappable`,
      ).toBeDefined();
    }
  });
});
