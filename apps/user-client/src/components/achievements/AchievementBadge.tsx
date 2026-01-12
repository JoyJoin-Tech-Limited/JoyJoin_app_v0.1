import { ACHIEVEMENTS, RARITY_CONFIG, type Achievement } from "@/data/achievements";
import { cn } from "@/lib/utils";

interface AchievementBadgeProps {
  achievement: Achievement;
  unlocked: boolean;
}

export function AchievementBadge({ achievement, unlocked }: AchievementBadgeProps) {
  const rarity = RARITY_CONFIG[achievement.rarity];

  return (
    <div
      className={cn(
        "rounded-xl border p-3 flex gap-3 items-center transition-all",
        unlocked ? "bg-white shadow-sm" : "bg-muted/30 opacity-80",
        rarity.badgeClass
      )}
    >
      <div
        className={cn(
          "h-12 w-12 rounded-lg flex items-center justify-center text-xl",
          rarity.iconBg,
          unlocked ? "scale-100" : "scale-95 text-muted-foreground"
        )}
      >
        <span aria-hidden>{achievement.icon}</span>
      </div>
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-sm text-foreground">{achievement.title}</p>
          <span className={cn("text-[10px] px-2 py-0.5 rounded-full", rarity.badgeClass)}>
            {rarity.label}
          </span>
        </div>
        <p className="text-xs text-muted-foreground leading-snug">{achievement.description}</p>
        {!unlocked && <p className="text-[11px] text-muted-foreground">待解锁</p>}
      </div>
    </div>
  );
}

export function getAchievementProgress(unlockedIds: string[]) {
  const total = ACHIEVEMENTS.length;
  const unlocked = ACHIEVEMENTS.filter((achievement) => unlockedIds.includes(achievement.id)).length;
  const progress = total === 0 ? 0 : Math.round((unlocked / total) * 100);
  return { total, unlocked, progress };
}
