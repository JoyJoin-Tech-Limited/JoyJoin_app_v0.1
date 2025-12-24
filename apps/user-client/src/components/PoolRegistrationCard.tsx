import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, Users, Clock, Sparkles, XCircle, UserPlus, UserCheck } from "lucide-react";
import { format, parseISO } from "date-fns";
import { zhCN } from "date-fns/locale";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface PoolRegistration {
  id: string;
  poolId: string;
  matchStatus: "pending" | "matched" | "completed";
  assignedGroupId: string | null;
  matchScore: number | null;
  registeredAt: string;
  poolTitle: string;
  poolEventType: string;
  poolCity: string;
  poolDistrict: string;
  poolDateTime: string;
  poolStatus: string;
  budgetRange: string[];
  preferredLanguages: string[];
  socialGoals: string[];
  invitationRole?: "inviter" | "invitee" | null;
  relatedUserName?: string | null;
}

interface PoolRegistrationCardProps {
  registration: PoolRegistration;
}

export default function PoolRegistrationCard({ registration }: PoolRegistrationCardProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const poolDateTime = parseISO(registration.poolDateTime);
  
  const cancelMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("DELETE", `/api/pool-registrations/${registration.id}`);
    },
    onSuccess: () => {
      toast({
        title: "已取消报名",
        description: "你已成功取消此活动池报名",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/my-pool-registrations"] });
    },
    onError: (error: any) => {
      toast({
        title: "取消失败",
        description: error.message || "无法取消报名，请稍后再试",
        variant: "destructive",
      });
    },
  });
  
  const handleViewGroup = () => {
    if (registration.assignedGroupId) {
      setLocation(`/pool-groups/${registration.assignedGroupId}`);
    }
  };
  
  const getStatusBadge = () => {
    if (registration.matchStatus === "matched") {
      return <Badge className="bg-green-500 hover:bg-green-600">已匹配</Badge>;
    } else if (registration.matchStatus === "completed") {
      return <Badge variant="secondary">已完成</Badge>;
    } else {
      return <Badge variant="outline">匹配中</Badge>;
    }
  };

  const getMatchInfo = () => {
    if (registration.matchStatus === "matched" && registration.matchScore !== null) {
      return (
        <div className="flex items-center gap-2 text-sm">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-muted-foreground">
            匹配度: <span className="font-semibold text-foreground">{(registration.matchScore * 100).toFixed(0)}%</span>
          </span>
        </div>
      );
    }
    return null;
  };

  const getInvitationBadge = () => {
    if (registration.invitationRole === "inviter" && registration.relatedUserName) {
      return (
        <Badge variant="outline" className="bg-purple-50 dark:bg-purple-950 border-purple-300 dark:border-purple-800 text-purple-700 dark:text-purple-300">
          <UserPlus className="h-3 w-3 mr-1" />
          已邀请 {registration.relatedUserName}
        </Badge>
      );
    } else if (registration.invitationRole === "invitee" && registration.relatedUserName) {
      return (
        <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950 border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300">
          <UserCheck className="h-3 w-3 mr-1" />
          {registration.relatedUserName} 邀请的
        </Badge>
      );
    }
    return null;
  };

  return (
    <Card data-testid={`card-pool-registration-${registration.id}`}>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <CardTitle className="text-lg">{registration.poolTitle}</CardTitle>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Badge variant="secondary">{registration.poolEventType}</Badge>
              {getStatusBadge()}
              {getInvitationBadge()}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span>{format(poolDateTime, 'MM月dd日 EEEE HH:mm', { locale: zhCN })}</span>
        </div>
        
        <div className="flex items-center gap-2 text-sm">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <span>{registration.poolCity} · {registration.poolDistrict}</span>
        </div>

        {getMatchInfo()}

        {registration.matchStatus === "pending" && (
          <div className="pt-2 border-t space-y-3">
            <div className="text-sm text-muted-foreground space-y-1">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>AI正在为你寻找最佳匹配...</span>
              </div>
            </div>
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="w-full"
                  data-testid={`button-cancel-registration-${registration.id}`}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  取消报名
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>确认取消报名？</AlertDialogTitle>
                  <AlertDialogDescription>
                    你确定要取消报名吗？取消后需要重新报名才能参加此活动池。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel data-testid="button-cancel-dialog-cancel">取消</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => cancelMutation.mutate()}
                    disabled={cancelMutation.isPending}
                    data-testid="button-cancel-dialog-confirm"
                  >
                    {cancelMutation.isPending ? "取消中..." : "确认取消"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}

        {registration.matchStatus === "matched" && (
          <div className="pt-2">
            <Button 
              className="w-full" 
              size="sm"
              onClick={handleViewGroup}
              data-testid={`button-view-group-${registration.id}`}
            >
              <Users className="h-4 w-4 mr-2" />
              查看小组成员
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
