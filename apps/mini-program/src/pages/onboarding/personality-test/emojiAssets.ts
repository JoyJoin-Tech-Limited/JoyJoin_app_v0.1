export const PERSONALITY_EMOJI_ASSETS: Record<string, string> = {
  '😮‍💨': '/assets/lovart/personality-emojis/lovart-icon-personality-solo-rest-20260507-v1.png',
  '🥳': '/assets/lovart/personality-emojis/lovart-icon-personality-party-ready-20260507-v1.png',
  '🍿': '/assets/lovart/personality-emojis/lovart-icon-personality-popcorn-observe-20260507-v1.png',
  '💬': '/assets/lovart/personality-emojis/lovart-icon-personality-private-dm-20260507-v1.png',
  '🤫': '/assets/lovart/personality-emojis/lovart-icon-personality-leave-quietly-20260507-v1.png',
  '🕊️': '/assets/lovart/personality-emojis/lovart-icon-personality-peacemaker-20260507-v1.png',
  '🔥': '/assets/lovart/personality-emojis/lovart-icon-personality-direct-speak-20260507-v1.png',
}

export function resolvePersonalityEmoji(emoji: string): string | undefined {
  return PERSONALITY_EMOJI_ASSETS[emoji]
}
