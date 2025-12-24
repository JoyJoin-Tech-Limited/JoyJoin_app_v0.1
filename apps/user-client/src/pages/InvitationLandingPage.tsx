import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, MapPin, Calendar, Users, Clock, DollarSign, User } from "lucide-react";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";

interface InvitationData {
  inviter: {
    id: string;
    displayName: string;
    firstName: string;
    lastName: string;
  };
  event: {
    id: string;
    title: string;
    poolId: string;
    dateTime: string;
    location?: string;
    budget?: string[];
    status: string;
    groupId?: string;
  };
  invitationType: 'pre_match' | 'post_match';
  code: string;
}

export default function InvitationLandingPage() {
  const { code } = useParams<{ code: string }>();
  const [, setLocation] = useLocation();

  const { data: invitation, isLoading, error } = useQuery<InvitationData>({
    queryKey: ['/api/invitations', code],
    enabled: !!code,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-accent/10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-background to-accent/10">
        <Card className="max-w-md w-full">
          <CardHeader>
            <h2 className="text-xl font-semibold text-center">邀请已失效</h2>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              {error?.message || "该邀请链接不存在或已过期"}
            </p>
            <Button 
              onClick={() => setLocation("/")}
              data-testid="button-home"
            >
              返回首页
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { inviter, event, invitationType } = invitation;
  const inviterName = inviter.displayName || `${inviter.firstName} ${inviter.lastName}`;

  const handleAccept = () => {
    // Store invitation code for registration process
    localStorage.setItem('invitation_code', code!);
    
    if (invitationType === 'pre_match') {
      // Navigate to event pool registration with pre-filled data
      setLocation(`/event-pools/${event.poolId}/register?invite=${code}`);
    } else {
      // Post-match: direct join to existing group
      setLocation(`/pool-groups/${event.groupId}/join?invite=${code}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-accent/10 p-4">
      <div className="max-w-2xl mx-auto pt-8 space-y-6">
        {/* Hero Section */}
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-2">
            <User className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">
              {inviterName} 邀请你加入
            </h1>
          </div>
          <p className="text-muted-foreground">
            {invitationType === 'pre_match' 
              ? '一起报名参加盲盒活动，优先匹配到同一局'
              : '直接加入已匹配的活动小组'}
          </p>
        </div>

        {/* Event Details Card */}
        <Card>
          <CardHeader className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-xl font-semibold">{event.title}</h2>
              <Badge variant={event.status === 'matched' ? 'default' : 'secondary'}>
                {event.status === 'matched' ? '已匹配' : '等待匹配'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Time & Location */}
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span>
                  {format(new Date(event.dateTime), 'yyyy年MM月dd日 EEEE', { locale: zhCN })}
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span>
                  {format(new Date(event.dateTime), 'HH:mm')}
                </span>
              </div>
              {event.location && (
                <div className="flex items-center gap-3 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span>{event.location}</span>
                </div>
              )}
              {event.budget && event.budget.length > 0 && (
                <div className="flex items-center gap-3 text-sm">
                  <DollarSign className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex flex-wrap gap-1">
                    {event.budget.map((range) => (
                      <Badge key={range} variant="outline" className="text-xs">
                        {range}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Invitation Type Info */}
            <div className="bg-accent/30 rounded-lg p-4">
              {invitationType === 'pre_match' ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    <span className="font-medium text-sm">优先匹配</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    接受邀请后，系统会优先将你和 {inviterName} 匹配到同一活动小组
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    <span className="font-medium text-sm">直接加入</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    接受邀请后，你将直接加入 {inviterName} 所在的活动小组
                  </p>
                </div>
              )}
            </div>

            {/* Action Button */}
            <Button 
              className="w-full"
              size="lg"
              onClick={handleAccept}
              data-testid="button-accept-invite"
            >
              接受邀请
            </Button>
          </CardContent>
        </Card>

        {/* Info Footer */}
        <div className="text-center text-xs text-muted-foreground space-y-1">
          <p>通过邀请链接加入，让认识的人一起参加活动</p>
          <p>邀请成功后，邀请人将获得优惠券奖励</p>
        </div>
      </div>
    </div>
  );
}
