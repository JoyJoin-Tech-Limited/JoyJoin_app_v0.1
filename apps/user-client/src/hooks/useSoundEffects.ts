/**
 * Sound Effects Hook for Match Reveal Animation (Enhanced)
 * 提供情境化音频提示，支持用户偏好和设备检测
 */

export type SoundType = 'blindbox_shake' | 'character_appear' | 'team_gather' | 'match_complete';

const SOUND_PREFERENCES_KEY = 'joyjoin_sound_preferences';

export interface SoundPreferences {
  enabled: boolean;
  volume: number; // 0-1
  soundTypes: Record<SoundType, boolean>;
}

const DEFAULT_PREFERENCES: SoundPreferences = {
  enabled: true,
  volume: 0.3,
  soundTypes: {
    blindbox_shake: true,
    character_appear: true,
    team_gather: true,
    match_complete: true,
  },
};

/**
 * Get user sound preferences
 */
export const getSoundPreferences = (): SoundPreferences => {
  try {
    const stored = localStorage.getItem(SOUND_PREFERENCES_KEY);
    return stored ? JSON.parse(stored) : DEFAULT_PREFERENCES;
  } catch {
    return DEFAULT_PREFERENCES;
  }
};

/**
 * Update sound preferences
 */
export const updateSoundPreferences = (prefs: Partial<SoundPreferences>) => {
  try {
    const current = getSoundPreferences();
    const updated = { ...current, ...prefs };
    localStorage.setItem(SOUND_PREFERENCES_KEY, JSON.stringify(updated));
  } catch (error) {
    console.debug('Failed to update sound preferences:', error);
  }
};

/**
 * Check if device supports Web Audio API
 */
export const isAudioSupported = (): boolean => {
  return !!(window.AudioContext || (window as any).webkitAudioContext);
};

export const useSoundEffects = () => {
  const playSound = (soundType: SoundType) => {
    // Check user preferences
    const prefs = getSoundPreferences();
    if (!prefs.enabled || !prefs.soundTypes[soundType]) {
      return;
    }

    // Check if browser supports Web Audio API
    if (!isAudioSupported()) {
      return;
    }

    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const now = audioContext.currentTime;
      const oscillator = audioContext.createOscillator();
      const envelope = audioContext.createGain();

      oscillator.connect(envelope);
      envelope.connect(audioContext.destination);

      // Define sound profiles
      const soundProfiles: Record<SoundType, { frequency: number; duration: number; type: OscillatorType }> = {
        blindbox_shake: { frequency: 220, duration: 0.15, type: 'sine' },      // Low box rumble
        character_appear: { frequency: 880, duration: 0.25, type: 'square' },   // Bright entrance
        team_gather: { frequency: 440, duration: 0.2, type: 'triangle' },       // Gathering chime
        match_complete: { frequency: 1047, duration: 0.3, type: 'sine' },       // Completion bell
      };

      const profile = soundProfiles[soundType];
      oscillator.frequency.value = profile.frequency;
      oscillator.type = profile.type;

      // Envelope: attack, sustain, release
      const volume = prefs.volume;
      envelope.gain.setValueAtTime(0, now);
      envelope.gain.linearRampToValueAtTime(volume, now + 0.05); // Attack
      envelope.gain.linearRampToValueAtTime(volume * 0.3, now + profile.duration - 0.05); // Release
      envelope.gain.linearRampToValueAtTime(0, now + profile.duration);

      oscillator.start(now);
      oscillator.stop(now + profile.duration);
    } catch (error) {
      // Silently fail if audio context not available
      console.debug('Sound effects unavailable:', error);
    }
  };

  return { playSound, getSoundPreferences, updateSoundPreferences, isAudioSupported };
};
