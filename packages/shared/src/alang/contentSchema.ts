import { z } from "zod";

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
  gpsTrigger: z.object({
    lat: z.number(),
    lng: z.number(),
    radiusMeters: z.number().default(5),
  }).optional(),
  choices: z.array(storyNodeChoiceSchema).optional(),
  nextNodeId: z.string().optional(),
});

export const missionContentSchema = z.object({
  version: z.literal("1.0"),
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
    defaultTargetLocation: z.object({
      lat: z.number(),
      lng: z.number(),
      radiusMeters: z.number(),
    }).optional(),
    defaultCompanionEndLocation: z.object({
      lat: z.number(),
      lng: z.number(),
      radiusMeters: z.number(),
    }).optional(),
  }).optional(),
}).superRefine((mission, ctx) => {
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

export type StoryNodeChoice = z.infer<typeof storyNodeChoiceSchema>;
export type StoryNode = z.infer<typeof storyNodeSchema>;
export type MissionContent = z.infer<typeof missionContentSchema>;
