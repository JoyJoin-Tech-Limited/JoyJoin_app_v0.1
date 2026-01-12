import { useAchievementContext } from "@/contexts/AchievementContext";
import { AchievementBadge, getAchievementProgress } from "./AchievementBadge";
import { Progress } from "@/components/ui/progress";

export function AchievementCollection() {
  const { achievements, unlockedIds } = useAchievementContext();
  const { progress, unlocked, total } = getAchievementProgress(unlockedIds);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold">成就合集</p>
          <p className="text-xs text-muted-foreground">已解锁 {unlocked}/{total}</p>
        </div>
        <div className="w-28">
          <Progress value={progress} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {achievements.map((achievement) => (
          <AchievementBadge
            key={achievement.id}
            achievement={achievement}
            unlocked={unlockedIds.includes(achievement.id)}
          />
        ))}
      </div>
    </div>
  );
}
