import { z } from "zod";

export const alangCoordinateSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export type AlangCoordinate = z.infer<typeof alangCoordinateSchema>;

/**
 * Normalizes pre-V1.4 JSON coordinates at the persistence boundary.
 * Runtime and API code only consume `latitude` / `longitude` afterwards.
 */
export function normalizeAlangCoordinate(value: unknown): AlangCoordinate | null {
  const canonical = alangCoordinateSchema.safeParse(value);
  if (canonical.success) return canonical.data;

  if (!value || typeof value !== "object") return null;
  const legacy = value as { lat?: unknown; lng?: unknown };
  const normalized = alangCoordinateSchema.safeParse({
    latitude: legacy.lat,
    longitude: legacy.lng,
  });
  return normalized.success ? normalized.data : null;
}

export const alangProgressStageSchema = z.enum([
  "not_started",
  "configuring",
  "searching",
  "found",
  "dialogue",
  "companion",
  "arrived",
  "closing",
  "result",
  "completed",
  "abandoned",
]);

export type AlangProgressStage = z.infer<typeof alangProgressStageSchema>;

export const alangMissionStatusSchema = z.enum([
  "in_progress",
  "arrived",
  "completed",
  "abandoned",
]);

export type AlangMissionStatus = z.infer<typeof alangMissionStatusSchema>;

const canonicalAlangGpsPointSchema = alangCoordinateSchema.extend({
  ts: z.number(),
  accuracy: z.number().optional(),
});

export const alangGpsPointSchema = z.preprocess((value) => {
  if (!value || typeof value !== "object") return value;
  const point = value as Record<string, unknown>;
  const coordinate = normalizeAlangCoordinate(point);
  return coordinate ? { ...point, ...coordinate } : value;
}, canonicalAlangGpsPointSchema);

export type AlangGpsPoint = z.infer<typeof alangGpsPointSchema>;

export const alangChoiceRecordSchema = z.object({
  nodeId: z.string(),
  choiceIndex: z.number(),
  label: z.string(),
});

export type AlangChoiceRecord = z.infer<typeof alangChoiceRecordSchema>;

export interface AlangProgressRequest {
  nodeId: string;
}

export interface AlangGpsRequest {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: number;
  targetOverride?: {
    latitude: number;
    longitude: number;
    radiusMeters: 5;
  };
}

export interface AlangChoiceRequest {
  nodeId: string;
  choiceIndex: number;
}

export interface AlangArrivalResponse {
  arrived: boolean;
  distanceMeters: number;
  radiusMeters: number;
  stableCount: number;
  nodeId?: string;
  debug?: boolean;
}

export interface AlangStoryArchiveSummary {
  id: string;
  missionId: string;
  title: string;
  locationName: string;
  completedAt: string;
  finalMood: string;
  closingLine?: string;
  summaryLine: string;
  nodeHistory?: string[];
  choicesMade?: Array<{ nodeId: string; choiceIndex: number; label: string }>;
  companionLines?: string[];
  isDebugSession: boolean;
}
