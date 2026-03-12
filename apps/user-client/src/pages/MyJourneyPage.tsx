import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { getArchetypeAvatar } from "@/lib/archetypeAdapter";
import { archetypeBgColors } from "@/lib/archetypeAvatars";
import { Sparkles } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import MobileHeader from "@/components/MobileHeader";
import BottomNav from "@/components/BottomNav";
import { motion } from "framer-motion";
import { useMemo } from "react";
import type { Event } from "@shared/schema";

// Event iconName → visual theme for timeline nodes
// iconName values set by poolMatchingService: 'utensils' (饭局), 'wine' (酒局), 'calendar' (other)
const eventTypeNodeTheme = (iconName: string | null | undefined): { gradient: string; emoji: string; label?: string } => {
  const themes: Record<string, { gradient: string; emoji: string; label: string }> = {
    'utensils': { gradient: 'from-orange-400 to-red-500', emoji: '🍜', label: '饭局' },
    'wine': { gradient: 'from-amber-400 to-orange-500', emoji: '🍻', label: '酒局' },
    'gamepad': { gradient: 'from-cyan-400 to-indigo-500', emoji: '🎮', label: '游戏局' },
    'leaf': { gradient: 'from-green-400 to-teal-500', emoji: '🌿', label: '户外' },
    'palette': { gradient: 'from-rose-400 to-fuchsia-500', emoji: '🎨', label: '文艺' },
  };
  const key = iconName || '';
  return themes[key] || { gradient: 'from-violet-500 to-purple-600', emoji: '🎉' };
};

// Archetype → hex background color for header gradient
const archetypeBgColorToHex: Record<string, string> = {
  '开心柯基': '#ffedd5',
  '太阳鸡': '#fef3c7',
  '夸夸豚': '#cffafe',
  '机智狐': '#ffedd5',
  '淡定海豚': '#dbeafe',
  '织网蛛': '#f3e8ff',
  '暖心熊': '#ffe4e6',
  '灵感章鱼': '#ede9fe',
  '沉思猫头鹰': '#f1f5f9',
  '定心大象': '#f9fafb',
  '稳如龟': '#d1fae5',
  '隐身猫': '#e0e7ff',
};

/**
 * Social Journey Timeline — shows the user's past events as a vertical timeline
 * Displayed when the user taps the "足迹" nav item
 */
