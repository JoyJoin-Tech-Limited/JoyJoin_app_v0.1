import { cdnAsset } from '../../../lib/utils/cdnAssets'

/** Legacy Unicode-emoji → CDN asset mapping (kept for backward compatibility). */
export const PERSONALITY_EMOJI_ASSETS: Record<string, string> = {
  '😮‍💨': cdnAsset('/assets/lovart/personality-emojis/lovart-icon-personality-solo-rest-20260507-v1.png'),
  '🥳': cdnAsset('/assets/lovart/personality-emojis/lovart-icon-personality-party-ready-20260507-v1.png'),
  '🍿': cdnAsset('/assets/lovart/personality-emojis/lovart-icon-personality-popcorn-observe-20260507-v1.png'),
  '💬': cdnAsset('/assets/lovart/personality-emojis/lovart-icon-personality-private-dm-20260507-v1.png'),
  '🤫': cdnAsset('/assets/lovart/personality-emojis/lovart-icon-personality-leave-quietly-20260507-v1.png'),
  '🕊️': cdnAsset('/assets/lovart/personality-emojis/lovart-icon-personality-peacemaker-20260507-v1.png'),
  '🔥': cdnAsset('/assets/lovart/personality-emojis/lovart-icon-personality-direct-speak-20260507-v1.png'),
}

/** Semantic key → CDN asset mapping (preferred; decouples icon from text content). */
export const PERSONALITY_ICON_ASSETS: Record<string, string> = {
  'popcorn': cdnAsset('/assets/lovart/personality-emojis/lovart-icon-personality-popcorn-observe-20260507-v1.png'),
  'dm': cdnAsset('/assets/lovart/personality-emojis/lovart-icon-personality-private-dm-20260507-v1.png'),
  'leave': cdnAsset('/assets/lovart/personality-emojis/lovart-icon-personality-leave-quietly-20260507-v1.png'),
  'dove': cdnAsset('/assets/lovart/personality-emojis/lovart-icon-personality-peacemaker-20260507-v1.png'),
  'direct': cdnAsset('/assets/lovart/personality-emojis/lovart-icon-personality-direct-speak-20260507-v1.png'),
  // Slider endpoint anchors (WS-3, 2026-09-02): semantic aliases for the
  // existing Lovart assets already mapped above by legacy emoji keys.
  'soloRest': cdnAsset('/assets/lovart/personality-emojis/lovart-icon-personality-solo-rest-20260507-v1.png'),
  'partyReady': cdnAsset('/assets/lovart/personality-emojis/lovart-icon-personality-party-ready-20260507-v1.png'),
}

export function resolvePersonalityEmoji(emoji: string): string | undefined {
  return PERSONALITY_EMOJI_ASSETS[emoji]
}

export function resolvePersonalityIcon(key: string): string | undefined {
  return PERSONALITY_ICON_ASSETS[key]
}
