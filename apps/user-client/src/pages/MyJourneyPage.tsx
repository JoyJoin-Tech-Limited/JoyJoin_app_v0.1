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
import type { Event } from "@shared/schema";

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

  const archetypeAvatar = user?.archetype
    ? getArchetypeAvatar(user.archetype)
    : null;

  const archetypeBg = user?.archetype
    ? archetypeBgColors[user.archetype] || "bg-primary/10"
    : "bg-primary/10";

  const formatDate = (dateTime: Date | null | string) => {
    if (!dateTime) return "";
    const date = new Date(dateTime);
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  };

  // ── Loading state ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-violet-50 to-background pb-24 flex flex-col">
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

  const now = new Date();
  const pastEvents = (events ?? []).filter((event) => {
    if (!event.dateTime) return false;
    const eventDate = new Date(event.dateTime as unknown as string);
    return eventDate < now;
  });
  const hasEvents = pastEvents.length > 0;

  // ── Empty state ────────────────────────────────────────────────────────────
  if (!hasEvents) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-violet-50 to-background pb-24 flex flex-col">
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
    <div className="min-h-screen bg-gradient-to-b from-violet-50 to-background pb-24">
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
      <div className="mx-4 mb-5 p-3 bg-white rounded-2xl shadow-sm flex gap-4">
        <div className="text-center flex-1" aria-label={`已参加 ${pastEvents.length} 个活动`}>
          <div className="text-2xl font-black text-primary">{pastEvents.length}</div>
          <div className="text-[10px] text-muted-foreground">已参加</div>
        </div>
        <div className="w-px bg-muted" />
        <div className="text-center flex-1" aria-label="活跃状态">
          <div className="text-2xl font-black text-amber-500" aria-hidden="true">🔥</div>
          <div className="text-[10px] text-muted-foreground">活跃</div>
        </div>
      </div>

      {/* Vertical timeline */}
      <div className="px-4 relative">
        {/* Vertical connecting line */}
        <div className="absolute left-10 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary/60 to-primary/10 pointer-events-none" />

        {pastEvents.map((event, index) => (
          <motion.div
            key={event.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="flex gap-4 mb-5 relative"
          >
            {/* Node circle */}
            <div className="h-12 w-12 rounded-full bg-primary flex items-center justify-center text-white text-xl flex-shrink-0 z-10 shadow-lg" aria-hidden="true">
              🎉
            </div>

            {/* Event card */}
            <div className="flex-1 bg-white rounded-2xl p-3 shadow-sm border border-primary/10">
              <h3 className="font-bold text-sm">{event.title}</h3>
              <div className="flex gap-3 mt-1 text-[11px] text-muted-foreground flex-wrap">
                <span>📅 {formatDate(event.dateTime)}</span>
                {event.location && <span>📍 {event.location}</span>}
              </div>
            </div>
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