export default function MyJourneyPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  const { data: events, isLoading } = useQuery<Array<Event>>({
    queryKey: ["/api/events/joined"],
  });

  const { data: profileStats } = useQuery<{ eventsCompleted: number; connectionsMade: number }>({
    queryKey: ["/api/profile/stats"],
  });
  const connectionsCount = profileStats?.connectionsMade ?? 0;

  const archetypeAvatar = user?.archetype
    ? getArchetypeAvatar(user.archetype)
    : null;

  const archetypeBg = user?.archetype
    ? archetypeBgColors[user.archetype] || "bg-primary/10"
    : "bg-primary/10";

  const headerBgHex = user?.archetype ? (archetypeBgColorToHex[user.archetype] || '#ede9fe') : '#ede9fe';

  const formatDate = (dateTime: Date | null | string) => {
    if (!dateTime) return "";
    const date = new Date(dateTime);
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  };

  const pastEvents = useMemo(() =>
    (events ?? []).filter((event) => {
      if (!event.dateTime) return false;
      return new Date(event.dateTime as unknown as string) < new Date();
    }),
  [events]);
  const hasEvents = pastEvents.length > 0;

  const streakWeeks = useMemo(() => {
    if (pastEvents.length === 0) return 0;
    const sorted = [...pastEvents]
      .filter(e => e.dateTime)
      .sort((a, b) => new Date(b.dateTime!).getTime() - new Date(a.dateTime!).getTime());
    if (sorted.length === 0) return 0;
    const getWeek = (d: Date) => {
      const start = new Date(d);
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - start.getDay());
      const year = start.getFullYear();
      const month = String(start.getMonth() + 1).padStart(2, "0");
      const day = String(start.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };
    const eventWeeks = new Set(sorted.map(e => getWeek(new Date(e.dateTime!))));
    const nowWeek = getWeek(new Date());
    let streak = 0;
    const checkWeek = new Date();
    for (let i = 0; i < 52; i++) {
      const w = getWeek(checkWeek);
      if (eventWeeks.has(w)) {
        streak++;
        checkWeek.setDate(checkWeek.getDate() - 7);
      } else if (i === 0 && w === nowWeek) {
        checkWeek.setDate(checkWeek.getDate() - 7);
      } else {
        break;
      }
    }
    return streak;
  }, [pastEvents]);

  // ── Loading state ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div
        className="min-h-screen pb-24 flex flex-col"
        style={{ background: `linear-gradient(to bottom, ${headerBgHex} 0%, white 45%)` }}
      >
        <MobileHeader title="足迹" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-muted-foreground">加载中...</p>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  // ── Empty state ────────────────────────────────────────────────────────────
  if (!hasEvents) {
    return (
      <div
        className="min-h-screen pb-24 flex flex-col"
        style={{ background: `linear-gradient(to bottom, ${headerBgHex} 0%, white 45%)` }}
      >
        <MobileHeader title="足迹" />
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-6">
          <div className="flex justify-center">
            {archetypeAvatar ? (
              <img
                src={archetypeAvatar}
                alt="你的人格原型"
                className="h-36 w-36 object-contain"
              />
            ) : (
              <div className="h-36 w-36 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                <Sparkles className="h-16 w-16 text-primary" />
              </div>
            )}
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-black text-foreground">还没有足迹</h1>
            <p className="text-sm text-muted-foreground">
              参加活动后，你的冒险旅程会在这里留下印记 🗺️
            </p>
          </div>
          <Button
            onClick={() => setLocation("/")}
            className="w-full h-12 text-base font-semibold"
            size="lg"
          >
            <Sparkles className="h-5 w-5 mr-2" />
            立即探索活动
          </Button>
          <p className="text-xs text-muted-foreground">加入盲盒活动，遇见有趣的灵魂</p>
        </div>
        <BottomNav />
      </div>
    );
  }

  // ── Timeline ───────────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen pb-24"
      style={{ background: `linear-gradient(to bottom, ${headerBgHex} 0%, white 45%)` }}
    >
      <MobileHeader title="足迹" />

      {/* User greeting */}
      <div className="px-4 pt-4 pb-2 flex items-center gap-3">
        <div
          className={`h-14 w-14 rounded-full ${archetypeBg} flex items-center justify-center overflow-hidden shadow-md flex-shrink-0`}
        >
          {archetypeAvatar ? (
            <img
              src={archetypeAvatar}
              alt={user?.displayName ? `${user.displayName}的人格原型头像` : "你的人格原型头像"}
              className="w-full h-full object-contain p-1"
            />
          ) : (
            <Sparkles className="h-7 w-7 text-primary" />
          )}
        </div>
        <div>
          <p className="text-sm text-muted-foreground">你好，</p>
          <h2 className="text-lg font-black">{user?.displayName || "冒险者"}</h2>
        </div>
      </div>

      {/* Stats bar */}
      <div className="mx-4 mb-5 p-4 bg-white rounded-2xl shadow-sm flex gap-3">
        <div className="text-center flex-1" aria-label={`已参加 ${pastEvents.length} 个活动`}>
          <div className="text-2xl font-black text-primary">{pastEvents.length}</div>
          <div className="text-[10px] text-muted-foreground font-medium">已参加</div>
        </div>
        <div className="w-px bg-muted/60" />
        <div className="text-center flex-1" aria-label={`已结识 ${connectionsCount} 位朋友`}>
          <div className="text-2xl font-black text-rose-500">{connectionsCount}</div>
          <div className="text-[10px] text-muted-foreground font-medium">已结识</div>
        </div>
        <div className="w-px bg-muted/60" />
        <div className="text-center flex-1" aria-label={`连续 ${streakWeeks} 周活跃`}>
          <div className="text-2xl font-black text-amber-500" aria-hidden="true">{streakWeeks > 0 ? `${streakWeeks}🔥` : '—'}</div>
          <div className="text-[10px] text-muted-foreground font-medium" aria-hidden="true">连胜周</div>
        </div>
      </div>

      {/* Vertical timeline */}
      <div className="px-4 relative">
        {/* Vertical connecting line */}
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary/60 to-primary/10 pointer-events-none" />

        {pastEvents.map((event, index) => (
          <motion.div
            key={event.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="flex gap-4 mb-5 relative"
          >
            {(() => {
              const nodeTheme = eventTypeNodeTheme(event.iconName);
              return (
                <>
                  <div
                    className={`h-12 w-12 rounded-full bg-gradient-to-br ${nodeTheme.gradient} flex items-center justify-center text-xl flex-shrink-0 z-10 shadow-lg`}
                    aria-hidden="true"
                  >
                    {nodeTheme.emoji}
                  </div>

                  <div
                    className="flex-1 bg-white rounded-2xl p-3"
                    style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}
                  >
                    <h3 className="font-bold text-sm leading-snug">{event.title}</h3>
                    <div className="flex gap-3 mt-1.5 text-[11px] text-muted-foreground flex-wrap items-center">
                      <span>📅 {formatDate(event.dateTime)}</span>
                      {event.location && <span>📍 {event.location}</span>}
                      {nodeTheme.label && (
                        <span className="px-1.5 py-0.5 rounded-full bg-muted/60 font-medium">
                          {nodeTheme.label}
                        </span>
                      )}
                    </div>
                  </div>
                </>
              );
            })()}
          </motion.div>
        ))}

        {/* Next event CTA node */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: pastEvents.length * 0.1 }}
          className="flex gap-4 mb-5 relative"
        >
          <div className="h-12 w-12 rounded-full border-2 border-dashed border-primary/40 bg-white flex items-center justify-center text-xl flex-shrink-0 z-10" aria-hidden="true">
            ✨
          </div>
          <button
            type="button"
            className="flex-1 bg-primary/5 rounded-2xl p-3 border border-dashed border-primary/30 cursor-pointer active:scale-[0.98] transition-transform text-left"
            onClick={() => setLocation("/")}
          >
            <p className="font-bold text-sm text-primary">下一站，等你来！</p>
            <p className="text-[11px] text-muted-foreground mt-1">探索更多精彩活动</p>
          </button>
        </motion.div>
      </div>

      <BottomNav />
    </div>
  );
}

