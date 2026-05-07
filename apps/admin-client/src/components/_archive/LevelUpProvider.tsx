import { useLevelUp } from "@/hooks/useLevelUp";
import LevelUpCelebration from "./LevelUpCelebration";

interface LevelUpProviderProps {
  children: React.ReactNode;
}

export default function LevelUpProvider({ children }: LevelUpProviderProps) {
  const { showCelebration, previousLevel, newLevel, levelConfig, closeCelebration } = useLevelUp();

  return (
    <>
      {children}
      {levelConfig && (
        <LevelUpCelebration
          show={showCelebration}
          previousLevel={previousLevel}
          newLevel={newLevel}
          levelConfig={levelConfig}
          onClose={closeCelebration}
        />
      )}
    </>
  );
}
