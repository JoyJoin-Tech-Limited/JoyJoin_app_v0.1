/**
 * FinalProfileReviewPage - Magical profile reveal experience
 *
 * Two phases:
 * 1. Analyzing: Spiral wave animation with fade-in text (min 2.5s guaranteed)
 * 2. Complete: Profile portrait card with stagger animation
 *
 * Fix (2026-02-24): Added minTimePassed guard to prevent instant phase
 * transition when React Query cache is warm. The "analyzing" reveal must
 * always play for at least 2500ms regardless of data load speed.
 */

import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { SpiralWaveAnimation } from "@/components/SpiralWaveAnimation";
import { ProfilePortraitCard } from "@/components/ProfilePortraitCard";
import { useOnboardingAnalytics } from "@/hooks/useOnboardingAnalytics"; // Phase 2
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { archetypeConfig } from "@/lib/archetypes";
import { getArchetypeAvatar } from "@/lib/archetypeAdapter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { AuthUser } from "@/hooks/useAuth";

type Phase = "analyzing" | "complete";

// Minimum duration the "analyzing" phase must be shown (ms).
// Prevents instant skip when React Query cache is already warm.
const MIN_ANALYZING_MS = 2500;

export default function FinalProfileReviewPage() {
  const [, setLocation] = useLocation();
  const analytics = useOnboardingAnalytics('profile-review'); // Phase 2: Analytics
  const { toast } = useToast();

  // Minimum time guard – ensures the reveal animation always plays
  const [minTimePassed, setMinTimePassed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMinTimePassed(true), MIN_ANALYZING_MS);
    return () => clearTimeout(timer);
  }, []);

  // Data dependencies
  const { data: user } = useQuery<any>({ 
    queryKey: ["/api/auth/user"],
  });
  
  // Use a custom queryFn that treats 404 as null so the page doesn't get stuck
  // in "analyzing" forever when the server returns 404 (no interests yet).
  // Matches the pattern used in GuideStepPersona.
  const { data: interests, isLoading: interestsLoading } = useQuery<any>({ 
    queryKey: ["/api/user/interests"],
    enabled: !!user?.hasCompletedInterestsCarousel,
    queryFn: async () => {
      const res = await fetch("/api/user/interests", { credentials: "include" });
      if (res.status === 404) return null; // No interests data yet — treat as settled
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      return res.json();
    },
  });

  // Only transition when BOTH min time has passed AND queries are settled.
  // `interests` may be null (404) — that's fine, profile card handles missing data.
  const phase: Phase =
    minTimePassed && user && !interestsLoading
      ? "complete"
      : "analyzing";

  const handleContinue = async () => {
    // Phase 2: Track completion
    analytics.stepCompleted({
      viewedFullProfile: true,
      hasInterests: !!interests,
      hasArchetype: !!user?.archetype,
    });
    
    try {
      // Mark profile review as seen on server
      await apiRequest("POST", "/api/profile-review/complete");
      
      // Invalidate auth user query to get updated nextStep
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      
      // Fetch the refreshed user state so we can navigate via server-computed nextStep.
      const updatedUser = await queryClient.fetchQuery<AuthUser | null>({ queryKey: ["/api/auth/user"] });
      
      // Resolve destination from server nextStep.
      // 'guide' is deprecated — the server still emits it for legacy users, but
      // the client treats it identically to 'discover'.
      const nextStep = updatedUser?.nextStep;
      const NEXT_STEP_TO_PATH: Record<string, string> = {
        'discover':      '/discover',
        'guide':         '/discover',       // deprecated step — maps to discover
        'profile-review':'/onboarding/review',
        'extended-data': '/onboarding/extended',
        'essential-data':'/onboarding/setup',
        'personality-test':'/personality-test',
      };
      const destination = (nextStep && NEXT_STEP_TO_PATH[nextStep]) ?? '/discover';
      
      setLocation(destination);
    } catch (error) {
      console.error("Error completing profile review:", error);
      toast({
        title: "出现错误",
        description: "无法保存进度，请重试",
        variant: "destructive",
      });
    }
  };

  // Derive archetype nickname for the personalized CTA
  const archetypeName: string | undefined = user?.archetype || user?.primaryArchetype;
  const archetypeNickname: string = archetypeName
    ? (archetypeConfig[archetypeName]?.nickname || archetypeName)
    : "你";
  const archetypeAvatarUrl: string = archetypeName ? getArchetypeAvatar(archetypeName) : "";
  const archetypeIcon: string = archetypeName ? (archetypeConfig[archetypeName]?.icon || "✨") : "✨";

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
                小悦正在分析你的社交DNA……
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

            {/* Subtle hint message to fill the 2.5s wait */}
            <motion.p
              className="text-xs text-muted-foreground/60 text-center px-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.6, duration: 0.5 }}
            >
              综合你的测评答案和兴趣选择，正在计算最适合你的社交场景...
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

            {/* Post-reveal archetype CTA — staggered 3-beat entrance */}
            <div className="px-6 pb-[calc(2rem+env(safe-area-inset-bottom))] mt-6 text-center space-y-3">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="flex justify-center"
              >
                <div className="rounded-full bg-gradient-to-br from-purple-100 to-pink-100 p-1">
                  <Avatar className="w-16 h-16 bg-transparent">
                    {archetypeAvatarUrl ? (
                      <AvatarImage
                        src={archetypeAvatarUrl}
                        alt={archetypeName || "头像"}
                        className="object-contain p-1"
                      />
                    ) : (
                      <AvatarFallback className="text-3xl bg-gradient-to-br from-purple-100 to-pink-100">
                        {archetypeIcon}
                      </AvatarFallback>
                    )}
                  </Avatar>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6, duration: 0.5 }}
                className="space-y-1"
              >
                <p className="text-sm text-muted-foreground">
                  有人正在等一个像你这样的
                </p>
                <p className="text-lg font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                  「{archetypeNickname}」
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9, duration: 0.4 }}
              >
                <Button
                  size="lg"
                  className="w-full max-w-md mx-auto h-14 text-lg rounded-2xl bg-gradient-to-r from-[#FF6B9D] to-[#A86BFF] hover:from-[#e55f8e] hover:to-[#9257e6]"
                  onClick={handleContinue}
                >
                  去看看谁在等我 →
                </Button>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
