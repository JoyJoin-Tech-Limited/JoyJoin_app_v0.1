/**
 * AchievementContext - Provider and state management for achievements
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { Achievement, AchievementRarity } from "@/data/achievements";
import { ACHIEVEMENTS, getRarityHapticPattern } from "@/data/achievements";

const STORAGE_KEY = "joyjoin_achievements";

interface AchievementState {
  unlockedIds: string[];
  queue: Achievement[];
}

interface AchievementContextValue {
  /** All unlocked achievement IDs */
  unlockedIds: string[];
  /** Current achievement being displayed */
  currentAchievement: Achievement | null;
  /** Queue of achievements waiting to be displayed */
  queue: Achievement[];
  /** Unlock an achievement by ID */
  unlock: (id: string) => void;
  /** Check if an achievement is unlocked */
  isUnlocked: (id: string) => boolean;
  /** Dismiss the current achievement popup */
  dismissCurrent: () => void;
  /** Clear all achievements (for testing) */
  clearAll: () => void;
}

const AchievementContext = createContext<AchievementContextValue | null>(null);

export function useAchievements(): AchievementContextValue {
  const context = useContext(AchievementContext);
  if (!context) {
    throw new Error("useAchievements must be used within AchievementProvider");
  }
  return context;
}

interface AchievementProviderProps {
  children: React.ReactNode;
}

export function AchievementProvider({ children }: AchievementProviderProps) {
  const [unlockedIds, setUnlockedIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  
  const [queue, setQueue] = useState<Achievement[]>([]);
  const [currentAchievement, setCurrentAchievement] = useState<Achievement | null>(null);

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(unlockedIds));
    } catch {
      // Ignore storage errors
    }
  }, [unlockedIds]);

  // Process queue - show next achievement when current is dismissed
  useEffect(() => {
    if (!currentAchievement && queue.length > 0) {
      const [next, ...rest] = queue;
      setCurrentAchievement(next);
      setQueue(rest);
      
      // Trigger haptic feedback
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        const pattern = getRarityHapticPattern(next.rarity);
        navigator.vibrate(pattern);
      }
    }
  }, [currentAchievement, queue]);

  const unlock = useCallback((id: string) => {
    // Don't unlock if already unlocked
    if (unlockedIds.includes(id)) return;
    
    const achievement = ACHIEVEMENTS[id];
    if (!achievement) return;

    setUnlockedIds(prev => [...prev, id]);
    setQueue(prev => [...prev, achievement]);
  }, [unlockedIds]);

  const isUnlocked = useCallback((id: string) => {
    return unlockedIds.includes(id);
  }, [unlockedIds]);

  const dismissCurrent = useCallback(() => {
    setCurrentAchievement(null);
  }, []);

  const clearAll = useCallback(() => {
    setUnlockedIds([]);
    setQueue([]);
    setCurrentAchievement(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <AchievementContext.Provider
      value={{
        unlockedIds,
        currentAchievement,
        queue,
        unlock,
        isUnlocked,
        dismissCurrent,
        clearAll,
      }}
    >
      {children}
    </AchievementContext.Provider>
  );
}
