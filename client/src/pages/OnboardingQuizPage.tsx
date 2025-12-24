import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";
import VoiceQuiz from "@/components/VoiceQuiz";
import QuizIntro from "@/components/QuizIntro";
import PersonalityProfile from "@/components/PersonalityProfile";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function OnboardingQuizPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [stage, setStage] = useState<"intro" | "quiz" | "results">("intro");
  const [coachGender, setCoachGender] = useState<"female" | "male">("female");
  const [results, setResults] = useState<any>(null);

  const savePersonalityMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/profile/personality", {
        personalityTraits: data.traits,
        personalityChallenges: data.challenges,
        idealMatch: data.idealMatch,
        energyLevel: data.energyLevel || 75,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "测评完成",
        description: "你的性格特质已保存",
      });
      setLocation("/");
    },
    onError: (error) => {
      toast({
        title: "保存失败",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const skipOnboardingMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/profile/personality", {
        personalityTraits: [],
        personalityChallenges: [],
        idealMatch: "",
        energyLevel: 75,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setLocation("/");
    },
    onError: (error) => {
      toast({
        title: "跳过失败",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleStartQuiz = (gender: "female" | "male") => {
    setCoachGender(gender);
    setStage("quiz");
  };

  const handleQuizComplete = (quizResults: any) => {
    setResults(quizResults);
    setStage("results");
  };

  const handleFinish = () => {
    if (results) {
      savePersonalityMutation.mutate(results);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b">
        <div className="flex items-center h-14 px-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => stage === "results" ? handleFinish() : skipOnboardingMutation.mutate()}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="ml-2 font-semibold">
            {stage === "intro" && "性格测评"}
            {stage === "quiz" && "语音问答"}
            {stage === "results" && "测评结果"}
          </h1>
        </div>
      </div>

      <div className="px-4 py-6">
        {stage === "intro" && (
          <QuizIntro 
            onStart={handleStartQuiz}
            onSkip={() => skipOnboardingMutation.mutate()}
          />
        )}

        {stage === "quiz" && (
          <VoiceQuiz 
            onComplete={handleQuizComplete}
            onSkip={() => skipOnboardingMutation.mutate()}
            coachGender={coachGender}
          />
        )}

        {stage === "results" && results && (
          <div className="space-y-4">
            <div className="text-center space-y-2 pb-4">
              <h2 className="text-2xl font-display font-bold">测评完成！</h2>
              <p className="text-sm text-muted-foreground">
                以下是你的性格分析结果
              </p>
            </div>

            <PersonalityProfile
              traits={results.traits}
              challenges={results.challenges}
              idealMatch={results.idealMatch}
              energyLevel={results.energyLevel || 75}
            />

            <Button 
              className="w-full" 
              size="lg"
              onClick={handleFinish}
              disabled={savePersonalityMutation.isPending}
              data-testid="button-finish-quiz"
            >
              {savePersonalityMutation.isPending ? "保存中..." : "完成并保存"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
