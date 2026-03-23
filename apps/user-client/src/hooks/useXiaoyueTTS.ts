/**
 * useXiaoyueTTS — plays XiaoYue voice lines via MiniMax TTS
 *
 * Usage:
 *   const { speak, isPlaying, isTTSAvailable } = useXiaoyueTTS();
 *   speak('热身完毕！接下来是微挑战环节', { quality: 'turbo', emotion: 'excited' });
 *
 * Respects:
 *   - User mute preference (stored in localStorage under 'joyjoin_tts_muted')
 *   - System-level audio permissions (graceful no-op if Web Audio unavailable)
 *   - Concurrent play prevention (cancels previous audio before playing next)
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { apiRequest } from '@/lib/queryClient';

export interface TTSSpeakOptions {
  quality?: 'turbo' | 'hd';
  emotion?: 'warm' | 'excited' | 'playful' | 'happy' | 'neutral';
  callerTag?: string;
  /** If true, do not play and do not call API — useful for SSR/test */
  silent?: boolean;
}

const TTS_MUTED_KEY = 'joyjoin_tts_muted';

export function useXiaoyueTTS() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    try {
      return localStorage.getItem(TTS_MUTED_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      abortControllerRef.current?.abort();
    };
  }, []);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    abortControllerRef.current?.abort();
    setIsPlaying(false);
  }, []);

  const speak = useCallback(async (text: string, options: TTSSpeakOptions = {}) => {
    if (isMuted || options.silent || !text?.trim()) return;

    // Cancel any currently playing audio
    stop();

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await apiRequest('POST', '/api/tts/synthesise', {
        text,
        quality: options.quality ?? 'turbo',
        emotion: options.emotion,
        callerTag: options.callerTag ?? 'useXiaoyueTTS',
      });

      if (controller.signal.aborted) return;

      const data = await response.json() as { audioBase64?: string; error?: string };

      if (!data.audioBase64 || controller.signal.aborted) return;

      // Decode base64 → Blob → Object URL → play
      const binaryStr = atob(data.audioBase64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);

      const audio = new Audio(url);
      audioRef.current = audio;

      setIsPlaying(true);

      audio.onended = () => {
        URL.revokeObjectURL(url);
        setIsPlaying(false);
        audioRef.current = null;
      };

      audio.onerror = () => {
        URL.revokeObjectURL(url);
        setIsPlaying(false);
        audioRef.current = null;
      };

      await audio.play();

    } catch (err) {
      if (!controller.signal.aborted) {
        // TTS failure is non-fatal — log and continue silently
        console.warn('[useXiaoyueTTS] speak failed:', err);
      }
      setIsPlaying(false);
    }
  }, [isMuted, stop]);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const next = !prev;
      try {
        localStorage.setItem(TTS_MUTED_KEY, String(next));
      } catch {
        // ignore storage errors
      }
      if (next) stop();
      return next;
    });
  }, [stop]);

  return {
    speak,
    stop,
    isPlaying,
    isMuted,
    toggleMute,
    /** True if TTS API is reachable (optimistic — we don't ping ahead of time) */
    isTTSAvailable: true,
  };
}
