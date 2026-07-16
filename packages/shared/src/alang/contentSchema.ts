import { z } from "zod";
import {
  alangCoordinateSchema,
  normalizeAlangCoordinate,
} from "./missionTypes.js";
import { ALANG_ARRIVAL_RADIUS_METERS } from "./constants.js";

const fixedArrivalCoordinateSchema = alangCoordinateSchema.extend({
  // Accept legacy content at the read boundary, but normalize every runtime
  // target to the fixed server-authoritative PRD fence.
  radiusMeters: z.number().optional(),
}).transform(({ latitude, longitude }) => ({
  latitude,
  longitude,
  radiusMeters: ALANG_ARRIVAL_RADIUS_METERS,
}));

export const storyNodeChoiceSchema = z.object({
  label: z.string(),
  response: z.string(),
  nextNodeId: z.string(),
  moodShift: z.string().optional(),
});

export const storyNodeSchema = z.object({
  id: z.string(),
  type: z.enum([
    "event_card",
    "event_detail",
    "search_gate",
    "found_scene",
    "dialogue",
    "companion_start",
    "companion_move",
    "arrival_gate",
    "user_confirm",
    "closing",
    "result_card",
  ]),
  content: z.object({
    title: z.string().optional(),
    subtitle: z.string().optional(),
    body: z.string(),
    speaker: z.string().optional(),
    imageKey: z.string().optional(),
    moodTag: z.string().optional(),
    hints: z.array(z.string()).optional(),
    narration: z.string().optional(),
    choices: z.array(storyNodeChoiceSchema).optional(),
    companionLines: z.array(z.string()).optional(),
    closingLines: z.array(z.string()).optional(),
    confirmLabel: z.string().optional(),
    dateLabel: z.string().optional(),
    locationLabel: z.string().optional(),
    finalMood: z.string().optional(),
    summaryLine: z.string().optional(),
    eventLog: z.array(z.string()).optional(),
    companionStyle: z.string().optional(),
  }),
  gpsTrigger: fixedArrivalCoordinateSchema.optional(),
  choices: z.array(storyNodeChoiceSchema).optional(),
  nextNodeId: z.string().optional(),
});

const missionContentObjectSchema = z.object({
  // Approved Alang copy is immutable per published semantic version. Accept
  // future reviewed versions without weakening the rest of the content graph.
  version: z.string().regex(/^\d+\.\d+$/, "Mission content version must use major.minor format"),
  title: z.string(),
  description: z.string(),
  startNodeId: z.string(),
  nodes: z.array(storyNodeSchema),
  meta: z.object({
    estimatedDurationMinutes: z.number().optional(),
    difficulty: z.enum(["easy", "medium", "hard"]).optional(),
    tags: z.array(z.string()).optional(),
    npcName: z.string().optional(),
    searchRadiusMeters: z.number().optional(),
    defaultTargetLocation: fixedArrivalCoordinateSchema.optional(),
    defaultCompanionEndLocation: fixedArrivalCoordinateSchema.optional(),
  }).optional(),
});

function normalizeCoordinateValue(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  const coordinate = normalizeAlangCoordinate(value);
  if (!coordinate) return value;
  const rest = { ...(value as Record<string, unknown>) };
  delete rest.lat;
  delete rest.lng;
  return { ...rest, ...coordinate };
}

function normalizeLegacyMissionCoordinates(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  const mission = value as Record<string, unknown>;
  const rawNodes = Array.isArray(mission.nodes) ? mission.nodes : undefined;
  const rawMeta = mission.meta && typeof mission.meta === "object"
    ? mission.meta as Record<string, unknown>
    : undefined;

  return {
    ...mission,
    ...(rawNodes
      ? {
          nodes: rawNodes.map((rawNode) => {
            if (!rawNode || typeof rawNode !== "object") return rawNode;
            const node = rawNode as Record<string, unknown>;
            return {
              ...node,
              ...(node.gpsTrigger
                ? { gpsTrigger: normalizeCoordinateValue(node.gpsTrigger) }
                : {}),
            };
          }),
        }
      : {}),
    ...(rawMeta
      ? {
          meta: {
            ...rawMeta,
            ...(rawMeta.defaultTargetLocation
              ? { defaultTargetLocation: normalizeCoordinateValue(rawMeta.defaultTargetLocation) }
              : {}),
            ...(rawMeta.defaultCompanionEndLocation
              ? { defaultCompanionEndLocation: normalizeCoordinateValue(rawMeta.defaultCompanionEndLocation) }
              : {}),
          },
        }
      : {}),
  };
}

const validatedMissionContentSchema = missionContentObjectSchema.superRefine((mission, ctx) => {
  const nodeIds = new Set<string>();
  for (const [index, node] of mission.nodes.entries()) {
    if (nodeIds.has(node.id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["nodes", index, "id"],
        message: `Duplicate node id: ${node.id}`,
      });
    }
    nodeIds.add(node.id);
  }

  if (!nodeIds.has(mission.startNodeId)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["startNodeId"],
      message: `Unknown start node: ${mission.startNodeId}`,
    });
  }

  for (const [nodeIndex, node] of mission.nodes.entries()) {
    if (node.nextNodeId && !nodeIds.has(node.nextNodeId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["nodes", nodeIndex, "nextNodeId"],
        message: `Unknown next node: ${node.nextNodeId}`,
      });
    }

    if (node.type === "dialogue" && (!node.choices || node.choices.length < 2 || node.choices.length > 3)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["nodes", nodeIndex, "choices"],
        message: "Dialogue nodes require 2-3 choices",
      });
    }

    for (const [choiceIndex, choice] of (node.choices ?? []).entries()) {
      if (!nodeIds.has(choice.nextNodeId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["nodes", nodeIndex, "choices", choiceIndex, "nextNodeId"],
          message: `Unknown choice target: ${choice.nextNodeId}`,
        });
      }
    }
  }
});

export const missionContentSchema = z.preprocess(
  normalizeLegacyMissionCoordinates,
  validatedMissionContentSchema,
);

export type StoryNodeChoice = z.infer<typeof storyNodeChoiceSchema>;
export type StoryNode = z.infer<typeof storyNodeSchema>;
export type MissionContent = z.infer<typeof missionContentSchema>;
