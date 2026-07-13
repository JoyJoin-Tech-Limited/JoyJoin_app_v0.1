import { z } from "zod";

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

export const alangGpsPointSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  ts: z.number(),
  accuracy: z.number().optional(),
});

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
    lat: number;
    lng: number;
    radiusMeters: number;
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
