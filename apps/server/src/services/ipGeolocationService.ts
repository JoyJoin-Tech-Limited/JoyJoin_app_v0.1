import { createHash } from "crypto";
import { existsSync } from "fs";
import { createRequire } from "module";
import { join } from "path";
import { fileURLToPath } from "url";
import { logger } from "../lib/logger.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const require = createRequire(import.meta.url);

export const MAINLAND_PROVINCES = [
  "北京",
  "天津",
  "上海",
  "重庆",
  "河北",
  "山西",
  "辽宁",
  "吉林",
  "黑龙江",
  "江苏",
  "浙江",
  "安徽",
  "福建",
  "江西",
  "山东",
  "河南",
  "湖北",
  "湖南",
  "广东",
  "海南",
  "四川",
  "贵州",
  "云南",
  "陕西",
  "甘肃",
  "青海",
  "台湾",
  "内蒙古",
  "广西",
  "西藏",
  "宁夏",
  "新疆",
  "香港",
  "澳门",
] as const;

export type LocationEventType =
  | "login"
  | "onboarding_complete"
  | "pool_registration";

export interface GeolocationResult {
  country: string | null;
  province: string | null;
  city: string | null;
  district: string | null;
  isp: string | null;
  isMainland: boolean;
  source: "qqwry" | "missing" | "overseas" | "invalid";
}

export interface PrivacySafeIpIdentifiers {
  hashedIp: string;
  anonymizedIp: string;
  saltDate: string;
}

interface QqwryLookupResult {
  addr: string;
  info?: string | null;
}

interface QqwryReader {
  searchIP(ip: string): QqwryLookupResult;
}

type QqwryConstructor = new (dataPath: string) => QqwryReader;

let qqwryCtor: QqwryConstructor | null | undefined;
let qqwryInstance: QqwryReader | null = null;
let qqwryLoadError: Error | null = null;

function resolveDatPath(): string {
  const envPath = process.env.QQWRY_DAT_PATH;
  if (envPath) return envPath;
  // Default: apps/server/data/qqwry.dat
  return join(__dirname, "..", "..", "data", "qqwry.dat");
}

function loadQqwryConstructor(): QqwryConstructor | null {
  if (qqwryCtor !== undefined) return qqwryCtor;

  try {
    const module = require("qqwry-lite") as {
      QQwry?: QqwryConstructor;
      default?: QqwryConstructor;
    };
    qqwryCtor = module.QQwry ?? module.default ?? null;

    if (!qqwryCtor) {
      throw new Error("qqwry-lite did not export a QQwry constructor");
    }

    return qqwryCtor;
  } catch (err) {
    qqwryLoadError = err instanceof Error ? err : new Error(String(err));
    qqwryCtor = null;
    logger.warn("[IpGeolocation] qqwry-lite package unavailable; geolocation will degrade gracefully", {
      err: qqwryLoadError.message,
    });
    return null;
  }
}

export function loadQqwry(): QqwryReader | null {
  if (qqwryInstance) return qqwryInstance;
  if (qqwryLoadError) return null;

  const path = resolveDatPath();
  if (!existsSync(path)) {
    qqwryLoadError = new Error(`QQwry data file not found at ${path}`);
    logger.warn("[IpGeolocation] QQwry data file not found; geolocation will degrade gracefully", { path });
    return null;
  }

  try {
    const QQwry = loadQqwryConstructor();
    if (!QQwry) return null;

    qqwryInstance = new QQwry(path);
    logger.info("[IpGeolocation] QQwry data file loaded", { path });
    return qqwryInstance;
  } catch (err) {
    qqwryLoadError = err instanceof Error ? err : new Error(String(err));
    logger.error("[IpGeolocation] Failed to load QQwry data file", { err, path });
    return null;
  }
}

export function resetQqwryForTests(): void {
  qqwryCtor = undefined;
  qqwryInstance = null;
  qqwryLoadError = null;
}

