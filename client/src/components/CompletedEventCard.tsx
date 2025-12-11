import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, DollarSign, Users, Star, MessageSquare, CheckCircle2, Sparkles } from "lucide-react";
import type { BlindBoxEvent, EventFeedback } from "@shared/schema";
import { getCurrencySymbol } from "@/lib/currency";
import { useLocation } from "wouter";

interface CompletedEventCardProps {
  event: BlindBoxEvent;
  feedback?: EventFeedback;
}

export default function CompletedEventCard({ event, feedback }: CompletedEventCardProps) {
  const [, setLocation] = useLocation();
  const currencySymbol = getCurrencySymbol(event.city as "香港" | "深圳");

  const formatDate = (dateTime: Date) => {
    const date = new Date(dateTime);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const weekday = weekdays[date.getDay()];
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${month}月${day}日 ${weekday} ${hours}:${minutes}`;
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
      className="border shadow-sm hover-elevate active-elevate-2 cursor-pointer relative overflow-hidden" 
      onClick={() => setLocation(`/blind-box-events/${event.id}`)}
      data-testid={`card-completed-${event.id}`}
    >
      {/* Status Badge - Top Right Corner */}
      <div className="absolute top-0 right-0 z-10">
        <div className="relative">
          <div className="absolute -top-1 -right-1">
            {hasFeedback ? (
              <Badge 
                variant="secondary" 
                className="rounded-full bg-primary/10 text-primary border-primary/30 font-semibold px-3 py-1 shadow-sm"
              >
                <Sparkles className="h-3 w-3 mr-1" />
                已反馈
              </Badge>
            ) : (
              <Badge 
                variant="secondary" 
                className="rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-semibold px-3 py-1 shadow-sm"
              >
                <CheckCircle2 className="h-3 w-3 mr-1" />
                已完成
              </Badge>
            )}
          </div>
        </div>
      </div>

      <CardContent className="p-4 space-y-3">
        {/* 标题 */}
        <div className="space-y-1 pr-20">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-base font-semibold flex-1">
              {formatDate(event.dateTime)} · {event.eventType}
            </h3>
            {event.isGirlsNight && (
              <Badge className="text-xs bg-pink-500 hover:bg-pink-600">
                👭 Girls Night
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
              variant="default"
              className="flex-1"
              onClick={(e) => {
                e.stopPropagation();
                setLocation(`/events/${event.id}/feedback`);
              }}
              data-testid={`button-give-feedback-${event.id}`}
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              分享反馈
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

        {/* Feedback Incentive (only if no feedback) */}
        {!hasFeedback && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/10">
            <span className="text-2xl">🎁</span>
            <div className="flex-1">
              <p className="text-xs font-medium text-primary">分享体验获得50积分</p>
              <p className="text-xs text-muted-foreground">帮助我们做得更好</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
