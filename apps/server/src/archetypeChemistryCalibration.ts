import type { ArchetypeName } from "./archetypeChemistry";
import {
  getAllArchetypePairs,
  getChemistryScore,
  isArchetypeName,
  normalizeArchetypePair,
} from "./archetypeChemistry";
import {
  aggregateArchetypePairFeedbackRows,
  listArchetypePairFeedbackStats,
  upsertArchetypePairFeedbackStats,
} from "./repositories/archetypePairFeedbackStatsRepo";

export const CHEMISTRY_CALIBRATION_MIN_SAMPLES = 30;
export const CHEMISTRY_CALIBRATION_MAX_DELTA = 2;
export const CHEMISTRY_CALIBRATION_DAMPENING_FACTOR = 0.05;
const CHEMISTRY_SCORE_FLOOR = 10;
const CHEMISTRY_SCORE_CEILING = 100;
const CHEMISTRY_CACHE_TTL_MS = 5 * 60 * 1000;

export interface ChemistryCalibrationBreakdown {
  archetypeA: ArchetypeName;
  archetypeB: ArchetypeName;
  baseScore: number;
  sampleCount: number;
  avgMeetAgain: number | null;
  avgAtmosphere: number | null;
  empiricalScore: number | null;
  appliedDelta: number;
  calibratedScore: number;
  hasSufficientSamples: boolean;
  lastAggregatedAt: string | null;
}

export type ChemistryCalibrationMap = Map<string, ChemistryCalibrationBreakdown>;

let cachedCalibrationMap: ChemistryCalibrationMap | null = null;
let cachedAt = 0;
let inFlightRefresh: Promise<ChemistryCalibrationMap> | null = null;

