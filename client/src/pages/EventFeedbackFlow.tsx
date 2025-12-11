import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, Sparkles, UtensilsCrossed, Wine, Calendar, Clock, MapPin, Users, Gift, Star, Target, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import type { BlindBoxEvent, EventFeedback } from "@shared/schema";
import AtmosphereThermometer from "@/components/feedback/AtmosphereThermometer";
import SelectConnectionsStep from "@/components/feedback/SelectConnectionsStep";
import ImprovementCards from "@/components/feedback/ImprovementCards";
import FeedbackCompletion from "@/components/feedback/FeedbackCompletion";

type FeedbackStep = "intro" | "atmosphere" | "selectConnections" | "improvement" | "completion";

interface FeedbackData {
  atmosphereScore?: number;
  atmosphereNote?: string;
  connections?: string[];
  improvementAreas?: string[];
  improvementOther?: string;
}

export default function EventFeedbackFlow() {
  const { eventId } = useParams<{ eventId: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  const [currentStep, setCurrentStep] = useState<FeedbackStep>("intro");
  const [feedbackData, setFeedbackData] = useState<FeedbackData>({});

  // Fetch event details
  const { data: event, isLoading } = useQuery<BlindBoxEvent>({
    queryKey: [`/api/blind-box-events/${eventId}`],
    enabled: !!eventId,
  });

  // Check if feedback already exists
  const { data: existingFeedback } = useQuery<EventFeedback | null>({
    queryKey: [`/api/events/${eventId}/feedback`],
    enabled: !!eventId,
  });

  // Submit feedback mutation
  const submitMutation = useMutation({
    mutationFn: async (data: FeedbackData) => {
      return await apiRequest("POST", `/api/events/${eventId}/feedback`, data);
    },
    onSuccess: (response: any) => {
      queryClient.invalidateQueries({ queryKey: [`/api/events/${eventId}/feedback`] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-feedbacks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/direct-messages"] });
      
      // Check for mutual matches
      if (response.mutualMatches && response.mutualMatches.length > 0) {
        const matchCount = response.mutualMatches.length;
        const names = response.mutualMatches
          .map((m: any) => m.displayName || "某位参与者")
          .join("、");
        
        toast({
          title: "双向匹配成功！",
          description: `你和${names}互相选择了对方！现在可以开始1对1私聊了～`,
          duration: 6000,
        });
      }
      
      setCurrentStep("completion");
    },
    onError: (error) => {
      toast({
        title: "提交失败",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const steps: FeedbackStep[] = ["intro", "atmosphere", "selectConnections", "improvement", "completion"];
  const currentStepIndex = steps.indexOf(currentStep);
  const progressPercentage = (currentStepIndex / (steps.length - 1)) * 100;

  const handleNext = (stepData: Partial<FeedbackData>) => {
    const updatedData = { ...feedbackData, ...stepData };
    setFeedbackData(updatedData);

    if (currentStep === "intro") setCurrentStep("atmosphere");
    else if (currentStep === "atmosphere") setCurrentStep("selectConnections");
    else if (currentStep === "selectConnections") setCurrentStep("improvement");
    else if (currentStep === "improvement") {
      // Submit feedback
      submitMutation.mutate(updatedData);
    }
  };

  const handleBack = () => {
    if (currentStep === "atmosphere") setCurrentStep("intro");
    else if (currentStep === "selectConnections") setCurrentStep("atmosphere");
    else if (currentStep === "improvement") setCurrentStep("selectConnections");
    else if (currentStep === "intro") navigate("/events");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">加载中...</p>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">活动不存在</p>
            <Button onClick={() => navigate("/events")} className="mt-4">
              返回活动列表
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (existingFeedback && currentStep !== "completion") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card>
          <CardContent className="p-6 text-center space-y-4">
            <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
            <p className="font-medium">你已经完成了这次活动的反馈</p>
            <Button onClick={() => navigate("/events")}>
              返回活动列表
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      {currentStep !== "completion" && (
        <header className="sticky top-0 z-10 bg-background border-b">
          <div className="flex items-center justify-between p-4">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={handleBack}
              data-testid="button-back"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1 mx-4">
              <Progress value={progressPercentage} className="h-2" />
              <p className="text-xs text-muted-foreground text-center mt-2">
                {currentStepIndex}/{steps.length - 2}
              </p>
            </div>
            <div className="w-10" /> {/* Spacer for symmetry */}
          </div>
        </header>
      )}

      {/* Step Content */}
      <div className="p-4">
        {currentStep === "intro" && (
          <IntroStep event={event} onNext={() => handleNext({})} />
        )}
        
        {currentStep === "atmosphere" && (
          <AtmosphereThermometer
            initialScore={feedbackData.atmosphereScore}
            initialNote={feedbackData.atmosphereNote}
            onNext={handleNext}
          />
        )}
        
        {currentStep === "selectConnections" && event?.matchedAttendees && Array.isArray(event.matchedAttendees) ? (
          <SelectConnectionsStep
            attendees={event.matchedAttendees.map((a: any) => ({
              userId: a.userId,
              displayName: a.displayName,
              archetype: a.archetype,
              gender: a.gender,
              age: a.age,
              educationLevel: a.educationLevel,
              industry: a.industry,
              relationshipStatus: a.relationshipStatus,
            }))}
            initialConnections={feedbackData.connections}
            onNext={handleNext}
          />
        ) : null}
        
        {currentStep === "improvement" && (
          <ImprovementCards
            initialAreas={feedbackData.improvementAreas}
            initialOther={feedbackData.improvementOther}
            onNext={handleNext}
            isSubmitting={submitMutation.isPending}
          />
        )}
        
        {currentStep === "completion" && (
          <FeedbackCompletion 
            onDone={() => navigate("/events")}
            onDeepFeedback={() => navigate(`/events/${eventId}/deep-feedback`)}
          />
        )}
      </div>
    </div>
  );
}

// Intro Step Component
function IntroStep({ event, onNext }: { event: BlindBoxEvent; onNext: () => void }) {
  const eventDate = event.dateTime ? new Date(event.dateTime) : null;
  const formattedDate = eventDate 
    ? new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' }).format(eventDate)
    : '';
  const formattedTime = eventDate 
    ? new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit' }).format(eventDate)
    : '';
  
  const eventTypeIcon = event.eventType === '饭局' ? <UtensilsCrossed className="h-5 w-5" /> : <Wine className="h-5 w-5" />;
  const totalPeople = event.totalParticipants || 0;

  return (
    <Card className="max-w-md mx-auto">
      <CardContent className="p-6 space-y-5">
        {/* Header */}
        <div className="text-center space-y-2">
          <motion.div 
            className="mx-auto w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center"
            initial={{ scale: 0, rotate: -180, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ duration: 0.6, ease: "backOut" }}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            >
              <Sparkles className="h-7 w-7 text-primary" />
            </motion.div>
          </motion.div>
          <motion.h1 
            className="text-xl font-bold"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            分享你的活动体验
          </motion.h1>
          <motion.p 
            className="text-sm text-muted-foreground"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            约需2分钟，帮我们做得更好
          </motion.p>
        </div>

        {/* Event Info Card */}
        <div className="p-4 rounded-lg bg-muted/50 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            {eventTypeIcon}
            <span>{event.eventType}</span>
          </div>
          <div className="space-y-1 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>{formattedDate}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>{formattedTime}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              <span>{event.restaurantName || `${event.city} · ${event.district}`}</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span>{totalPeople}人参加</span>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <Button 
          onClick={onNext} 
          size="lg" 
          className="w-full"
          data-testid="button-start-feedback"
        >
          开始反馈
        </Button>
      </CardContent>
    </Card>
  );
}
