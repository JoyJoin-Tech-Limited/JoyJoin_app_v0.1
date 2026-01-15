import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { LoadingLogoSleek } from "@/components/LoadingLogoSleek";
import { InterestCarousel, type InterestCarouselData } from "@/components/interests/InterestCarousel";

type WizardStep = 1 | 2;

export default function ExtendedDataPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const prefersReducedMotion = useReducedMotion();

  const [wizardStep, setWizardStep] = useState<WizardStep>(1);
  const [interestData, setInterestData] = useState<InterestCarouselData | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      // First save interests to the new endpoint
      await apiRequest("POST", "/api/user/interests", { interests: data });
      
      // Then update profile to mark completion
      return await apiRequest("PATCH", "/api/profile", {
        hasCompletedInterestsCarousel: true,
      });
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
    setInterestData(data);
    setShowCelebration(true);
    
    // For now, go directly to save since Step 2 (social preferences) 
    // would be optional or collected elsewhere
    setTimeout(() => {
      saveMutation.mutate(data);
    }, 1500);
  }, [saveMutation]);

  const handleBack = useCallback(() => {
    if (wizardStep === 2) {
      setWizardStep(1);
    } else {
      setLocation("/onboarding/setup");
    }
  }, [wizardStep, setLocation]);

  const containerVariants = prefersReducedMotion 
    ? { hidden: { opacity: 0 }, visible: { opacity: 1 }, exit: { opacity: 0 } }
    : { 
        hidden: { opacity: 0, x: 50 }, 
        visible: { opacity: 1, x: 0, transition: { duration: 0.3 } },
        exit: { opacity: 0, x: -50, transition: { duration: 0.2 } }
      };

  if (showCelebration) {
    return (
      <div className="fixed inset-0 flex items-center justify-center z-50">
        <LoadingLogoSleek loop visible />
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      {wizardStep === 1 && (
        <motion.div
          key="step1"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          <InterestCarousel
            onComplete={handleInterestComplete}
            onBack={handleBack}
          />
        </motion.div>
      )}

      {wizardStep === 2 && (
        <motion.div
          key="step2"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="min-h-screen bg-background flex flex-col"
        >
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b px-4 py-3">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={handleBack}>
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <h1 className="text-lg font-medium">社交偏好</h1>
            </div>
          </div>

          <div className="flex-1 px-4 py-6">
            <div className="max-w-md mx-auto">
              <p className="text-center text-muted-foreground">
                社交偏好设置（可选）
              </p>
              {/* This step can be expanded later with social preference fields */}
            </div>
          </div>

          <div className="shrink-0 border-t p-4 bg-background">
            <Button
              onClick={() => {
                if (interestData) {
                  setShowCelebration(true);
                  setTimeout(() => {
                    saveMutation.mutate(interestData);
                  }, 1500);
                }
              }}
              className="w-full"
              disabled={saveMutation.isPending}
              size="lg"
            >
              {saveMutation.isPending ? "保存中..." : "完成"}
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
