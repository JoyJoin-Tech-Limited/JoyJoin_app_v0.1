import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Users, 
  Share2, 
  Copy, 
  Check,
  Sparkles 
} from "lucide-react";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface InvitationCardProps {
  inviterName: string;
  inviterAvatar?: string;
  inviterArchetype?: string;
  eventTitle: string;
  eventType: string;
  city: string;
  district: string;
  dateTime: string;
  inviteCode: string;
  inviteLink: string;
  spotsRemaining?: number;
  maxSpots?: number;
  hasReachedLimit?: boolean;
  onShare?: () => void;
}

export function InvitationCard({
  inviterName,
  inviterAvatar,
  inviterArchetype,
  eventTitle,
  eventType,
  city,
  district,
  dateTime,
  inviteCode,
  inviteLink,
  spotsRemaining = 1,
  maxSpots = 1,
  hasReachedLimit = false,
  onShare,
}: InvitationCardProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      toast({
        title: "链接已复制",
        description: "快分享给好友吧！",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: "复制失败",
        description: "请手动复制链接",
        variant: "destructive",
      });
    }
  };

  const eventDate = new Date(dateTime);
  const isToday = new Date().toDateString() === eventDate.toDateString();
  const isTomorrow = new Date(Date.now() + 86400000).toDateString() === eventDate.toDateString();
  
  const dateLabel = isToday ? "今天" : isTomorrow ? "明天" : format(eventDate, "MM月dd日", { locale: zhCN });
  const dayOfWeek = format(eventDate, "EEEE", { locale: zhCN });
  const timeLabel = format(eventDate, "HH:mm");

  return (
    <Card className="overflow-hidden border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-background to-accent/10">
      <CardContent className="p-0">
        <div className="relative p-5 space-y-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12 ring-2 ring-primary/30 ring-offset-2 ring-offset-background">
              <AvatarImage src={inviterAvatar} alt={inviterName} />
              <AvatarFallback className="bg-primary/10 text-primary font-medium">
                {inviterName?.charAt(0) || "?"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground truncate">{inviterName}</span>
                <span className="text-muted-foreground text-sm">邀请你</span>
              </div>
              {inviterArchetype && (
                <Badge variant="outline" className="text-xs mt-1">
                  {inviterArchetype}
                </Badge>
              )}
            </div>
          </div>

          <div className="bg-card rounded-xl p-4 space-y-3 border">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-bold text-lg leading-tight">{eventTitle}</h3>
              <Badge className="shrink-0">
                {eventType}
              </Badge>
            </div>

            <div className="grid gap-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4 shrink-0" />
                <span>{dateLabel} {dayOfWeek}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4 shrink-0" />
                <span>{timeLabel}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4 shrink-0" />
                <span>{city} · {district}</span>
              </div>
            </div>
          </div>

          <div className="bg-accent/30 rounded-lg p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">
                {hasReachedLimit ? (
                  <span className="text-muted-foreground">名额已满</span>
                ) : (
                  <>还差 <span className="text-primary font-bold">{spotsRemaining}</span> 人成局</>
                )}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Sparkles className="h-4 w-4 text-amber-500" />
              <span className="text-xs text-muted-foreground">优先同桌</span>
            </div>
          </div>

          {!hasReachedLimit && (
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={handleCopyLink}
                data-testid="button-copy-invite-link"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    已复制
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    复制链接
                  </>
                )}
              </Button>
              <Button 
                className="flex-1"
                onClick={onShare}
                data-testid="button-share-invite"
              >
                <Share2 className="h-4 w-4 mr-2" />
                分享到微信
              </Button>
            </div>
          )}

          {hasReachedLimit && (
            <div className="text-center py-2">
              <p className="text-sm text-muted-foreground">
                你已邀请1位好友，每场活动最多携1位好友同桌
              </p>
            </div>
          )}

          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              邀请码: <span className="font-mono font-medium">{inviteCode}</span>
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function InvitationCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-muted animate-pulse" />
          <div className="space-y-2 flex-1">
            <div className="h-4 w-24 bg-muted rounded animate-pulse" />
            <div className="h-3 w-16 bg-muted rounded animate-pulse" />
          </div>
        </div>
        <div className="bg-muted/50 rounded-xl p-4 space-y-3">
          <div className="h-5 w-3/4 bg-muted rounded animate-pulse" />
          <div className="space-y-2">
            <div className="h-4 w-1/2 bg-muted rounded animate-pulse" />
            <div className="h-4 w-1/3 bg-muted rounded animate-pulse" />
          </div>
        </div>
        <div className="flex gap-2">
          <div className="h-10 flex-1 bg-muted rounded animate-pulse" />
          <div className="h-10 flex-1 bg-muted rounded animate-pulse" />
        </div>
      </CardContent>
    </Card>
  );
}
