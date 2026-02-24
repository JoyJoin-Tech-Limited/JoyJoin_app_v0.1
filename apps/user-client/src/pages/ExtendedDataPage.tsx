import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { FancyLineLoadingScreen } from "@/components/FancyLineLoadingScreen";
import { InterestCarousel, type InterestCarouselData } from "@/components/interests/InterestCarousel";
import { useOnboardingCheckpoint } from "@/hooks/useOnboardingCheckpoint";

export default function ExtendedDataPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { saveCheckpoint } = useOnboardingCheckpoint();

  const [showCelebration, setShowCelebration] = useState(false);

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      // Single API call - backend handles both operations in transaction
      return await apiRequest("POST", "/api/user/interests", { interests: data });
    },
    onSuccess: async () => {
      // Keep showing celebration during navigation to prevent flash
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      await queryClient.refetchQueries({ queryKey: ["/api/auth/user"] });
      
      toast({
        title: "兴趣保存成功！",
        description: "正在生成你的专属画像...",
      });
      
      // Wait a bit more before navigation to ensure smooth transition
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Save checkpoint after completing extended data (await to ensure persistence)
      try {
        await saveCheckpoint.mutateAsync('extended-data');
      } catch (error) {
        console.error('[ExtendedDataPage] Failed to save checkpoint:', error);
        // Continue navigation even if checkpoint fails (non-blocking)
      }
      
      // Phase 0: Fix #8 - Mark that user needs to see profile review
      // This flag is used by useOnboardingRoute to navigate to /onboarding/review
      // (Will be set to 'true' after user views the review page)
      
      // Navigate while still showing loading
      setLocation("/onboarding/review");
      // Don't set showCelebration to false - let the new page handle the transition
    },
    onError: (error: Error) => {
      setShowCelebration(false);
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

  if (showCelebration) {
    return (
      <div className="fixed inset-0 flex items-center justify-center z-50">
        <FancyLineLoadingScreen loop visible />
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
