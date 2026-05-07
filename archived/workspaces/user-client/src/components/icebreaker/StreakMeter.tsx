import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { 
  Flame, 
  Trophy, 
  Star, 
  Zap, 
  Gift, 
  Sparkles,
  Users,
  TrendingUp,
} from 'lucide-react';

interface Milestone {
  id: string;
  threshold: number;
  title: string;
  description: string;
  icon: typeof Trophy;
  reward?: string;
  unlocked: boolean;
}

interface StreakMeterProps {
  currentStreak?: number;
  maxStreak?: number;
  participantCount?: number;
  activitiesCompleted?: number;
  onMilestoneUnlock?: (milestone: Milestone) => void;
}

const defaultMilestones: Omit<Milestone, 'unlocked'>[] = [
  { id: 'starter', threshold: 1, title: '破冰启动', description: '完成第一个活动', icon: Star, reward: '初次破冰徽章' },
  { id: 'warming', threshold: 3, title: '逐渐升温', description: '连续完成3个活动', icon: Flame, reward: '热身达人徽章' },
  { id: 'fire', threshold: 5, title: '火力全开', description: '连续完成5个活动', icon: Zap, reward: '超级活跃徽章' },
  { id: 'champion', threshold: 8, title: '团魂爆发', description: '连续完成8个活动', icon: Trophy, reward: '破冰冠军徽章' },
  { id: 'legend', threshold: 10, title: '传奇小队', description: '连续完成10个活动', icon: Sparkles, reward: '传奇团队徽章' },
];

export function StreakMeter({
  currentStreak = 0,
  maxStreak = 10,
  participantCount = 5,
  activitiesCompleted = 0,
  onMilestoneUnlock,
}: StreakMeterProps) {
  const [displayStreak, setDisplayStreak] = useState(currentStreak);
  const [showCelebration, setShowCelebration] = useState(false);
  const [lastUnlockedMilestone, setLastUnlockedMilestone] = useState<Milestone | null>(null);

  const milestones = useMemo(() =>
    defaultMilestones.map(m => ({
      ...m,
      unlocked: currentStreak >= m.threshold,
    })),
    [currentStreak]
  );

  const nextMilestone = useMemo(() =>
    milestones.find(m => !m.unlocked),
    [milestones]
  );

  const progressToNext = useMemo(() => {
    if (!nextMilestone) return 100;
    const prevThreshold = milestones.filter(m => m.unlocked).pop()?.threshold || 0;
    const range = nextMilestone.threshold - prevThreshold;
    const progress = currentStreak - prevThreshold;
    return Math.min(100, (progress / range) * 100);
  }, [currentStreak, nextMilestone, milestones]);

  useEffect(() => {
    if (currentStreak > displayStreak) {
      const timer = setTimeout(() => {
        setDisplayStreak(prev => Math.min(prev + 1, currentStreak));
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [currentStreak, displayStreak]);

  useEffect(() => {
    const newlyUnlocked = milestones.find(
      m => m.unlocked && m.threshold === currentStreak
    );
    if (newlyUnlocked && newlyUnlocked !== lastUnlockedMilestone) {
      setLastUnlockedMilestone(newlyUnlocked);
      setShowCelebration(true);
      onMilestoneUnlock?.(newlyUnlocked);
      setTimeout(() => setShowCelebration(false), 3000);
    }
  }, [currentStreak, milestones, lastUnlockedMilestone, onMilestoneUnlock]);

  const streakLevel = useMemo(() => {
    if (currentStreak >= 8) return { label: '火热', color: 'text-red-500', bg: 'bg-red-500/10' };
    if (currentStreak >= 5) return { label: '活跃', color: 'text-orange-500', bg: 'bg-orange-500/10' };
    if (currentStreak >= 3) return { label: '升温', color: 'text-amber-500', bg: 'bg-amber-500/10' };
    if (currentStreak >= 1) return { label: '启动', color: 'text-green-500', bg: 'bg-green-500/10' };
    return { label: '待启动', color: 'text-muted-foreground', bg: 'bg-muted' };
  }, [currentStreak]);

  return (
    <div className="space-y-4" data-testid="streak-meter">
      <Card className="overflow-hidden">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${streakLevel.bg}`}>
                <Flame className={`w-5 h-5 ${streakLevel.color}`} />
              </div>
              <div>
                <p className="font-semibold">团队活跃度</p>
                <p className="text-xs text-muted-foreground">{streakLevel.label}</p>
              </div>
            </div>
            <div className="text-right">
              <motion.p 
                key={displayStreak}
                initial={{ scale: 1.2 }}
                animate={{ scale: 1 }}
                className="text-3xl font-bold text-primary"
              >
                {displayStreak}
              </motion.p>
              <p className="text-xs text-muted-foreground">连续活动</p>
            </div>
          </div>

          {nextMilestone && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  下一个成就: {nextMilestone.title}
                </span>
                <span className="font-medium">
                  {currentStreak}/{nextMilestone.threshold}
                </span>
              </div>
              <Progress value={progressToNext} className="h-2" />
            </div>
          )}

          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">{participantCount}人参与</span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">已完成 {activitiesCompleted} 项</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <p className="text-sm font-medium flex items-center gap-2">
          <Gift className="w-4 h-4 text-primary" />
          成就进度
        </p>
        <div className="grid grid-cols-5 gap-2">
          {milestones.map((milestone) => {
            const Icon = milestone.icon;
            return (
              <motion.div
                key={milestone.id}
                whileHover={{ scale: 1.05 }}
                className={`relative p-2 rounded-lg text-center transition-all ${
                  milestone.unlocked
                    ? 'bg-primary/10 border border-primary/30'
                    : 'bg-muted/50 border border-transparent opacity-60'
                }`}
                data-testid={`milestone-${milestone.id}`}
              >
                <div className={`w-8 h-8 mx-auto rounded-full flex items-center justify-center mb-1 ${
                  milestone.unlocked ? 'bg-primary text-primary-foreground' : 'bg-muted'
                }`}>
                  <Icon className="w-4 h-4" />
                </div>
                <p className="text-[10px] font-medium truncate">{milestone.title}</p>
                <p className="text-[9px] text-muted-foreground">{milestone.threshold}次</p>
                
                {milestone.unlocked && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-green-500 flex items-center justify-center"
                  >
                    <Star className="w-2.5 h-2.5 text-white" />
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {showCelebration && lastUnlockedMilestone && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -20 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={() => setShowCelebration(false)}
          >
            <Card className="max-w-sm mx-4 border-2 border-primary">
              <CardContent className="p-6 text-center space-y-4">
                <motion.div
                  initial={{ rotate: -180, scale: 0 }}
                  animate={{ rotate: 0, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200 }}
                  className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 to-orange-500"
                >
                  <lastUnlockedMilestone.icon className="w-10 h-10 text-white" />
                </motion.div>
                
                <div>
                  <h3 className="text-xl font-bold">
                    {lastUnlockedMilestone.title}
                  </h3>
                  <p className="text-muted-foreground">
                    {lastUnlockedMilestone.description}
                  </p>
                </div>

                {lastUnlockedMilestone.reward && (
                  <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white">
                    <Gift className="w-3 h-3 mr-1" />
                    {lastUnlockedMilestone.reward}
                  </Badge>
                )}

                <p className="text-xs text-muted-foreground">
                  点击任意处关闭
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default StreakMeter;
