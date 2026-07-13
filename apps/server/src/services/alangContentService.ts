import type { MissionContent } from "@shared/alang/contentSchema";
import { missionContentSchema } from "@shared/alang/contentSchema";
import { logger } from "../lib/logger";
import { getMissionBySlug } from "../repositories/alangRepo";

const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX_ENTRIES = 100;
let cachedMissions: Map<string, { content: MissionContent; expiresAt: number }> | null = null;

export async function loadMissionContent(slug: string): Promise<MissionContent | null> {
  const cached = cachedMissions?.get(slug);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.content;
  }
  if (cached) {
    cachedMissions?.delete(slug);
  }

  const row = await getMissionBySlug(slug);

  if (!row) return null;

  const parsed = missionContentSchema.safeParse(row.contentJson);
  if (!parsed.success) {
    logger.error("[AlangContent] Invalid mission content JSON", { slug, errors: parsed.error.flatten() });
    return null;
  }

  if (!cachedMissions) cachedMissions = new Map();
  if (cachedMissions.size >= CACHE_MAX_ENTRIES) {
    const oldestKey = cachedMissions.keys().next().value;
    if (oldestKey) cachedMissions.delete(oldestKey);
  }
  cachedMissions.set(slug, {
    content: parsed.data,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
  return parsed.data;
}

export function getNodeById(content: MissionContent, nodeId: string) {
  return content.nodes.find((n) => n.id === nodeId) ?? null;
}

export function getNextNode(content: MissionContent, currentNodeId: string, choiceIndex?: number) {
  const node = getNodeById(content, currentNodeId);
  if (!node) return null;

  if (node.choices && choiceIndex !== undefined) {
    const choice = node.choices[choiceIndex];
    return choice ? { nextNodeId: choice.nextNodeId, response: choice.response, moodShift: choice.moodShift } : null;
  }

  if (node.nextNodeId) {
    return { nextNodeId: node.nextNodeId, response: undefined, moodShift: undefined };
  }

  return null;
}

export function invalidateMissionCache(slug?: string) {
  if (!cachedMissions) return;
  if (slug) {
    cachedMissions.delete(slug);
  } else {
    cachedMissions = null;
  }
}
