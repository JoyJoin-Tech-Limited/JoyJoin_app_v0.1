import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import InterestSignalBoostSheet from "@/components/InterestSignalBoostSheet";

interface SuccessCelebrationProps {
  onNavigate?: () => void;
  /** Optional: offer the interest signal boost after registration */
  boostInterestKey?: string;
  boostInterestLabel?: string;
  /**
   * The user's onboarding heat value for the boost interest (from user_interests).
   * Heat 5 = casual, 10 = active, 25 = passionate.
   * Passed to InterestSignalBoostSheet so it can show a read-only passion badge,
   * reassuring the user they are not being re-profiled.
   */
  boostInterestHeat?: number;
}

export default function SuccessCelebration({ onNavigate, boostInterestKey, boostInterestLabel, boostInterestHeat }: SuccessCelebrationProps) {
  const [, setLocation] = useLocation();
  const [countdown, setCountdown] = useState(5);
  const [showBoost, setShowBoost] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          if (onNavigate) {
            onNavigate();
          } else {
            setLocation("/events");
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onNavigate, setLocation]);

  const handleNavigate = () => {
    if (onNavigate) {
      onNavigate();
    } else {
      setLocation("/events");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      {/* Checkmark */}
      <motion.div
        initial={prefersReducedMotion ? { scale: 1 } : { scale: 0, rotate: 0 }}
        animate={prefersReducedMotion ? { scale: 1 } : { scale: [0, 1.3, 1], rotate: 360 }}
        transition={{ 
          duration: 0.6, 
          ease: "easeOut",
          times: [0, 0.6, 1]
        }}
        className="relative mb-8"
      >
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-xl">
          <Lock className="w-12 h-12 text-white" strokeWidth={2.5} />
        </div>
        
        {/* Pulsing rings */}
        {!prefersReducedMotion && [0, 1, 2].map((index) => (
          <motion.div
            key={index}
            className="absolute inset-0 rounded-full border-2 border-primary/40"
            initial={{ scale: 1, opacity: 0.5 }}
            animate={{ scale: 2.5, opacity: 0 }}
            transition={{
              duration: 2,
              delay: index * 0.4,
              repeat: Infinity,
              ease: "easeOut"
            }}
          />
        ))}
      </motion.div>

      {/* Success Text — [Bridge] confirms pool registration; sets expectation that 成桌 is a later system step */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-center space-y-2 mb-8"
      >
        <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
          已成功加入活动池
        </h2>
        <p className="text-muted-foreground">
          条件满足后，系统将从活动池中为你匹配成桌
        </p>
      </motion.div>

      {/* Action Button */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="w-full max-w-xs space-y-3"
      >
        {/* Optional interest signal boost CTA */}
        {boostInterestKey && boostInterestLabel && (
          <Button
            variant="outline"
            onClick={() => setShowBoost(true)}
            className="w-full border-primary/40 text-primary hover:bg-primary/5"
            size="lg"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            微调匹配偏好
          </Button>
        )}

        <Button
          onClick={handleNavigate}
          className="w-full bg-gradient-to-r from-primary to-purple-600"
          size="lg"
        >
          查看匹配状态
        </Button>
        
        {/* Countdown dots */}
        <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <span>{countdown}秒后自动跳转</span>
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50"
                animate={{
                  scale: [1, 1.3, 1],
                  opacity: [0.5, 1, 0.5],
                }}
                transition={{
                  duration: 1,
                  delay: i * 0.2,
                  repeat: Infinity,
                }}
              />
            ))}
          </div>
        </div>
      </motion.div>

      {/* Interest Signal Boost Sheet */}
      <InterestSignalBoostSheet
        open={showBoost}
        onOpenChange={setShowBoost}
        interestKey={boostInterestKey}
        interestLabel={boostInterestLabel}
        onboardingHeatLevel={boostInterestHeat}
      />
    </div>
  );
}
