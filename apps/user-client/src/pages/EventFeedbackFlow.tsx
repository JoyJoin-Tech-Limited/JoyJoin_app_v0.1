import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, Sparkles, UtensilsCrossed, Wine, Calendar, Clock, MapPin, Users, Gift, Star, Target, CheckCircle2, Home, ThumbsUp, Meh, ThumbsDown } from "lucide-react";
import { motion } from "framer-motion";
import type { BlindBoxEvent, EventFeedback } from "@shared/schema";
import AtmosphereThermometer from "@/components/feedback/AtmosphereThermometer";
import SelectConnectionsStep from "@/components/feedback/SelectConnectionsStep";
import WechatIdSetupStep from "@/components/feedback/WechatIdSetupStep";
import ImprovementCards from "@/components/feedback/ImprovementCards";
import FeedbackCompletion from "@/components/feedback/FeedbackCompletion";
import { INTEREST_CATEGORIES, type HeatLevel } from "@/data/interestCarouselData";

type FeedbackStep = "intro" | "atmosphere" | "selectConnections" | "wechatIdSetup" | "venueStyle" | "improvement" | "interestRefresh" | "completion";

interface FeedbackData {
  atmosphereScore?: number;
  atmosphereNote?: string;
  connections?: string[];
  wechatContactId?: string | null;
  venueStyleRating?: "like" | "neutral" | "dislike";
  improvementAreas?: string[];
  improvementOther?: string;
}

