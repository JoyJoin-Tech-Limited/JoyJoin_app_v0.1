/**
 * Canonical city → district mappings for the admin portal.
 *
 * These values must match the exact strings stored in the database
 * (venues.area, eventPools.district, etc.) to ensure filter queries work.
 *
 * Source of truth: align with DB schema + cityLandmarks.ts neighborhood names.
 */

/**
 * Canonical city → district mappings for the admin portal.
 *
 * These values must match the exact strings stored in the database
 * (venues.area, eventPools.district, etc.) to ensure filter queries work.
 *
 * Source of truth: align with DB schema + cityLandmarks.ts neighborhood names.
 */
export const CITY_DISTRICTS = {
  深圳: [
    "南山区",
    "福田区",
    "罗湖区",
    "宝安区",
    "龙华区",
    "龙岗区",
    "盐田区",
    "光明区",
    "坪山区",
    "大鹏新区",
  ],
  香港: [
    "中环",
    "湾仔",
    "尖沙咀",
    "铜锣湾",
    "观塘",
    "葵涌",
    "沙田",
    "将军澳",
    "荃湾",
    "元朗",
  ],
} as const satisfies Record<string, readonly string[]>;
