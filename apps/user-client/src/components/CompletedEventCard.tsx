import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, DollarSign, Users, Star, MessageSquare, Check, Gift, Trophy } from "lucide-react";
import type { BlindBoxEvent, EventFeedback } from "@shared/schema";
import { getCurrencySymbol } from "@/lib/currency";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { formatDateInHongKong } from "@/lib/hongKongTime";

interface CompletedEventCardProps {
  event: BlindBoxEvent;
  feedback?: EventFeedback;
}

export default function CompletedEventCard({ event, feedback }: CompletedEventCardProps) {
  const [, setLocation] = useLocation();
  const currencySymbol = getCurrencySymbol(event.city as "香港" | "深圳");

  const formatDate = (dateTime: Date | string) => {
    return formatDateInHongKong(dateTime, 'full');
  };

  const getParticipantInfo = () => {
    if (event.isGirlsNight) {
      return `${event.totalParticipants}人 Girls Night`;
    }
    if (event.maleCount && event.femaleCount) {
      return `${event.totalParticipants}人（${event.maleCount}男${event.femaleCount}女）`;
    }
    return `${event.totalParticipants}人`;
  };

  // Extract individual scores from feedback
  const getFeedbackScores = () => {
    if (!feedback) return null;
    
    const scores: { label: string; score: number }[] = [];
    
    // Add atmosphere score (1-5)
    if (feedback.atmosphereScore) {
      scores.push({ label: "活动氛围", score: feedback.atmosphereScore });
    }
    
    // Add connection radar scores (1-5 each)
    if (feedback.connectionRadar && typeof feedback.connectionRadar === 'object') {
      const radar = feedback.connectionRadar as any;
      if (radar.topicResonance) scores.push({ label: "话题共鸣", score: radar.topicResonance });
      if (radar.personalityMatch) scores.push({ label: "性格契合", score: radar.personalityMatch });
      if (radar.backgroundDiversity) scores.push({ label: "背景多元", score: radar.backgroundDiversity });
      if (radar.overallFit) scores.push({ label: "整体匹配", score: radar.overallFit });
    }
    
    if (scores.length === 0) return null;
    
    const average = scores.reduce((a, b) => a + b.score, 0) / scores.length;
    return {
      scores,
      average: Math.round(average * 10) / 10,
    };
  };

  const feedbackScores = getFeedbackScores();
  const hasFeedback = !!feedback;

  return (
    <Card 
      className={`relative overflow-visible cursor-pointer transition-all duration-300 ${
        hasFeedback 
          ? "border-2 shadow-lg" 
          : "border-2 border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.2)]"
      }`}
      onClick={() => setLocation(`/blind-box-events/${event.id}`)}
      data-testid={`card-completed-${event.id}`}
    >
      {/* Subdued Corner Badge */}
      <div className="absolute -top-2 -right-2 z-20">
        {hasFeedback ? (
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-md">
            <Check className="h-6 w-6 text-white stroke-[2.5]" />
          </div>
        ) : (
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-fuchsia-500 flex items-center justify-center shadow-md">
            <Gift className="h-5 w-5 text-white" />
          </div>
        )}
      </div>

      <CardContent className="p-4 space-y-3">
        {/* Status Banner */}
        {hasFeedback ? (
          <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2">
            <Trophy className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">完美收官</span>
            <span className="text-xs text-muted-foreground ml-auto">感谢你的反馈</span>
          </div>
        ) : (
          <motion.div 
            className="flex items-center gap-2 bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-lg px-3 py-2 border border-amber-300 dark:border-amber-700"
            animate={{ 
              borderColor: ["rgba(251, 191, 36, 0.5)", "rgba(251, 191, 36, 1)", "rgba(251, 191, 36, 0.5)"]
            }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Gift className="h-5 w-5 text-amber-500" />
            <span className="font-semibold text-amber-600 dark:text-amber-400">积分待领</span>
            <Badge className="ml-auto bg-amber-500 text-white text-xs">50积分</Badge>
          </motion.div>
        )}

        {/* 标题 */}
        <div className="space-y-1">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-base font-semibold flex-1">
              {formatDate(event.dateTime)} · {event.eventType}
            </h3>
            {event.isGirlsNight && (
              <Badge className="text-xs bg-pink-500 hover:bg-pink-600 no-default-hover-elevate no-default-active-elevate">
                Girls Night
              </Badge>
            )}
          </div>
        </div>

        {/* Feedback Scores Display */}
        {hasFeedback && feedbackScores && (
          <div className="bg-primary/5 border border-primary/10 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                <span className="font-semibold text-amber-600 dark:text-amber-400">
                  {feedbackScores.average}
                </span>
                <span className="text-muted-foreground text-xs">/ 5.0</span>
              </div>
              <span className="text-xs text-primary font-medium">你的评分</span>
            </div>
            
            {/* Individual Scores */}
            <div className="grid grid-cols-2 gap-2">
              {feedbackScores.scores.map((item, index) => (
                <div key={index} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{item.label}</span>
                  <div className="flex items-center gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`h-3 w-3 ${
                          i < item.score
                            ? "fill-amber-400 text-amber-400"
                            : "text-muted-foreground/30"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 人数与性别 */}
        <div className="flex items-center gap-2 text-sm">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{getParticipantInfo()}</span>
        </div>

        {/* 地点 */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{event.restaurantName}</span>
          </div>
          <div className="text-xs text-muted-foreground pl-6">
            {event.city}•{event.district}
          </div>
        </div>

        {/* 预算档 */}
        <div className="flex items-center gap-2 text-sm">
          <DollarSign className="h-4 w-4 text-muted-foreground" />
          <span>{currencySymbol}{event.budgetTier}</span>
        </div>

        {/* 菜式标签 */}
        {event.cuisineTags && event.cuisineTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {event.cuisineTags.map((tag, index) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex gap-2 pt-2">
          {!hasFeedback && (
            <Button 
              size="sm" 
              className="flex-1 bg-gradient-to-r from-purple-600 to-fuchsia-500 text-white"
              onClick={(e) => {
                e.stopPropagation();
                setLocation(`/events/${event.id}/feedback`);
              }}
              data-testid={`button-give-feedback-${event.id}`}
            >
              <Gift className="h-4 w-4 mr-2" />
              领取积分
            </Button>
          )}
          
          <Button 
            size="sm" 
            variant={hasFeedback ? "default" : "outline"}
            className={hasFeedback ? "flex-1" : ""}
            onClick={(e) => {
              e.stopPropagation();
              setLocation(`/blind-box-events/${event.id}`);
            }}
            data-testid={`button-view-details-${event.id}`}
          >
            查看详情
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