export default function EventFeedbackFlow() {
  const { eventId } = useParams<{ eventId: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  const [currentStep, setCurrentStep] = useState<FeedbackStep>("intro");
  const [feedbackData, setFeedbackData] = useState<FeedbackData>({});
  const [mutualMatches, setMutualMatches] = useState<Array<{
    userId: string;
    displayName: string;
    archetype?: string;
    wechatContactId?: string | null;
  }>>([]);

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

  // Fetch current user to check if wechatContactId is already set
  // Using /api/auth/user — the canonical current-user endpoint
  const { data: currentUser, isLoading: isCurrentUserLoading } = useQuery<any>({ queryKey: ["/api/auth/user"] });

  // Submit feedback mutation
  const submitMutation = useMutation({
    mutationFn: async (data: FeedbackData) => {
      return await apiRequest("POST", `/api/events/${eventId}/feedback`, data);
    },
    onSuccess: (response: any) => {
      queryClient.invalidateQueries({ queryKey: [`/api/events/${eventId}/feedback`] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-feedbacks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      
      // Store mutual matches to display on completion screen
      if (response.mutualMatches && response.mutualMatches.length > 0) {
        setMutualMatches(response.mutualMatches);
      }
      
      setCurrentStep("interestRefresh");
    },
    onError: (error) => {
      toast({
        title: "提交失败",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const steps: FeedbackStep[] = ["intro", "atmosphere", "selectConnections", "wechatIdSetup", "venueStyle", "improvement", "interestRefresh", "completion"];

  // Build the actual visible step list based on whether the wechat step applies.
  // When currentUser is still loading we conservatively include wechatIdSetup so the
  // denominator doesn't shift once the query resolves.
  const userWechatAlreadySet = !isCurrentUserLoading && !!currentUser?.wechatContactId;
  const connectionsSelected = (feedbackData.connections?.length ?? 0) > 0;
  const showWechatStep = !userWechatAlreadySet && connectionsSelected;
  const visibleSteps: FeedbackStep[] = steps.filter(
    (s) => s !== "wechatIdSetup" || showWechatStep
  );
  const currentStepIndex = visibleSteps.indexOf(currentStep);
  const progressPercentage = (currentStepIndex / Math.max(1, visibleSteps.length - 1)) * 100;

  const handleNext = (stepData: Partial<FeedbackData>) => {
    const updatedData = { ...feedbackData, ...stepData };
    setFeedbackData(updatedData);

    if (currentStep === "intro") setCurrentStep("atmosphere");
    else if (currentStep === "atmosphere") setCurrentStep("selectConnections");
    else if (currentStep === "selectConnections") {
      const selectedSomeone = (updatedData.connections?.length ?? 0) > 0;
      // Only show wechat step once currentUser has loaded; if still loading, skip (safe default)
      const needsWechatSetup = !isCurrentUserLoading && !currentUser?.wechatContactId && selectedSomeone;
      setCurrentStep(needsWechatSetup ? "wechatIdSetup" : "venueStyle");
    }
    else if (currentStep === "wechatIdSetup") setCurrentStep("venueStyle");
    else if (currentStep === "venueStyle") setCurrentStep("improvement");
    else if (currentStep === "improvement") {
      // Submit feedback; on success moves to interestRefresh (see submitMutation.onSuccess)
      submitMutation.mutate(updatedData);
    }
  };

  const handleInterestRefresh = async (data: { boostedTopicIds: string[] }) => {
    if (data.boostedTopicIds.length > 0) {
      try {
        await apiRequest("PATCH", "/api/user/interests/nudge", {
          boostTopicIds: data.boostedTopicIds,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/user/interests"] });
        queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      } catch {
        // Silent fail — interest nudge is non-blocking
      }
    }
    setCurrentStep("completion");
  };

  const handleBack = () => {
    if (currentStep === "atmosphere") setCurrentStep("intro");
    else if (currentStep === "selectConnections") setCurrentStep("atmosphere");
    else if (currentStep === "wechatIdSetup") setCurrentStep("selectConnections");
    else if (currentStep === "venueStyle") {
      const hadWechatStepVisible = !isCurrentUserLoading && !currentUser?.wechatContactId && (feedbackData.connections?.length ?? 0) > 0;
      setCurrentStep(hadWechatStepVisible ? "wechatIdSetup" : "selectConnections");
    }
    else if (currentStep === "improvement") setCurrentStep("venueStyle");
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
    <div className="mobile-page">
      {/* Header */}
      {currentStep !== "completion" && (
        <header className="sticky top-0 z-10 bg-background border-b shrink-0">
          <div className="flex items-center justify-between p-2">
            <Button 
              variant="ghost" 
              size="default"
              className="min-w-[48px] min-h-[48px] p-2"
              onClick={handleBack}
              data-testid="button-back"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1 mx-3">
              <Progress value={progressPercentage} className="h-1.5" />
              <p className="text-xs text-muted-foreground text-center mt-1">
                {currentStepIndex}/{steps.length - 2}
              </p>
            </div>
            <div className="w-9" /> {/* Spacer for symmetry */}
          </div>
        </header>
      )}

      {/* Step Content */}
      <div className="mobile-content-compact overflow-y-auto">
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
        
        {currentStep === "wechatIdSetup" && (
          <WechatIdSetupStep onNext={handleNext} />
        )}
        
        {currentStep === "venueStyle" && (
          <VenueStyleStep
            venueName={event.restaurantName}
            initialRating={feedbackData.venueStyleRating}
            onNext={handleNext}
          />
        )}
        
        {currentStep === "improvement" && (
          <ImprovementCards
            initialAreas={feedbackData.improvementAreas}
            initialOther={feedbackData.improvementOther}
            onNext={handleNext}
            isSubmitting={submitMutation.isPending}
          />
        )}
        
        {currentStep === "interestRefresh" && (
          <InterestRefreshStep
            eventType={event?.eventType}
            onNext={handleInterestRefresh}
            onSkip={() => setCurrentStep("completion")}
          />
        )}
        
        {currentStep === "completion" && (
          <FeedbackCompletion 
            onDone={() => navigate("/events")}
            onDeepFeedback={() => navigate(`/events/${eventId}/deep-feedback`)}
            mutualMatches={mutualMatches}
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

// Venue Style Step Component - Simple rating for venue decoration style
function VenueStyleStep({ 
  venueName, 
  initialRating, 
  onNext 
}: { 
  venueName?: string | null; 
  initialRating?: "like" | "neutral" | "dislike"; 
  onNext: (data: { venueStyleRating: "like" | "neutral" | "dislike" }) => void;
}) {
  const [rating, setRating] = useState<"like" | "neutral" | "dislike" | null>(initialRating || null);

  const handleSubmit = () => {
    if (rating) {
      onNext({ venueStyleRating: rating });
    }
  };

  const ratingOptions = [
    { value: "like" as const, label: "喜欢", icon: ThumbsUp, color: "text-green-500", bgColor: "bg-green-500/10", borderColor: "border-green-500" },
    { value: "neutral" as const, label: "一般", icon: Meh, color: "text-amber-500", bgColor: "bg-amber-500/10", borderColor: "border-amber-500" },
    { value: "dislike" as const, label: "不太喜欢", icon: ThumbsDown, color: "text-red-500", bgColor: "bg-red-500/10", borderColor: "border-red-500" },
  ];

  return (
    <Card className="max-w-md mx-auto">
      <CardContent className="p-6 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <motion.div 
            className="mx-auto w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.4, ease: "backOut" }}
          >
            <Home className="h-7 w-7 text-primary" />
          </motion.div>
          <motion.h1 
            className="text-xl font-bold"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            场地风格评价
          </motion.h1>
          <motion.p 
            className="text-sm text-muted-foreground"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            {venueName ? `你觉得「${venueName}」的装修风格如何？` : "你喜欢这次活动场地的装修风格吗？"}
          </motion.p>
        </div>

        {/* Rating Options */}
        <div className="space-y-3">
          {ratingOptions.map((option, index) => {
            const IconComponent = option.icon;
            const isSelected = rating === option.value;
            
            return (
              <motion.button
                key={option.value}
                className={`w-full p-4 rounded-lg border-2 transition-all flex items-center gap-4
                  ${isSelected 
                    ? `${option.borderColor} ${option.bgColor}` 
                    : "border-muted hover-elevate"
                  }`}
                onClick={() => setRating(option.value)}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + index * 0.1 }}
                data-testid={`button-venue-style-${option.value}`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${option.bgColor}`}>
                  <IconComponent className={`h-5 w-5 ${option.color}`} />
                </div>
                <span className={`text-base font-medium ${isSelected ? option.color : ""}`}>
                  {option.label}
                </span>
              </motion.button>
            );
          })}
        </div>

        {/* Next Button */}
        <Button 
          onClick={handleSubmit}
          disabled={!rating}
          size="lg" 
          className="w-full"
          data-testid="button-venue-style-next"
        >
          下一步
        </Button>
      </CardContent>
    </Card>
  );
}

// Topic chip topics grouped by event type for the interest nudge step
const NUDGE_TOPICS_BY_EVENT_TYPE: Record<string, string[]> = {
  "饭局": ["lifestyle_food", "lifestyle_coffee", "culture_movies", "city_hidden_gems", "lifestyle_travel", "philosophy_meaning", "lifestyle_wine", "culture_live"],
  "酒局": ["lifestyle_wine", "city_bars", "culture_music", "city_hidden_gems", "lifestyle_coffee", "culture_standup", "city_walk", "culture_live"],
};

// Generic fallback topics shown when event type doesn't match
const NUDGE_TOPICS_FALLBACK = [
  "lifestyle_travel", "lifestyle_food", "culture_music", "philosophy_meaning",
  "career_networking", "lifestyle_sports", "culture_movies", "city_hidden_gems",
];

function getTopicsForEventType(eventType?: string): Array<{ id: string; emoji: string; label: string }> {
  const topicIds = (eventType && NUDGE_TOPICS_BY_EVENT_TYPE[eventType]) ?? NUDGE_TOPICS_FALLBACK;
  const result: Array<{ id: string; emoji: string; label: string }> = [];
  for (const id of topicIds) {
    for (const cat of INTEREST_CATEGORIES) {
      const topic = cat.topics.find(t => t.id === id);
      if (topic) {
        result.push({ id: topic.id, emoji: topic.emoji, label: topic.label });
        break;
      }
    }
  }
  return result;
}

interface InterestRefreshStepProps {
  eventType?: string;
  onNext: (data: { boostedTopicIds: string[] }) => void;
  onSkip: () => void;
}

function InterestRefreshStep({ eventType, onNext, onSkip }: InterestRefreshStepProps) {
  const [selectedTopicIds, setSelectedTopicIds] = useState<string[]>([]);
  const topics = getTopicsForEventType(eventType);

  const toggle = (topicId: string) => {
    setSelectedTopicIds(prev =>
      prev.includes(topicId) ? prev.filter(t => t !== topicId) : [...prev, topicId]
    );
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)] bg-background">
      <div className="flex-1 p-6 space-y-6">
        <div className="text-center space-y-2">
          <div className="text-4xl">🔥</div>
          <h2 className="text-xl font-bold">今晚点燃了哪些兴趣？</h2>
          <p className="text-sm text-muted-foreground">
            选出今晚让你更有共鸣的话题，帮我们为你匹配更好的活动
          </p>
        </div>

        {/* Topic chips grid */}
        <div className="flex flex-wrap gap-2 justify-center">
          {topics.map((topic) => {
            const isSelected = selectedTopicIds.includes(topic.id);
            return (
              <motion.button
                key={topic.id}
                onClick={() => toggle(topic.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-full border text-sm font-medium transition-colors ${
                  isSelected
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background border-muted-foreground/30 text-foreground hover:border-primary/50"
                }`}
                whileTap={{ scale: 0.95 }}
                data-testid={`nudge-topic-${topic.id}`}
              >
                <span>{topic.emoji}</span>
                <span>{topic.label}</span>
              </motion.button>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground text-center">
          选择的话题将帮助我们为你推荐更贴合的活动 ✨
        </p>
      </div>

      <div className="p-4 space-y-2 border-t">
        <Button
          onClick={() => onNext({ boostedTopicIds: selectedTopicIds })}
          className="w-full h-12 font-bold"
          data-testid="button-interest-refresh-confirm"
        >
          {selectedTopicIds.length > 0 ? `确认 (${selectedTopicIds.length} 个话题)` : "跳过"}
        </Button>
        {selectedTopicIds.length === 0 && (
          <Button variant="ghost" onClick={onSkip} className="w-full text-muted-foreground" data-testid="button-interest-refresh-skip">
            暂时跳过
          </Button>
        )}
      </div>
    </div>
  );
}
