import type { SocialSessionState } from '@shared/socialIcebreaker';

/**
 * Recursively replace every occurrence of a bot's real `users.id` with its
 * opaque `botId` in the session state before it crosses the API boundary.
 *
 * This is intentionally a comprehensive string replacement: bot userIds are
 * UUIDs from the `users.id` pool, and the risk of an accidental collision with
 * user-generated text is negligible. Using a deny-list approach would require
 * every phase field to opt in, which is error-prone as phases evolve.
 *
 * Server-only mappings (`botPersonas`) are stripped separately; this function
 * only mutates the client-facing state copy.
 */
export function mapBotUserIdsToBotIds(
  state: SocialSessionState,
  botIdByUserId: Map<string, string>,
): SocialSessionState {
  if (botIdByUserId.size === 0) return state;

  const botUserIds = new Set(botIdByUserId.keys());

  function transform(value: unknown): unknown {
    if (typeof value === 'string') {
      return botUserIds.has(value) ? botIdByUserId.get(value) : value;
    }
    if (Array.isArray(value)) {
      return value.map(transform);
    }
    if (value !== null && typeof value === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value)) {
        const mappedKey = botUserIds.has(key) ? botIdByUserId.get(key) ?? key : key;
        result[mappedKey] = transform(val);
      }
      return result;
    }
    return value;
  }

  return transform(state) as SocialSessionState;
}

/**
 * Build a botId→userId map from the server-side single-test persona list.
 */
export function buildBotIdByUserId(
  botPersonas: { botId: string; userId: string }[],
): Map<string, string> {
  return new Map(botPersonas.map((p) => [p.userId, p.botId]));
}
