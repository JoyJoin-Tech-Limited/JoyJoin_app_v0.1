import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { LoadingLogoSleek } from "@/components/LoadingLogoSleek";
import { InterestCarousel, type InterestCarouselData } from "@/components/interests/InterestCarousel";

export default function ExtendedDataPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [showCelebration, setShowCelebration] = useState(false);

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      // Single API call - backend handles both operations in transaction
      return await apiRequest("POST", "/api/user/interests", { interests: data });
    },
    onSuccess: async () => {
      setShowCelebration(false);
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      await queryClient.refetchQueries({ queryKey: ["/api/auth/user"] });
      
      // Redirect to profile review
      setLocation("/onboarding/review");
      
      toast({
        title: "兴趣保存成功！",
        description: "正在生成你的专属画像...",
      });
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
    
    setTimeout(() => {
      saveMutation.mutate(data);
    }, 1500);
  }, [saveMutation]);

  const handleBack = useCallback(() => {
    setLocation("/onboarding/setup");
  }, [setLocation]);

  if (showCelebration) {
    return (
      <div className="fixed inset-0 flex items-center justify-center z-50">
        <LoadingLogoSleek loop visible />
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
