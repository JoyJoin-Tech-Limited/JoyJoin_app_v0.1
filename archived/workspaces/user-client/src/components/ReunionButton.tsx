import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Users, Sparkles, Clock, Crown } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ReunionButtonProps {
  eventId: string;
  onSuccess?: () => void;
}

export default function ReunionButton({ eventId, onSuccess }: ReunionButtonProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [eventDescription, setEventDescription] = useState("");
  const { toast } = useToast();

  const { data: eligibility, isLoading: checkingEligibility } = useQuery<{
    canReunion: boolean;
    reason?: string;
    code?: string;
    participantCount?: number;
    existingRequestId?: string;
  }>({
    queryKey: ['/api/reunions', eventId, 'eligibility'],
    queryFn: async () => {
      const response = await fetch(`/api/reunions/${eventId}/eligibility`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to check eligibility');
      }
      return response.json();
    },
    enabled: !!eventId,
  });

  const createReunionMutation = useMutation({
    mutationFn: async (data: { originalEventId: string; eventDescription: string }) => {
      return apiRequest("POST", "/api/reunions/create", data);
    },
    onSuccess: (data: any) => {
      toast({
        title: "发起成功",
        description: data.message || `已向${data.invitedCount}位活动参与者发送匿名邀请`,
      });
      setShowDialog(false);
      setEventDescription("");
      queryClient.invalidateQueries({ queryKey: ['/api/reunions', eventId, 'eligibility'] });
      onSuccess?.();
    },
    onError: (error: any) => {
      toast({
        title: "发起失败",
        description: error.message || "请稍后重试",
        variant: "destructive",
      });
    },
  });

  const handleCreateReunion = () => {
    createReunionMutation.mutate({
      originalEventId: eventId,
      eventDescription: eventDescription || "再约上次的好时光",
    });
  };

  if (checkingEligibility) {
    return null;
  }

  if (!eligibility?.canReunion) {
    if (eligibility?.code === "VIP_REQUIRED") {
      return (
        <Button 
          variant="outline" 
          className="w-full border-amber-500/50 text-amber-600 dark:text-amber-400"
          onClick={() => {
            toast({
              title: "VIP专属功能",
              description: "升级VIP即可使用一键再约功能，与聊得来的朋友再次相聚",
            });
          }}
          data-testid="button-reunion-vip-required"
        >
          <Crown className="h-4 w-4 mr-2" />
          一键再约
          <Badge variant="secondary" className="ml-2 text-xs">VIP</Badge>
        </Button>
      );
    }

    if (eligibility?.code === "REUNION_EXISTS") {
      return (
        <Button 
          variant="secondary" 
          className="w-full"
          disabled
          data-testid="button-reunion-in-progress"
        >
          <Users className="h-4 w-4 mr-2" />
          再约进行中
          <Clock className="h-4 w-4 ml-2 animate-pulse" />
        </Button>
      );
    }

    return null;
  }

  return (
    <>
      <Button 
        className="w-full bg-gradient-to-r from-primary to-primary/80"
        onClick={() => setShowDialog(true)}
        data-testid="button-reunion-initiate"
      >
        <Sparkles className="h-4 w-4 mr-2" />
        一键再约
        {eligibility.participantCount && (
          <Badge variant="secondary" className="ml-2 text-xs">
            {eligibility.participantCount}人
          </Badge>
        )}
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              发起一键再约
            </DialogTitle>
            <DialogDescription>
              系统会向上次活动的{eligibility.participantCount}位参与者发送匿名邀请，
              24小时内凑齐4人即可成局
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="description">给这次再约取个名字（可选）</Label>
              <Textarea
                id="description"
                placeholder="例如：咖啡续杯局、火锅重聚夜..."
                value={eventDescription}
                onChange={(e) => setEventDescription(e.target.value)}
                className="resize-none"
                rows={2}
                data-testid="input-reunion-description"
              />
            </div>
            
            <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Users className="h-4 w-4" />
                <span>需要至少4人接受邀请才能成局</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>邀请有效期24小时</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Sparkles className="h-4 w-4" />
                <span>邀请匿名发送，保持神秘感</span>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowDialog(false)}
              data-testid="button-reunion-cancel"
            >
              再想想
            </Button>
            <Button 
              onClick={handleCreateReunion}
              disabled={createReunionMutation.isPending}
              data-testid="button-reunion-confirm"
            >
              {createReunionMutation.isPending ? "发起中..." : "发起邀请"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
