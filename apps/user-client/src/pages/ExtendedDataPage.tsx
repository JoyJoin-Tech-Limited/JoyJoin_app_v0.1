import { useState, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { FancyLineLoadingScreen } from "@/components/FancyLineLoadingScreen";
import { InterestCarousel, type InterestCarouselData } from "@/components/interests/InterestCarousel";
import { useOnboardingCheckpoint } from "@/hooks/useOnboardingCheckpoint";

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

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      // Single API call - backend handles both operations in transaction
      return await apiRequest("POST", "/api/user/interests", { interests: data });
    },
    onSuccess: async () => {
      // Data work: invalidate cache, show toast, save checkpoint
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
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
      readyToNavigateRef.current = true;
    },
    onError: (error: Error) => {
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
  // completed yet (slow network), poll briefly then navigate.
  const handleCelebrationFinish = useCallback(() => {
    if (readyToNavigateRef.current) {
      setLocation("/onboarding/review");
    } else {
      // Data save is still in-flight; poll until ready (max 5s)
      const start = Date.now();
      const interval = setInterval(() => {
        if (readyToNavigateRef.current || Date.now() - start > MAX_NAVIGATION_WAIT_MS) {
          clearInterval(interval);
          setLocation("/onboarding/review");
        }
      }, 100);
    }
  }, [setLocation]);

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
