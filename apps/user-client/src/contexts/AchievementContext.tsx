import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ACHIEVEMENTS, getAchievementById, type Achievement } from "@/data/achievements";

interface AchievementContextValue {
  achievements: Achievement[];
  unlockedIds: string[];
  activeAchievement: Achievement | null;
  unlockAchievement: (id: string) => void;
  isUnlocked: (id: string) => boolean;
  dismissActive: () => void;
}

const STORAGE_KEY = "joyjoin_achievements";

const AchievementContext = createContext<AchievementContextValue | undefined>(undefined);

export function AchievementProvider({ children }: { children: React.ReactNode }) {
  const [unlockedIds, setUnlockedIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error("Failed to load achievements", error);
      return [];
    }
  });
  const [queue, setQueue] = useState<Achievement[]>([]);
  const [activeAchievement, setActiveAchievement] = useState<Achievement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(unlockedIds));
    } catch (error) {
      console.error("Failed to persist achievements", error);
    }
  }, [unlockedIds]);

  const isUnlocked = useCallback(
    (id: string) => unlockedIds.includes(id),
    [unlockedIds]
  );

  const unlockAchievement = useCallback(
    (id: string) => {
      if (isUnlocked(id)) return;
      const achievement = getAchievementById(id);
      if (!achievement) return;

      setUnlockedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
      setQueue((prev) => {
        if (prev.find((item) => item.id === id) || activeAchievement?.id === id) {
          return prev;
        }
        return [...prev, achievement];
      });
    },
    [isUnlocked, activeAchievement]
  );

  useEffect(() => {
    if (!activeAchievement && queue.length > 0) {
      const [next, ...rest] = queue;
      setActiveAchievement(next);
      setQueue(rest);
    }
  }, [queue, activeAchievement]);

  const dismissActive = useCallback(() => {
    setActiveAchievement(null);
  }, []);

  const value = useMemo(
    () => ({
      achievements: ACHIEVEMENTS,
      unlockedIds,
      activeAchievement,
      unlockAchievement,
      isUnlocked,
      dismissActive,
    }),
    [unlockedIds, activeAchievement, unlockAchievement, isUnlocked, dismissActive]
  );

  return (
    <AchievementContext.Provider value={value}>
      {children}
    </AchievementContext.Provider>
  );
}

export function useAchievementContext(): AchievementContextValue {
  const context = useContext(AchievementContext);
  if (!context) {
    throw new Error("useAchievementContext must be used within an AchievementProvider");
  }
  return context;
}
