/**
 * Warmup topic SET revision — the single cross-client truth for "the whole
 * deck was replaced". Clients must NOT infer replacement from
 * `currentTopicIndex`: a new deck legitimately starts at index 0, so an
 * index-only transition is invisible to participants.
 *
 * Semantics (contract AC-04):
 * - A brand-new session starts at revision 1.
 * - A whole-deck replacement increments old + 1 and stamps updatedAt.
 * - Advancing to the next card inside the SAME deck only stamps
 *   `warmupTopicAdvancedAt`; revision and updatedAt stay put.
 */

import type { SocialSessionState, SocialTopic } from '@shared/socialIcebreaker';
import type { AIResponseMeta } from '@shared/types/aiMeta';

export type WarmupTopicSetProvenance = NonNullable<SocialSessionState['warmupTopicSetProvenance']>;

export function stampNewSessionTopicSet(state: SocialSessionState, now: number): void {
  if (state.warmupTopicSetRevision === undefined) state.warmupTopicSetRevision = 1;
  if (state.warmupTopicSetUpdatedAt === undefined) state.warmupTopicSetUpdatedAt = now;
  if (state.warmupTopicAdvancedAt === undefined) state.warmupTopicAdvancedAt = now;
  if (state.warmupTopicSetProvenance === undefined) state.warmupTopicSetProvenance = 'precompile';
}

/**
 * Pre-compilation writes the FIRST deck for a session. It keeps revision 1
 * (already stamped at /start) instead of double-incrementing; a session that
 * was created before this field existed is upgraded to 1 atomically here.
 */
export function stampPrecompiledTopicSet(state: SocialSessionState, now: number): void {
  if (state.warmupTopicSetRevision === undefined) {
    state.warmupTopicSetRevision = 1;
  }
  state.warmupTopicSetUpdatedAt = now;
  state.warmupTopicAdvancedAt = now;
  state.warmupTopicSetProvenance = 'precompile';
}

export function commitWholeTopicSet(
  state: SocialSessionState,
  input: {
    topics: SocialTopic[];
    meta: AIResponseMeta;
    provenance: WarmupTopicSetProvenance;
    now: number;
  },
): void {
  const previous = state.warmupTopicSetRevision ?? 0;
  state.warmupTopics = input.topics;
  state.warmupTopicsMeta = input.meta;
  state.warmupTopicsStatus = 'ready';
  state.warmupTopicsGeneratingAt = undefined;
  state.currentTopicIndex = 0;
  state.warmupTopicSetRevision = previous + 1;
  state.warmupTopicSetUpdatedAt = input.now;
  state.warmupTopicAdvancedAt = input.now;
  state.warmupTopicSetProvenance = input.provenance;
}

export function markTopicAdvanced(state: SocialSessionState, now: number): void {
  state.warmupTopicAdvancedAt = now;
}
