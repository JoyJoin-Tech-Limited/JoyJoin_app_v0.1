/**
 * Context Injector — Archetype Mix Injection into AI Prompts
 *
 * Builds group-level archetype context from a session roster so that
 * prompt builders can inject a 【本组画像】block into group-facing prompts.
 *
 * Pure function; side-effect free. Callers (e.g. socialIcebreakerAIService)
 * are responsible for AITrace logging when the context is actually injected.
 */

import { ARCHETYPE_BY_ID } from '@shared/personality/archetypeNames';

export interface SessionArchetypeContext {
  /** e.g. "社牛柯基×2、小太阳鸡×1" */
  mixText: string;
  /** The archetype with highest count; undefined if tie */
  dominantArchetype?: string;
  /** 0–1, how mixed the group is (unique archetypes / roster length) */
  diversityScore: number;
}

/**
 * Build archetype context from a session roster.
 *
 * Rules:
 * - Count occurrences of each archetype in the roster
 * - Format: archetypeName×count for counts >1, just archetypeName for count === 1
 * - Join with 、 (Chinese enumeration comma)
 * - dominantArchetype = the archetype with highest count (undefined if tie)
 * - diversityScore = unique archetypes / roster length (capped at 1.0)
 */
export function buildArchetypeContext(
  roster: Array<{ archetype?: string }>,
): SessionArchetypeContext {
  if (!roster || roster.length === 0) {
    return { mixText: '', diversityScore: 0 };
  }

  const counts = new Map<string, number>();
  for (const entry of roster) {
    const id = entry.archetype;
    if (!id) continue;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  // Build mixText using canonical Chinese display names
  const segments: string[] = [];
  for (const [id, count] of counts) {
    const def = ARCHETYPE_BY_ID[id];
    const name = def?.nameCn ?? id;
    segments.push(count > 1 ? `${name}×${count}` : name);
  }

  const mixText = segments.join('、');

  // Dominant archetype (highest count; undefined if tie)
  let dominantArchetype: string | undefined;
  let maxCount = 0;
  let tie = false;
  for (const [id, count] of counts) {
    if (count > maxCount) {
      maxCount = count;
      const def = ARCHETYPE_BY_ID[id];
      dominantArchetype = def?.nameCn ?? id;
      tie = false;
    } else if (count === maxCount && count > 0) {
      tie = true;
    }
  }
  if (tie) {
    dominantArchetype = undefined;
  }

  // Diversity score
  const uniqueCount = counts.size;
  const diversityScore = Math.min(uniqueCount / roster.length, 1.0);

  return {
    mixText,
    dominantArchetype,
    diversityScore,
  };
}
