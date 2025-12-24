import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Clock, Sparkles, Check, X } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow, isPast } from "date-fns";
import { zhCN } from "date-fns/locale";

interface ReunionInvite {
  responseId: string;
  requestId: string;
  eventDescription: string;
  minParticipants: number;
  maxParticipants: number;
  currentAccepted: number;
  expiresAt: string;
  createdAt: string;
  status: string;
  originalEventId: string;
}

interface ReunionInviteCardProps {
  invite: ReunionInvite;
  onResponded?: () => void;
}

export default function ReunionInviteCard({ invite, onResponded }: ReunionInviteCardProps) {
  const { toast } = useToast();
  const [hasResponded, setHasResponded] = useState(false);

  const respondMutation = useMutation({
    mutationFn: async ({ accept }: { accept: boolean }) => {
      return apiRequest("POST", `/api/reunions/${invite.responseId}/respond`, { accept });
    },
    onSuccess: (data: any, variables) => {
      setHasResponded(true);
      toast({
        title: variables.accept ? "已接受邀请" : "已忽略邀请",
        description: variables.accept 
          ? `目前已有${data.currentAccepted}人接受邀请` 
          : "你可以在下次活动中再相遇",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/reunions/received'] });
      onResponded?.();
    },
    onError: (error: any) => {
      toast({
        title: "操作失败",
        description: error.message || "请稍后重试",
        variant: "destructive",
      });
    },
  });

  const expiresAt = new Date(invite.expiresAt);
  const isExpired = isPast(expiresAt);
  const timeLeft = formatDistanceToNow(expiresAt, { locale: zhCN, addSuffix: true });

  if (hasResponded || invite.status !== 'pending') {
    return null;
  }

  if (isExpired) {
    return null;
  }

  const progressPercent = Math.min(100, (invite.currentAccepted / invite.minParticipants) * 100);

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            有人想和你再约
          </CardTitle>
          <Badge variant="outline" className="text-xs flex-shrink-0">
            <Clock className="h-3 w-3 mr-1" />
            {timeLeft}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          上次活动的某位小伙伴想再聚，他们说：
        </p>
        <p className="text-sm font-medium">
          "{invite.eventDescription || '再约上次的好时光'}"
        </p>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              当前响应
            </span>
            <span>{invite.currentAccepted}/{invite.minParticipants}人成局</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </CardContent>
      
      <CardFooter className="gap-2">
        <Button 
          variant="outline" 
          className="flex-1"
          onClick={() => respondMutation.mutate({ accept: false })}
          disabled={respondMutation.isPending}
          data-testid="button-reunion-ignore"
        >
          <X className="h-4 w-4 mr-1" />
          暂时不了
        </Button>
        <Button 
          className="flex-1"
          onClick={() => respondMutation.mutate({ accept: true })}
          disabled={respondMutation.isPending}
          data-testid="button-reunion-accept"
        >
          <Check className="h-4 w-4 mr-1" />
          我要参加
        </Button>
      </CardFooter>
    </Card>
  );
}
