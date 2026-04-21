import { z } from 'zod';

/** Canonical API values for POST /api/miniscript/generate */
export const MINI_SCRIPT_STYLES = [
  'western_court',
  'medieval',
  'ancient_chinese',
  'xianxia',
  'future_tech',
  'modern_urban',
  'republican_era',
] as const;

export type MiniScriptStyle = (typeof MINI_SCRIPT_STYLES)[number];

export const MINI_SCRIPT_GENRES = [
  'light_reasoning',
  'thriller_mystery',
  'romance',
  'absurd_comedy',
] as const;

export type MiniScriptGenre = (typeof MINI_SCRIPT_GENRES)[number];

export const miniScriptGenerateRequestSchema = z.object({
  socialSessionId: z.string().min(1),
  playerCount: z.number().int().min(4).max(6),
  style: z.enum(MINI_SCRIPT_STYLES),
  genres: z.array(z.enum(MINI_SCRIPT_GENRES)).min(1).max(8),
});

export type MiniScriptGenerateRequest = z.infer<typeof miniScriptGenerateRequestSchema>;

const miniScriptCharacterSchema = z.object({
  slotIndex: z.number().int().min(0).max(5),
  roleLabel: z.string().min(1).max(80),
  sinHook: z.string().min(1).max(400),
  alibi: z.string().min(1).max(500),
  secret: z.string().min(1).max(500),
});

const miniScriptActSchema = z.object({
  actNumber: z.number().int().min(1).max(5),
  title: z.string().min(1).max(120),
  beats: z.array(z.string().min(1).max(400)).min(1).max(12),
});

export const miniScriptStoryFrameworkSchema = z.object({
  schemaVersion: z.literal(1),
  style: z.enum(MINI_SCRIPT_STYLES),
  genres: z.array(z.enum(MINI_SCRIPT_GENRES)).min(1),
  premise: z.string().min(1).max(2000),
  characters: z.array(miniScriptCharacterSchema).min(4).max(6),
  act_flow: z.array(miniScriptActSchema).min(2).max(4),
  ending: z.object({
    resolutionSummary: z.string().min(1).max(800),
    confessionMechanic: z.string().min(1).max(400),
  }),
});

export type MiniScriptStoryFramework = z.infer<typeof miniScriptStoryFrameworkSchema>;

export function parseMiniScriptStoryFramework(data: unknown): MiniScriptStoryFramework {
  return miniScriptStoryFrameworkSchema.parse(data);
}
