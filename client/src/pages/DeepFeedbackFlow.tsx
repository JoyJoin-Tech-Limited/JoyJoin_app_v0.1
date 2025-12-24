import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import MatchPointValidation from "@/components/feedback/MatchPointValidation";
import ConversationDynamics from "@/components/feedback/ConversationDynamics";
import MatchingPreferences from "@/components/feedback/MatchingPreferences";
import DeepFeedbackCompletion from "@/components/feedback/DeepFeedbackCompletion";
import { Users, Briefcase, Globe, BookOpen } from "lucide-react";

interface DeepFeedbackData {
  matchPointValidation?: Record<string, { discussed: string; notes?: string }>;
  additionalMatchPoints?: string;
  conversationBalance?: number;
  conversationComfort?: number;
  conversationNotes?: string;
  futurePreferences?: string[];
  futurePreferencesOther?: string;
}

export default function DeepFeedbackFlow() {
  const { eventId } = useParams<{ eventId: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [currentStep, setCurrentStep] = useState(1);
  const [deepFeedbackData, setDeepFeedbackData] = useState<DeepFeedbackData>({});
  const [isCompleted, setIsCompleted] = useState(false);

  // Fetch event details
  const { data: event, isLoading: eventLoading } = useQuery({
    queryKey: ["/api/blind-box-events", eventId],
    enabled: !!eventId,
  });

  // Fetch existing feedback
  const { data: existingFeedback } = useQuery({
    queryKey: ["/api/events", eventId, "feedback"],
    enabled: !!eventId,
  });

  // Mock match points from event data
  const matchPoints = [
    {
      id: "overseas",
      label: "都有海外经历",
      icon: Globe,
      description: "在国外生活或工作的经历",
    },
    {
      id: "tech",
      label: "同为科技行业",
      icon: Briefcase,
      description: "从事科技或互联网相关工作",
    },
    {
      id: "reading",
      label: "都喜欢阅读",
      icon: BookOpen,
      description: "对书籍、知识获取有共同兴趣",
    },
  ];

  // Submit deep feedback mutation
  const submitMutation = useMutation({
    mutationFn: async (data: DeepFeedbackData) => {
      const response = await apiRequest(
        "POST",
        `/api/events/${eventId}/feedback/deep`,
        {
          hasDeepFeedback: true,
          matchPointValidation: data.matchPointValidation,
          additionalMatchPoints: data.additionalMatchPoints,
          conversationBalance: data.conversationBalance,
          conversationComfort: data.conversationComfort,
          conversationNotes: data.conversationNotes,
          futurePreferences: data.futurePreferences,
          futurePreferencesOther: data.futurePreferencesOther,
        }
      );
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "feedback"] });
      setIsCompleted(true);
    },
    onError: (error: any) => {
      toast({
        title: "提交失败",
        description: error.message || "无法保存深度反馈，请稍后重试",
        variant: "destructive",
      });
    },
  });

  // Handle step completion
  const handleStep1Complete = (data: { validation: any; additional: string }) => {
    setDeepFeedbackData(prev => ({
      ...prev,
      matchPointValidation: data.validation,
      additionalMatchPoints: data.additional,
    }));
    setCurrentStep(2);
  };

  const handleStep2Complete = (data: { balance: number; comfort: number; notes: string }) => {
    setDeepFeedbackData(prev => ({
      ...prev,
      conversationBalance: data.balance,
      conversationComfort: data.comfort,
      conversationNotes: data.notes,
    }));
    setCurrentStep(3);
  };

  const handleStep3Complete = (data: { preferences: string[]; other: string }) => {
    const finalData = {
      ...deepFeedbackData,
      futurePreferences: data.preferences,
      futurePreferencesOther: data.other,
    };
    setDeepFeedbackData(finalData);
    submitMutation.mutate(finalData);
  };

  const handleSkip = () => {
    if (currentStep < 3) {
      setCurrentStep(prev => prev + 1);
    } else {
      // Skip to completion
      submitMutation.mutate(deepFeedbackData);
    }
  };

  const handleDone = () => {
    navigate("/events");
  };

  const totalSteps = 3;
  const progress = (currentStep / totalSteps) * 100;

  if (eventLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">加载中...</p>
        </div>
      </div>
    );
  }

  if (isCompleted) {
    return <DeepFeedbackCompletion onDone={handleDone} />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/events")}
              data-testid="button-back"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              返回
            </Button>
            <Badge variant="outline" className="gap-1">
              <Sparkles className="h-3 w-3" />
              深度反馈
            </Badge>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">进度</span>
              <span className="font-medium">{currentStep}/{totalSteps}</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-2xl mx-auto px-4 py-10">
        <AnimatePresence mode="wait">
          {currentStep === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <MatchPointValidation
                matchPoints={matchPoints}
                initialData={deepFeedbackData.matchPointValidation}
                onNext={handleStep1Complete}
                onSkip={handleSkip}
              />
            </motion.div>
          )}

          {currentStep === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <ConversationDynamics
                initialData={{
                  balance: deepFeedbackData.conversationBalance,
                  comfort: deepFeedbackData.conversationComfort,
                  notes: deepFeedbackData.conversationNotes,
                }}
                onNext={handleStep2Complete}
                onSkip={handleSkip}
              />
            </motion.div>
          )}

          {currentStep === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <MatchingPreferences
                initialData={{
                  preferences: deepFeedbackData.futurePreferences,
                  other: deepFeedbackData.futurePreferencesOther,
                }}
                onNext={handleStep3Complete}
                onSkip={handleSkip}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading Overlay */}
        {submitMutation.isPending && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
            <Card>
              <CardContent className="p-6 flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-sm font-medium">正在提交你的深度反馈...</p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
