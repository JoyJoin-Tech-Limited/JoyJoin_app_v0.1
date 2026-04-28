/**
 * FinalProfileReviewPage - Magical profile reveal experience
 *
 * Two phases:
 * 1. Analyzing: Spiral wave animation with fade-in text (min wait, skippable)
 * 2. Complete: Profile portrait card with stagger animation
 *
 * The "analyzing" phase plays for at minimum MIN_ANALYZING_MS_DEFAULT (1200ms),
 * or MIN_ANALYZING_MS_REDUCED (500ms) for users who prefer reduced motion.
 * After SKIP_ENABLED_AFTER_MS (600ms), users can tap anywhere to skip straight
 * to the reveal — preventing artificial waiting when data is already ready.
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
import { invalidateUserDerivedQueries } from "@/lib/userStateInvalidation";
import { useToast } from "@/hooks/use-toast";
import { archetypeConfig } from "@/lib/archetypes";
import { getArchetypeAvatar } from "@/lib/archetypeAdapter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { nextStepToRoute } from "@/features/onboarding/active/flow";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import type { AuthUser } from "@/hooks/useAuth";
import { enterLimitedBrowseMode } from "@/components/LimitedBrowseBanner";

/**
 * Experiment: Limited Browse Mode
 * Set to `false` to hide the secondary "browse first" CTA globally.
 * Can also be disabled per-session with ?exp=no_limited_browse in the URL.
 */
const ENABLE_LIMITED_BROWSE_MODE = true;

type Phase = "analyzing" | "complete";

// Minimum analyzing phase duration (ms) before auto-advancing or allowing skip.
// Reduced-motion users get a shorter wait; standard users get 1200ms (was 2500ms).
const MIN_ANALYZING_MS_DEFAULT = 1200;
const MIN_ANALYZING_MS_REDUCED = 500;

// Earliest point at which a tap/click skips the analyzing phase (ms).
// Prevents accidental instant-skip while still respecting intentional taps.
const SKIP_ENABLED_AFTER_MS = 600;

export default function FinalProfileReviewPage() {
  const [, setLocation] = useLocation();
  const analytics = useOnboardingAnalytics('profile-review'); // Phase 2: Analytics
  const { toast } = useToast();
  const prefersReducedMotion = useReducedMotion();

  const minAnalyzingMs = prefersReducedMotion ? MIN_ANALYZING_MS_REDUCED : MIN_ANALYZING_MS_DEFAULT;

  // Resolve whether the limited-browse secondary CTA should be shown.
  // Respects the module constant AND supports opt-in via ?exp=limited_browse.
  const showLimitedBrowseCta: boolean = (() => {
    if (typeof window === "undefined") return false;
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const exp = urlParams.get("exp");

      // Explicit opt-in wins regardless of global flag
      if (exp === "limited_browse") return true;

      // If globally disabled, stay off unless explicitly opted in above
      if (!ENABLE_LIMITED_BROWSE_MODE) return false;

      // Allow explicit opt-out per-session if flag is on globally
      if (exp === "no_limited_browse") return false;

      // Default when flag is enabled and no explicit override is present
      return true;
    } catch {
      // On any parsing error, fall back to the global flag
      return ENABLE_LIMITED_BROWSE_MODE;
    }
  })();

  // Minimum time guard – ensures the reveal animation always plays
  const [minTimePassed, setMinTimePassed] = useState(false);
  // Becomes true after SKIP_ENABLED_AFTER_MS; enables tap-to-skip.
  const [canSkip, setCanSkip] = useState(false);

  useEffect(() => {
    const skipTimer = setTimeout(() => setCanSkip(true), SKIP_ENABLED_AFTER_MS);
    const revealTimer = setTimeout(() => setMinTimePassed(true), minAnalyzingMs);
    return () => {
      clearTimeout(skipTimer);
      clearTimeout(revealTimer);
    };
  }, [minAnalyzingMs]);

  // Allow tapping anywhere in the analyzing phase to skip once canSkip is true.
  const handleSkipAnalyzing = () => {
    if (canSkip) setMinTimePassed(true);
  };

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
      
      // Fetch refreshed auth state to read the server-calculated nextStep.
      // Invalidate first so we always get a fresh response (not a stale cache hit).
      // The default queryFn returns null on 401, so type accordingly and handle that case.
      await invalidateUserDerivedQueries();
      const updatedUser = await queryClient.fetchQuery<AuthUser | null>({ queryKey: ["/api/auth/user"] });
      
      if (!updatedUser?.nextStep) {
        // Session expired or auth state unavailable — redirect to login for safety.
        setLocation('/login');
        return;
      }

      // Navigate based on refreshed server truth.
      setLocation(nextStepToRoute(updatedUser.nextStep));
    } catch (error) {
      console.error("Error completing profile review:", error);
      toast({
        title: "出现错误",
        description: "无法保存进度，请重试",
        variant: "destructive",
      });
    }
  };

  /**
   * Limited browse mode: mark profile review as complete (same server call)
   * but additionally flag the session so DiscoverPage can show the browse banner.
   * Experiment: ENABLE_LIMITED_BROWSE_MODE
   */
  const handleBrowseFirst = async () => {
    analytics.stepCompleted({
      viewedFullProfile: true,
      hasInterests: !!interests,
      hasArchetype: !!user?.archetype,
      entryMode: 'limited_browse',
    });

    try {
      await apiRequest("POST", "/api/profile-review/complete");

      // Enter limited browse mode before navigating so DiscoverPage can detect it.
      enterLimitedBrowseMode();

      await invalidateUserDerivedQueries();
      const updatedUser = await queryClient.fetchQuery<AuthUser | null>({ queryKey: ["/api/auth/user"] });

      if (!updatedUser?.nextStep) {
        setLocation('/login');
        return;
      }

      setLocation(nextStepToRoute(updatedUser.nextStep));
    } catch (error) {
      console.error("Error completing profile review (browse first):", error);
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
            className={`fixed inset-0 flex flex-col items-center justify-center gap-8 select-none ${canSkip ? "cursor-pointer" : ""}`}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
            onClick={canSkip ? handleSkipAnalyzing : undefined}
            role={canSkip ? "button" : undefined}
            tabIndex={canSkip ? 0 : -1}
            aria-label={canSkip ? "分析中，轻触跳过" : "分析中"}
            onKeyDown={(event) => {
              if (!canSkip) return;
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                handleSkipAnalyzing();
              }
            }}
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
              transition={{ delay: 0.5, duration: 0.6 }}
            >
              分析性格特质 • 兴趣偏好 • 社交风格
            </motion.p>

            {/* Tap-to-skip hint — appears once skip is enabled */}
            {canSkip && !prefersReducedMotion && (
              <motion.p
                className="text-xs text-muted-foreground/50 text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4 }}
              >
                轻触屏幕跳过
              </motion.p>
            )}
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
                        alt={archetypeNickname || "头像"}
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

              {/* Limited browse secondary CTA — experiment: ENABLE_LIMITED_BROWSE_MODE */}
              {showLimitedBrowseCta && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.2, duration: 0.4 }}
                >
                  <button
                    type="button"
                    className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-2 underline-offset-2 hover:underline"
                    onClick={handleBrowseFirst}
                    data-testid="browse-first-cta"
                  >
                    先浏览一下，随时可以报名 →
                  </button>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
