/**
 * Runtime emoji guard for AI-generated copy.
 *
 * JoyJoin's brand system treats emojis as UI-icon material only; inline emojis
 * in user-facing prose are stripped so the writing reads clean and premium.
 */

// Broad Unicode emoji ranges plus common symbols. This is intentionally
// conservative: it removes pictographs, transport/map symbols, dingbats,
// flags, keycap sequences, and ZWJ/fitzpatrick modifiers, while leaving
// CJK characters, Latin text, numbers, and punctuation untouched.
const EMOJI_PATTERN =
  /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F018}-\u{1F270}]|[\u{238C}]|[\u{2B06}-\u{2B07}]|[\u{2B05}]|[\u{2B95}]|[\u{2B50}]|[\u{1F004}]|[\u{1F0CF}]|[\u{1F170}-\u{1F171}]|[\u{1F17E}-\u{1F17F}]|[\u{1F18E}]|[\u{3030}]|[\u{303D}]|[\u{3297}]|[\u{3299}]|[\u{23F0}-\u{23FF}]|[\u{24C2}]|[\u{200D}]|[\u{FE0F}]|[\u{20E3}]|[\u{E0020}-\u{E007F}]/gu

export function stripEmojis(input: string): string {
  return input.replace(EMOJI_PATTERN, '').replace(/\s+/g, ' ').trim()
}

export function hasEmoji(input: string): boolean {
  return EMOJI_PATTERN.test(input)
}
