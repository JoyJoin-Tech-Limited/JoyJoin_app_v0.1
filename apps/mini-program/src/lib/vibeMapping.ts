export type VibeId = 'deep_chat' | 'balanced' | 'play_fun'
export type ApiVibe = 'chat' | 'balanced' | 'game'

/** Client vibe ID → server API vibe identifier */
export const VIBE_TO_API: Record<VibeId, ApiVibe> = {
  deep_chat: 'chat',
  balanced: 'balanced',
  play_fun: 'game',
}

/** Server API vibe identifier → client vibe ID */
export const API_TO_VIBE: Record<ApiVibe, VibeId> = {
  chat: 'deep_chat',
  balanced: 'balanced',
  game: 'play_fun',
}

/** Safely convert a server-side vibe string to a client VibeId */
export function apiVibeToClient(apiVibe: string | undefined): VibeId | undefined {
  if (!apiVibe) return undefined
  return (API_TO_VIBE as Record<string, VibeId | undefined>)[apiVibe]
}