export function isPrivateOrReservedIP(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b, c] = parts;
  // 10.0.0.0/8
  if (a === 10) return true;
  // 172.16.0.0/12
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.168.0.0/16
  if (a === 192 && b === 168) return true;
  // 127.0.0.0/8
  if (a === 127) return true;
  // 169.254.0.0/16
  if (a === 169 && b === 254) return true;
  // 100.64.0.0/10
  if (a === 100 && b >= 64 && b <= 127) return true;
  // 192.0.0.0/24
  if (a === 192 && b === 0 && c === 0) return true;
  // 198.18.0.0/15
  if (a === 198 && b >= 18 && b <= 19) return true;
  // 203.0.113.0/24
  if (a === 203 && b === 0 && c === 113) return true;
  return false;
}

export function anonymizeIPv4(ip: string): string {
  const parts = ip.split(".");
  if (parts.length !== 4) return "0.0.0.0";
  parts[3] = "0";
  return parts.join(".");
}

export function getSaltDate(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function hashIP(ip: string, saltDate: string): string {
  // Daily rotating salt derived from the date string itself is enough for
  // privacy-safe daily unique counting.  We do NOT use a secret salt because
  // the hash is only used for aggregate counting and the raw IP is discarded.
  return createHash("sha256").update(`${saltDate}:${ip}`).digest("hex");
}

export function getPrivacySafeIpIdentifiers(ip: string): PrivacySafeIpIdentifiers {
  const saltDate = getSaltDate();
  const anonymizedIp = anonymizeIPv4(ip);
  return {
    hashedIp: hashIP(anonymizedIp, saltDate),
    anonymizedIp,
    saltDate,
  };
}

function matchProvince(addr: string): { province: string; remainder: string } | null {
  for (const province of MAINLAND_PROVINCES) {
    // Try the most specific administrative suffix first.
    const candidates = [
      `${province}特别行政区`,
      `${province}自治区`,
      `${province}省`,
      `${province}市`,
      province,
    ];
    for (const candidate of candidates) {
      const idx = addr.indexOf(candidate);
      if (idx !== -1) {
        return {
          province,
          remainder: addr.slice(idx + candidate.length),
        };
      }
    }
  }
  return null;
}

function extractCityAndDistrict(remainder: string): { city: string | null; district: string | null } {
  const cityMatch = remainder.match(/^(.*?市)/);
  if (!cityMatch) {
    return { city: null, district: null };
  }
  const city = cityMatch[1];
  const afterCity = remainder.slice(cityMatch[0].length);
  const districtMatch = afterCity.match(/^(.*?区)/);
  const district = districtMatch ? districtMatch[1] : null;
  return { city, district };
}

export function parseQqwryAddress(addr: string): GeolocationResult {
  const trimmed = addr.trim();
  if (!trimmed || trimmed === "纯真网络") {
    return {
      country: null,
      province: null,
      city: null,
      district: null,
      isp: null,
      isMainland: false,
      source: "missing",
    };
  }

  const provinceMatch = matchProvince(trimmed);
  if (!provinceMatch) {
    return {
      country: trimmed,
      province: null,
      city: null,
      district: null,
      isp: null,
      isMainland: false,
      source: "overseas",
    };
  }

  const { province, remainder } = provinceMatch;
  const { city, district } = extractCityAndDistrict(remainder);
  return {
    country: "中国",
    province,
    city,
    district,
    isp: null,
    isMainland: true,
    source: "qqwry",
  };
}

export function getLocationFromIP(ip: string): GeolocationResult & { isp: string | null } {
  if (isPrivateOrReservedIP(ip)) {
    return {
      country: null,
      province: null,
      city: null,
      district: null,
      isp: null,
      isMainland: false,
      source: "invalid",
    };
  }

  const db = loadQqwry();
  if (!db) {
    return {
      country: null,
      province: null,
      city: null,
      district: null,
      isp: null,
      isMainland: false,
      source: "missing",
    };
  }

  try {
    const info = db.searchIP(ip);
    const parsed = parseQqwryAddress(info.addr);
    return {
      ...parsed,
      isp: info.info || null,
    };
  } catch (err) {
    logger.warn("[IpGeolocation] QQwry lookup failed", { err, ip });
    return {
      country: null,
      province: null,
      city: null,
      district: null,
      isp: null,
      isMainland: false,
      source: "missing",
    };
  }
}
