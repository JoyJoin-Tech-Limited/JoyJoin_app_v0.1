/**
 * FinalProfileReviewPage - Magical profile reveal experience
 * 
 * Two phases:
 * 1. Analyzing (0-3s): Spiral wave animation with fade-in text
 * 2. Complete (3s+): Profile portrait card with stagger animation
 * 
 * Phase 0: Fix #5 - Loading states for all data dependencies
 */

import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { SpiralWaveAnimation } from "@/components/SpiralWaveAnimation";
import { ProfilePortraitCard } from "@/components/ProfilePortraitCard";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { useOnboardingAnalytics } from "@/hooks/useOnboardingAnalytics"; // Phase 2

type Phase = "analyzing" | "complete";

export default function FinalProfileReviewPage() {
  const [phase, setPhase] = useState<Phase>("analyzing");
  const [, setLocation] = useLocation();
  const prefersReducedMotion = useReducedMotion();
  const analytics = useOnboardingAnalytics('profile-review'); // Phase 2: Analytics

  // Phase 0: Fix #5 - Wait for all data to load before showing complete phase
  const { data: user } = useQuery<any>({ 
    queryKey: ["/api/auth/user"],
  });
  
  const { data: interests, isLoading: interestsLoading } = useQuery<any>({ 
    queryKey: ["/api/user/interests"],
    enabled: !!user?.hasCompletedInterestsCarousel,
  });

  useEffect(() => {
    const duration = prefersReducedMotion ? 1000 : 3000;
    const timer = setTimeout(() => {
      // Only transition to complete if data is ready
      if (!interestsLoading && interests && user) {
        setPhase("complete");
      }
    }, duration);
    return () => clearTimeout(timer);
  }, [prefersReducedMotion, interestsLoading, interests, user]);

  const handleContinue = () => {
    // Phase 2: Track completion
    analytics.stepCompleted({
      viewedFullProfile: true,
      hasInterests: !!interests,
      hasArchetype: !!user?.archetype,
    });
    
    // Phase 0: Fix #8 - Mark profile review as seen
    localStorage.setItem('profile_review_seen', 'true');
    
    // Fix: Use correct onboarding flow routing
    // After profile review, check server-driven nextStep or default to guide
    const nextStep = user?.nextStep;
    let nextPath: string;
    
    switch (nextStep) {
      case "guide":
        nextPath = "/guide";
        break;
      case "discover":
        nextPath = "/discover";
        break;
      default:
        // Fallback: send users to the guide if nextStep is missing or unexpected
        nextPath = "/guide";
        break;
    }
    
    setLocation(nextPath);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 via-pink-50 to-white">
      <AnimatePresence mode="wait">
        {phase === "analyzing" ? (
          <motion.div
            key="analyzing"
            className="fixed inset-0 flex flex-col items-center justify-center gap-8"
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
          >
            <SpiralWaveAnimation />
            
            <motion.div
              className="text-center space-y-3 px-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.6 }}
            >
              <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                AI 正在生成你的用户画像
              </h2>
            </motion.div>

            <motion.p
              className="text-sm text-muted-foreground"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1, duration: 0.6 }}
            >
              分析性格特质 • 兴趣偏好 • 社交风格
            </motion.p>
          </motion.div>
        ) : (
          <motion.div
            key="complete"
            className="min-h-screen py-8 pb-24"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ 
              duration: 0.6, 
              ease: [0.34, 1.56, 0.64, 1] // Spring easing
            }}
          >
            <ProfilePortraitCard />
            
            {/* Fixed bottom CTA */}
            <motion.div
              className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-white via-white to-transparent pb-[calc(1rem+env(safe-area-inset-bottom))] pt-6 px-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.4 }}
            >
              <Button
                size="lg"
                className="w-full max-w-md mx-auto h-14 text-lg rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 flex"
                onClick={handleContinue}
              >
                继续
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
