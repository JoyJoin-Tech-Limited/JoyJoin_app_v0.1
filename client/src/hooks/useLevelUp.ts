import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";

interface LevelConfig {
  level: number;
  name: string;
  nameCn: string;
  icon: string;
  xpRequired: number;
  benefits: string[];
  benefitsCn: string[];
}

interface GamificationInfo {
  experiencePoints: number;
  joyCoins: number;
  currentLevel: number;
  levelConfig: LevelConfig;
  nextLevelInfo: { nextLevel: number; xpNeeded: number; progress: number } | null;
  activityStreak: number;
}

interface LevelUpState {
  showCelebration: boolean;
  previousLevel: number;
  newLevel: number;
  levelConfig: LevelConfig | null;
}

const LEVEL_UP_STORAGE_KEY = "joyjoin_last_known_level";

export function useLevelUp() {
  const [levelUpState, setLevelUpState] = useState<LevelUpState>({
    showCelebration: false,
    previousLevel: 0,
    newLevel: 0,
    levelConfig: null,
  });

  const { data: gamification } = useQuery<GamificationInfo>({
    queryKey: ["/api/user/gamification"],
  });

  useEffect(() => {
    if (!gamification) return;

    const storedLevel = localStorage.getItem(LEVEL_UP_STORAGE_KEY);
    const lastKnownLevel = storedLevel ? parseInt(storedLevel, 10) : 0;
    const currentLevel = gamification.currentLevel;

    if (lastKnownLevel > 0 && currentLevel > lastKnownLevel) {
      setLevelUpState({
        showCelebration: true,
        previousLevel: lastKnownLevel,
        newLevel: currentLevel,
        levelConfig: gamification.levelConfig,
      });
    }

    localStorage.setItem(LEVEL_UP_STORAGE_KEY, String(currentLevel));
  }, [gamification]);

  const closeCelebration = useCallback(() => {
    setLevelUpState((prev) => ({ ...prev, showCelebration: false }));
  }, []);

  const triggerLevelUp = useCallback(
    (prevLevel: number, newLevel: number, config: LevelConfig) => {
      setLevelUpState({
        showCelebration: true,
        previousLevel: prevLevel,
        newLevel: newLevel,
        levelConfig: config,
      });
      localStorage.setItem(LEVEL_UP_STORAGE_KEY, String(newLevel));
    },
    []
  );

  return {
    ...levelUpState,
    closeCelebration,
    triggerLevelUp,
    currentLevel: gamification?.currentLevel ?? 1,
  };
}
