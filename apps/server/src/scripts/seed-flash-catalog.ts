import { randomUUID } from "node:crypto";
import { adminAuditLogs } from "@shared/schema";
import { FLASH_LOCATION_SEEDS, type FlashLocationSeed } from "@shared/alang/flashCatalog";
import { db, pool } from "../db";
import {
  getFlashReadiness,
  isFlashSchemaReady,
  seedBuiltinFlashCatalog,
  seedBuiltinFlashLocations,
} from "../repositories/flashRepo";

const STAGING_REVIEW_ACTOR = "deploy-staging";

const TENCENT_PLACE_ALIASES: Record<string, string[]> = {
  "NS-SEAWORLD-ART": ["海上世界文化艺术中心", "文化艺术中心"],
  "NS-NANTOU": ["南头古城"],
  "FT-UPPERHILLS": ["深业上城"],
  "FT-BOOK-CITY": ["深圳书城", "中心书城"],
};

function stagingApprovedCodes(): string[] {
  return (process.env.FLASH_STAGING_APPROVED_LOCATION_CODES ?? "")
    .split(",")
    .map((code) => code.trim())
    .filter(Boolean);
}

function normalizeAdministrativeName(value: string | undefined): string {
  return (value ?? "").trim().replace(/[市区]$/u, "");
}

async function resolveStagingSeedWithTencent(seed: FlashLocationSeed): Promise<FlashLocationSeed> {
  const key = process.env.TENCENT_MAP_KEY;
  if (!key) throw new Error("FLASH_STAGING_SEED_MAP_NOT_CONFIGURED");

  const aliases = TENCENT_PLACE_ALIASES[seed.code]
    ?? [seed.name.replace(/公共阅读区|公共街区|公共空间|外围广场/g, "")];
  for (const keyword of aliases) {
    const url = new URL("https://apis.map.qq.com/ws/place/v1/suggestion");
    url.searchParams.set("key", key);
    url.searchParams.set("keyword", keyword);
    url.searchParams.set("region", "深圳市");
    url.searchParams.set("region_fix", "1");
    url.searchParams.set("page_size", "20");

    const response = await fetch(url, { signal: AbortSignal.timeout(4_000) });
    if (!response.ok) throw new Error(`FLASH_STAGING_SEED_MAP_HTTP_${response.status}`);
    const payload = await response.json() as {
      status?: number;
      data?: Array<{
        title?: string;
        address?: string;
        location?: { lat?: number; lng?: number };
        ad_info?: { city?: string; district?: string; adcode?: number | string };
      }>;
    };
    if (payload.status !== 0 || !Array.isArray(payload.data)) {
      throw new Error(`FLASH_STAGING_SEED_MAP_UPSTREAM_${payload.status ?? "UNKNOWN"}`);
    }

    const candidate = payload.data.find((item) => {
      const verifiedText = `${item.title ?? ""} ${item.address ?? ""}`;
      const cityMatches = normalizeAdministrativeName(item.ad_info?.city) === "深圳"
        || String(item.ad_info?.adcode ?? "").startsWith("4403");
      const districtMatches = normalizeAdministrativeName(item.ad_info?.district)
        === normalizeAdministrativeName(seed.district);
      const placeMatches = aliases.some((alias) => alias && verifiedText.includes(alias));
      return cityMatches
        && districtMatches
        && placeMatches
        && Number.isFinite(item.location?.lat)
        && Number.isFinite(item.location?.lng);
    });
    if (candidate?.location && Number.isFinite(candidate.location.lat) && Number.isFinite(candidate.location.lng)) {
      return {
        ...seed,
        address: candidate.address?.trim() || seed.address,
        latitude: candidate.location.lat as number,
        longitude: candidate.location.lng as number,
      };
    }
  }

  throw new Error(`FLASH_STAGING_SEED_NO_VERIFIED_CANDIDATE:${seed.code}:${seed.district}`);
}

async function main() {
  if (!(await isFlashSchemaReady())) {
    throw new Error(
      "FLASH_SCHEMA_NOT_READY: inspect the live database and deploy the additive Flash schema before running seed:flash",
    );
  }
  const seeded = await seedBuiltinFlashCatalog();
  const approvedCodes = stagingApprovedCodes();
  let stagingLocations = null;
  if (approvedCodes.length > 0) {
    if (process.env.APP_MODE !== "staging") {
      throw new Error("FLASH_STAGING_APPROVED_LOCATION_CODES is allowed only when APP_MODE=staging");
    }
    const uniqueCodes = new Set(approvedCodes);
    if (uniqueCodes.size !== approvedCodes.length) {
      throw new Error("FLASH_STAGING_APPROVED_LOCATION_CODES contains duplicates");
    }
    const selectedSeeds = approvedCodes.map((code) => {
      const seed = FLASH_LOCATION_SEEDS.find((item) => item.code === code);
      if (!seed) throw new Error(`FLASH_STAGING_SEED_UNKNOWN_CODE:${code}`);
      return seed;
    });
    const resolvedSeeds = await Promise.all(selectedSeeds.map(resolveStagingSeedWithTencent));
    const verifiedKeys = new Set(resolvedSeeds.map((seed) => `${seed.district}:${seed.name}`));
    stagingLocations = await seedBuiltinFlashLocations(STAGING_REVIEW_ACTOR, verifiedKeys, {
      locationSeeds: resolvedSeeds,
      includeDestinations: false,
    });
    await db.insert(adminAuditLogs).values({
      auditId: randomUUID(),
      timestamp: new Date(),
      adminId: STAGING_REVIEW_ACTOR,
      adminRole: "system",
      action: "FLASH_ENCOUNTER_LOCATIONS_STAGING_SEEDED",
      targetEntityType: "flash_encounter_location",
      targetEntityId: "staging-core-public-spaces",
      after: {
        codes: resolvedSeeds.map((seed) => seed.code),
        districts: resolvedSeeds.map((seed) => seed.district),
        approvalStatus: "approved",
        isActive: true,
      },
      context: { source: "tencent-map-suggestion", idempotent: true },
    });
  }
  const readiness = await getFlashReadiness();
  process.stdout.write(`${JSON.stringify({ seeded, stagingLocations, readiness }, null, 2)}\n`);
  if (readiness.reviewedTasks < 30) {
    process.stdout.write(
      "The 30 seeded tasks remain pending_review and inactive. An operator must explicitly approve them in the admin portal.\n",
    );
  }
}

main()
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
