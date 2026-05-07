import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Trophy, Sparkles, Star,
  Sprout, Compass, Link, Handshake, PartyPopper, Crown, Gem
} from "lucide-react";
import { Button } from "@/components/ui/button";
import ConfettiCelebration from "./ConfettiCelebration";

const LEVEL_ICONS: Record<string, React.ReactNode> = {
  sprout: <Sprout className="h-12 w-12 text-white" />,
  compass: <Compass className="h-12 w-12 text-white" />,
  link: <Link className="h-12 w-12 text-white" />,
  star: <Star className="h-12 w-12 text-white" />,
  trophy: <Trophy className="h-12 w-12 text-white" />,
  handshake: <Handshake className="h-12 w-12 text-white" />,
  "party-popper": <PartyPopper className="h-12 w-12 text-white" />,
  crown: <Crown className="h-12 w-12 text-white" />,
  sparkles: <Sparkles className="h-12 w-12 text-white" />,
  gem: <Gem className="h-12 w-12 text-white" />,
};

interface LevelConfig {
  level: number;
  name: string;
  nameCn: string;
  icon: string;
  benefits: string[];
  benefitsCn: string[];
}

interface LevelUpCelebrationProps {
  show: boolean;
  previousLevel: number;
  newLevel: number;
  levelConfig: LevelConfig;
  onClose: () => void;
}

export default function LevelUpCelebration({
  show,
  previousLevel,
  newLevel,
  levelConfig,
  onClose,
}: LevelUpCelebrationProps) {
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (show) {
      setShowConfetti(true);
      const timer = setTimeout(() => setShowConfetti(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [show]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={onClose}
          data-testid="level-up-celebration"
        >
          {showConfetti && <ConfettiCelebration isActive={showConfetti} />}
          
          <motion.div
            initial={{ scale: 0.5, opacity: 0, y: 50 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: -50 }}
            transition={{ type: "spring", damping: 15 }}
            className="bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 rounded-3xl p-1 mx-4 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-background rounded-[22px] p-6 text-center space-y-4">
              <motion.div
                initial={{ rotate: -10, scale: 0 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ delay: 0.2, type: "spring" }}
                className="relative mx-auto w-24 h-24"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full animate-pulse opacity-30" />
                <div className="relative w-full h-full bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                  {LEVEL_ICONS[levelConfig.icon] || <Star className="h-12 w-12 text-white" />}
                </div>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: [0, 1.2, 1] }}
                  transition={{ delay: 0.4, duration: 0.5 }}
                  className="absolute -top-2 -right-2 bg-yellow-400 rounded-full p-2"
                >
                  <Star className="w-4 h-4 text-white fill-white" />
                </motion.div>
              </motion.div>

              <div className="space-y-1">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="flex items-center justify-center gap-2 text-sm text-muted-foreground"
                >
                  <Sparkles className="w-4 h-4 text-yellow-500" />
                  恭喜升级
                  <Sparkles className="w-4 h-4 text-yellow-500" />
                </motion.div>
                
                <motion.h2
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4, type: "spring" }}
                  className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-500 bg-clip-text text-transparent"
                  data-testid="text-new-level"
                >
                  Lv.{newLevel} {levelConfig.nameCn}
                </motion.h2>
                
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="text-sm text-muted-foreground"
                >
                  从 Lv.{previousLevel} 成功晋升
                </motion.p>
              </div>

              {levelConfig.benefitsCn.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  className="bg-muted/50 rounded-xl p-4 space-y-2"
                >
                  <div className="flex items-center justify-center gap-2 text-sm font-medium">
                    <Trophy className="w-4 h-4 text-yellow-500" />
                    解锁新权益
                  </div>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {levelConfig.benefitsCn.map((benefit, idx) => (
                      <motion.li
                        key={idx}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.7 + idx * 0.1 }}
                        className="flex items-center gap-2"
                      >
                        <Star className="w-3 h-3 text-purple-500 fill-purple-500" />
                        {benefit}
                      </motion.li>
                    ))}
                  </ul>
                </motion.div>
              )}

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
              >
                <Button 
                  onClick={onClose}
                  className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                  data-testid="button-close-celebration"
                >
                  太棒了！继续探索
                </Button>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
