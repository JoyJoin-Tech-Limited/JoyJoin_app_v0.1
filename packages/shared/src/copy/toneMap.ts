/**
 * Surface ↔ Tone Mode Mapping
 *
 * Defines which tone mode applies to each UI surface.
 * AI Agent uses this to auto-select tone mode when generating copy.
 */

export type ToneMode = 'system-ui' | 'yuezai-voice' | 'social-game';

export interface ToneModeConfig {
  id: ToneMode;
  label: string;
  description: string;
  maxParticles: number;
  allowedParticles: string[];
  person: '你' | '你们' | '你/你们' | '你/大家' | '大家' | 'none';
}

export const TONE_MODES: Record<ToneMode, ToneModeConfig> = {
  'system-ui': {
    id: 'system-ui',
    label: 'System UI',
    description: 'Warm neutral — friendly but efficient',
    maxParticles: 1,
    allowedParticles: ['吧', '哦'],
    person: '你',
  },
  'yuezai-voice': {
    id: 'yuezai-voice',
    label: '悦仔 Voice',
    description: 'Full 闺蜜 — warm, playful, characterful',
    maxParticles: 3,
    allowedParticles: ['啊', '呀', '嘛', '呢', '哦', '哈', '哟', '啦', '吧', '诶', '嘿', '噢'],
    person: '你们',
  },
  'social-game': {
    id: 'social-game',
    label: 'Social/Game',
    description: 'Playful banter — in-character, low-stakes humour',
    maxParticles: 3,
    allowedParticles: ['啊', '呀', '嘛', '呢', '哦', '哈', '哟', '啦', '吧', '诶', '嘿', '噢'],
    person: '你/大家',
  },
};

export type Surface =
  | 'button'
  | 'nav-tab'
  | 'toast-error'
  | 'full-page-error'
  | 'inline-error'
  | 'empty-state'
  | 'loading-whisper'
  | 'yuezai-dialogue'
  | 'tier-recommendation'
  | 'archetype-compatibility'
  | 'dice-dare'
  | 'vote-reveal'
  | 'payment-confirmation'
  | 'payment-error'
  | 'refund'
  | 'ban-suspension'
  | 'legal'
  | 'phase-intro'
  | 'auction-banter'
  | 'settings'
  | 'onboarding';

/** Surface → tone mode mapping */
export const SURFACE_TONE_MAP: Record<Surface, ToneMode> = {
  button: 'system-ui',
  'nav-tab': 'system-ui',
  'toast-error': 'system-ui',
  'full-page-error': 'yuezai-voice',
  // Compact inline error rows (mascot icon + bubble) speak the 悦仔 voice,
  // same as full-page errors — only the surface is smaller.
  'inline-error': 'yuezai-voice',
  'empty-state': 'yuezai-voice',
  'loading-whisper': 'yuezai-voice',
  'yuezai-dialogue': 'yuezai-voice',
  'tier-recommendation': 'yuezai-voice',
  'archetype-compatibility': 'yuezai-voice',
  'dice-dare': 'social-game',
  'vote-reveal': 'social-game',
  'phase-intro': 'social-game',
  'auction-banter': 'social-game',
  'payment-confirmation': 'system-ui',
  'payment-error': 'system-ui',
  refund: 'system-ui',
  'ban-suspension': 'system-ui',
  legal: 'system-ui',
  settings: 'system-ui',
  onboarding: 'system-ui',
};

/** Get the tone mode for a given surface */
export function getToneForSurface(surface: Surface): ToneMode {
  return SURFACE_TONE_MAP[surface] ?? 'system-ui';
}

/** Get the tone config for a given tone mode */
export function getToneConfig(mode: ToneMode): ToneModeConfig {
  return TONE_MODES[mode];
}

/**
 * Validate that a copy string follows tone mode constraints.
 * Returns violations or empty array.
 */
export function validateCopyTone(text: string, mode: ToneMode): string[] {
  const config = TONE_MODES[mode];
  const violations: string[] = [];

  // Count particles
  let particleCount = 0;
  for (const p of config.allowedParticles) {
    const regex = new RegExp(p, 'g');
    const matches = text.match(regex);
    if (matches) {
      particleCount += matches.length;
    }
  }
  if (particleCount > config.maxParticles) {
    violations.push(
      `[${mode}] Too many particles: ${particleCount} > max ${config.maxParticles}`
    );
  }

  return violations;
}