function roundToTwo(value: number): number {
  return Math.round(value * 100) / 100;
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function createCalibrationKey(archetype1: ArchetypeName, archetype2: ArchetypeName): string {
  const [archetypeA, archetypeB] = normalizeArchetypePair(archetype1, archetype2);
  return `${archetypeA}|${archetypeB}`;
}

export function calculateEmpiricalChemistryScore(
  avgMeetAgain: number,
  avgAtmosphere: number,
): number {
  return roundToTwo((avgMeetAgain * 60) + (((avgAtmosphere - 1) / 4) * 40));
}

export function calculateCalibratedChemistryBreakdown(
  baseScore: number,
  sampleCount: number,
  avgMeetAgain: number | null,
  avgAtmosphere: number | null,
): Pick<
  ChemistryCalibrationBreakdown,
  "baseScore" | "sampleCount" | "avgMeetAgain" | "avgAtmosphere" | "empiricalScore" | "appliedDelta" | "calibratedScore" | "hasSufficientSamples"
> {
  if (avgMeetAgain === null || avgAtmosphere === null) {
    return {
      baseScore,
      sampleCount,
      avgMeetAgain,
      avgAtmosphere,
      empiricalScore: null,
      appliedDelta: 0,
      calibratedScore: baseScore,
      hasSufficientSamples: sampleCount >= CHEMISTRY_CALIBRATION_MIN_SAMPLES,
    };
  }

  const hasSufficientSamples = sampleCount >= CHEMISTRY_CALIBRATION_MIN_SAMPLES;
  const empiricalScore = calculateEmpiricalChemistryScore(avgMeetAgain, avgAtmosphere);

  if (!hasSufficientSamples) {
    return {
      baseScore,
      sampleCount,
      avgMeetAgain,
      avgAtmosphere,
      empiricalScore,
      appliedDelta: 0,
      calibratedScore: baseScore,
      hasSufficientSamples,
    };
  }

  const rawDelta = empiricalScore - baseScore;
  const boundedDelta = Math.sign(rawDelta) * Math.min(
    Math.abs(rawDelta) * CHEMISTRY_CALIBRATION_DAMPENING_FACTOR,
    CHEMISTRY_CALIBRATION_MAX_DELTA,
  );
  const calibratedScore = roundToTwo(
    Math.max(
      CHEMISTRY_SCORE_FLOOR,
      Math.min(CHEMISTRY_SCORE_CEILING, baseScore + boundedDelta),
    ),
  );

  return {
    baseScore,
    sampleCount,
    avgMeetAgain,
    avgAtmosphere,
    empiricalScore,
    appliedDelta: roundToTwo(calibratedScore - baseScore),
    calibratedScore,
    hasSufficientSamples,
  };
}

function buildCalibrationMap(rows: Array<any>): ChemistryCalibrationMap {
  const map: ChemistryCalibrationMap = new Map();

  for (const row of rows) {
    if (!isArchetypeName(row.archetypeA) || !isArchetypeName(row.archetypeB)) {
      continue;
    }

    const breakdown: ChemistryCalibrationBreakdown = {
      archetypeA: row.archetypeA,
      archetypeB: row.archetypeB,
      baseScore: Number(row.baseScore),
      sampleCount: Number(row.sampleCount ?? 0),
      avgMeetAgain: toNullableNumber(row.avgMeetAgain),
      avgAtmosphere: toNullableNumber(row.avgAtmosphere),
      empiricalScore: toNullableNumber(row.empiricalScore),
      appliedDelta: Number(row.appliedDelta ?? 0),
      calibratedScore: Number(row.calibratedScore ?? row.baseScore),
      hasSufficientSamples: Number(row.sampleCount ?? 0) >= CHEMISTRY_CALIBRATION_MIN_SAMPLES,
      lastAggregatedAt: row.lastAggregatedAt ? new Date(row.lastAggregatedAt).toISOString() : null,
    };

    map.set(createCalibrationKey(breakdown.archetypeA, breakdown.archetypeB), breakdown);
  }

  return map;
}

async function refreshCalibrationMap(): Promise<ChemistryCalibrationMap> {
  const aggregatedRows = await aggregateArchetypePairFeedbackRows();
  const upsertRows = aggregatedRows
    .filter((row) => isArchetypeName(row.archetypeA) && isArchetypeName(row.archetypeB))
    .map((row) => {
      const baseScore = getChemistryScore(row.archetypeA as ArchetypeName, row.archetypeB as ArchetypeName);
      const breakdown = calculateCalibratedChemistryBreakdown(
        baseScore,
        row.sampleCount,
        row.avgMeetAgain,
        row.avgAtmosphere,
      );

      return {
        archetypeA: row.archetypeA,
        archetypeB: row.archetypeB,
        baseScore,
        sampleCount: row.sampleCount,
        avgMeetAgain: breakdown.avgMeetAgain?.toFixed(3) ?? null,
        avgAtmosphere: breakdown.avgAtmosphere?.toFixed(3) ?? null,
        empiricalScore: breakdown.empiricalScore?.toFixed(2) ?? null,
        appliedDelta: breakdown.appliedDelta.toFixed(2),
        calibratedScore: breakdown.calibratedScore.toFixed(2),
        lastAggregatedAt: new Date(),
        updatedAt: new Date(),
      };
    });

  const storedRows = await upsertArchetypePairFeedbackStats(upsertRows);
  return buildCalibrationMap(storedRows);
}

async function loadPersistedCalibrationMap(): Promise<ChemistryCalibrationMap> {
  const storedRows = await listArchetypePairFeedbackStats();
  return buildCalibrationMap(storedRows);
}

export async function getArchetypePairCalibrationMap(forceRefresh: boolean = false): Promise<ChemistryCalibrationMap> {
  const now = Date.now();
  if (!forceRefresh && cachedCalibrationMap && now - cachedAt < CHEMISTRY_CACHE_TTL_MS) {
    return cachedCalibrationMap;
  }

  if (!inFlightRefresh) {
    const loadPromise = forceRefresh
      ? refreshCalibrationMap()
      : loadPersistedCalibrationMap();

    inFlightRefresh = loadPromise
      .then((map) => {
        cachedCalibrationMap = map;
        cachedAt = Date.now();
        return map;
      })
      .finally(() => {
        inFlightRefresh = null;
      });
  }

  return inFlightRefresh;
}

export async function refreshArchetypePairCalibrationMap(): Promise<ChemistryCalibrationMap> {
  cachedCalibrationMap = null;
  cachedAt = 0;
  return getArchetypePairCalibrationMap(true);
}

export async function listArchetypePairCalibrationDetails(forceRefresh: boolean = false): Promise<ChemistryCalibrationBreakdown[]> {
  let calibrationMap: ChemistryCalibrationMap;

  if (forceRefresh) {
    try {
      calibrationMap = await refreshArchetypePairCalibrationMap();
    } catch (error) {
      console.warn("[Matching] Failed to refresh archetype chemistry calibration stats, falling back to stored data.", error);
      calibrationMap = await getArchetypePairCalibrationMap(false);
    }
  } else {
    calibrationMap = await getArchetypePairCalibrationMap(false);
  }

  return getAllArchetypePairs()
    .map(({ archetypeA, archetypeB, baseScore }) => {
      const fallback = calibrationMap.get(createCalibrationKey(archetypeA, archetypeB));

      return fallback ?? {
        archetypeA,
        archetypeB,
        baseScore,
        sampleCount: 0,
        avgMeetAgain: null,
        avgAtmosphere: null,
        empiricalScore: null,
        appliedDelta: 0,
        calibratedScore: baseScore,
        hasSufficientSamples: false,
        lastAggregatedAt: null,
      };
    })
    .sort((left, right) => {
      const deltaDiff = Math.abs(right.appliedDelta) - Math.abs(left.appliedDelta);
      if (deltaDiff !== 0) {
        return deltaDiff;
      }

      const sampleDiff = right.sampleCount - left.sampleCount;
      if (sampleDiff !== 0) {
        return sampleDiff;
      }

      return left.archetypeA.localeCompare(right.archetypeA, "zh-Hans-CN")
        || left.archetypeB.localeCompare(right.archetypeB, "zh-Hans-CN");
    });
}

export function getCalibratedChemistryScore(
  archetype1: ArchetypeName,
  archetype2: ArchetypeName,
  calibrationMap?: ChemistryCalibrationMap,
): number {
  if (!calibrationMap) {
    return getChemistryScore(archetype1, archetype2);
  }

  return Math.round(
    calibrationMap.get(createCalibrationKey(archetype1, archetype2))?.calibratedScore
      ?? getChemistryScore(archetype1, archetype2),
  );
}
