import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Coins, TrendingUp, Flame, Snowflake } from "lucide-react";

interface XPGainToastProps {
  show: boolean;
  xpGained: number;
  coinsGained: number;
  action?: string;
  streakInfo?: {
    newStreak: number;
    usedFreezeCard: boolean;
    streakBroken: boolean;
    previousStreak: number;
    streakBonus?: { xp: number; coins: number };
  };
  onComplete?: () => void;
}

export default function XPGainToast({
  show,
  xpGained,
  coinsGained,
  action,
  streakInfo,
  onComplete,
}: XPGainToastProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ type: "spring", damping: 20, stiffness: 300 }}
          onAnimationComplete={() => {
            setTimeout(() => onComplete?.(), 2500);
          }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50"
          data-testid="xp-gain-toast"
        >
          <div className="bg-gradient-to-r from-purple-600 to-pink-500 rounded-2xl p-[2px] shadow-lg">
            <div className="bg-background rounded-[14px] px-4 py-3">
              <div className="flex items-center gap-3">
                <motion.div
                  initial={{ rotate: -15, scale: 0 }}
                  animate={{ rotate: 0, scale: 1 }}
                  transition={{ delay: 0.1, type: "spring" }}
                  className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center"
                >
                  <Sparkles className="w-5 h-5 text-white" />
                </motion.div>
                
                <div className="space-y-1">
                  {action && (
                    <div className="text-xs text-muted-foreground">{action}</div>
                  )}
                  <div className="flex items-center gap-3">
                    {xpGained > 0 && (
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 }}
                        className="flex items-center gap-1"
                      >
                        <TrendingUp className="w-4 h-4 text-green-500" />
                        <span className="text-sm font-bold text-green-600">+{xpGained} XP</span>
                      </motion.div>
                    )}
                    {coinsGained > 0 && (
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 }}
                        className="flex items-center gap-1"
                      >
                        <Coins className="w-4 h-4 text-yellow-500" />
                        <span className="text-sm font-bold text-yellow-600">+{coinsGained}</span>
                      </motion.div>
                    )}
                  </div>
                </div>
              </div>
              
              {streakInfo && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  transition={{ delay: 0.4 }}
                  className="mt-2 pt-2 border-t border-border"
                >
                  {streakInfo.streakBroken ? (
                    <div className="flex items-center gap-2 text-sm text-red-500">
                      <span>连击中断</span>
                      <span className="text-muted-foreground">
                        ({streakInfo.previousStreak}周 → 重新开始)
                      </span>
                    </div>
                  ) : streakInfo.usedFreezeCard ? (
                    <div className="flex items-center gap-2 text-sm text-blue-500">
                      <Snowflake className="w-4 h-4" />
                      <span>已使用冻结卡保护连击</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm">
                      <Flame className="w-4 h-4 text-orange-500" />
                      <span className="text-orange-600 font-medium">
                        连击 {streakInfo.newStreak} 周
                      </span>
                      {streakInfo.streakBonus && (
                        <span className="text-green-600">
                          (+{streakInfo.streakBonus.xp} XP, +{streakInfo.streakBonus.coins} 悦币)
                        </span>
                      )}
                    </div>
                  )}
                </motion.div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
