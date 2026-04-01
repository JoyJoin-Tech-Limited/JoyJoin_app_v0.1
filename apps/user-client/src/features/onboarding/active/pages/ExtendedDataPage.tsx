import { useState, useCallback, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { invalidateUserDerivedQueries } from "@/lib/userStateInvalidation";
import { FancyLineLoadingScreen } from "@/components/FancyLineLoadingScreen";
import { InterestCarousel, type InterestCarouselData } from "@/components/interests/InterestCarousel";
import { useOnboardingCheckpoint } from "@/hooks/useOnboardingCheckpoint";
import type { AuthUser } from "@/hooks/useAuth";

// Maximum time to wait for data save before navigating anyway (ms).
const MAX_NAVIGATION_WAIT_MS = 5000;

export default function ExtendedDataPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { saveCheckpoint } = useOnboardingCheckpoint();

  const [showCelebration, setShowCelebration] = useState(false);

  // Flag set by onSuccess; consumed by FancyLineLoadingScreen's onFinish.
  // This ensures navigation only happens AFTER the loading animation completes,
  // so FinalProfileReviewPage mounts cleanly and its SpiralWaveAnimation is visible.
  const readyToNavigateRef = useRef(false);

  // Holds the server-driven next path computed in onSuccess.
  const nextPathRef = useRef<string>('/onboarding/review');

  // Holds the polling interval so it can be cancelled on error or unmount.
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cancel any in-flight polling interval on unmount to prevent stale navigation.
  useEffect(() => {
    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      // Single API call - backend handles both operations in transaction
      return await apiRequest("POST", "/api/user/interests", { interests: data });
    },
    onSuccess: async () => {
      // Data work: invalidate cache, show toast, save checkpoint
      await invalidateUserDerivedQueries();
      await queryClient.refetchQueries({ queryKey: ["/api/auth/user"] });
      
      toast({
        title: "兴趣保存成功！",
        description: "正在生成你的专属画像...",
      });
      
      // Save checkpoint after completing extended data (await to ensure persistence)
      try {
        await saveCheckpoint.mutateAsync('extended-data');
      } catch (error) {
        console.error('[ExtendedDataPage] Failed to save checkpoint:', error);
        // Continue navigation even if checkpoint fails (non-blocking)
      }
      
      // Signal that it's safe to navigate once the animation finishes
      const updatedUser = await queryClient.fetchQuery({ queryKey: ["/api/auth/user"] }) as AuthUser;
      nextPathRef.current =
        updatedUser?.nextStep === 'profile-review' ? '/onboarding/review'
        : updatedUser?.nextStep === 'guide' || updatedUser?.nextStep === 'discover' ? '/'
        : '/onboarding/review'; // safe fallback
      readyToNavigateRef.current = true;
    },
    onError: (error: Error) => {
      // Cancel any pending navigation polling before hiding the overlay.
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setShowCelebration(false);
      readyToNavigateRef.current = false;
      toast({
        title: "保存失败",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleInterestComplete = useCallback((data: InterestCarouselData) => {
    setShowCelebration(true);
    saveMutation.mutate(data); // No delay - start immediately
  }, [saveMutation]);

  const handleBack = useCallback(() => {
    setLocation("/onboarding/setup");
  }, [setLocation]);

  // Called when the ~1s FancyLineLoadingScreen animation finishes.
  // If data is already saved, navigate immediately. If onSuccess hasn't
  // completed yet (slow network), poll until confirmed then navigate.
  // The interval is stored in intervalRef so onError and unmount can cancel it.
  const handleCelebrationFinish = useCallback(() => {
    if (readyToNavigateRef.current) {
      setLocation(nextPathRef.current);
    } else {
      // Data save is still in-flight; poll until confirmed successful (max 5s)
      const start = Date.now();
      intervalRef.current = setInterval(() => {
        if (readyToNavigateRef.current) {
          clearInterval(intervalRef.current!);
          intervalRef.current = null;
          setLocation(nextPathRef.current);
        } else if (Date.now() - start > MAX_NAVIGATION_WAIT_MS) {
          // Timed out without confirmation — stop polling, hide overlay, show error
          clearInterval(intervalRef.current!);
          intervalRef.current = null;
          setShowCelebration(false);
          toast({
            title: "保存超时",
            description: "请检查网络连接后重试",
            variant: "destructive",
          });
        }
      }, 100);
    }
  }, [setLocation, toast]);

  if (showCelebration) {
    return (
      <div className="fixed inset-0 flex items-center justify-center z-[60]">
        {/* loop={false}: plays once (~1s) then calls onFinish → triggers navigation */}
        <FancyLineLoadingScreen
          loop={false}
          onFinish={handleCelebrationFinish}
          visible
        />
      </div>
    );
  }

  return (
    <InterestCarousel
      onComplete={handleInterestComplete}
      onBack={handleBack}
    />
  );
}
