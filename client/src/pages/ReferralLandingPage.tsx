import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Gift, Star, Users, Sparkles } from "lucide-react";

interface ReferralData {
  inviter: {
    id: number;
    displayName: string;
    firstName: string;
  };
  code: string;
}

export default function ReferralLandingPage() {
  const { code } = useParams<{ code: string }>();
  const [, setLocation] = useLocation();

  const { data: referral, isLoading, error } = useQuery<ReferralData>({
    queryKey: ['/api/referrals', code],
    enabled: !!code,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-accent/10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !referral) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-background to-accent/10">
        <Card className="max-w-md w-full">
          <CardHeader>
            <h2 className="text-xl font-semibold text-center">邀请码无效</h2>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              该邀请链接不存在或已失效
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

  const { inviter } = referral;
  const inviterName = inviter.displayName || inviter.firstName || "好友";

  const handleJoin = () => {
    localStorage.setItem('referral_code', code!);
    setLocation("/");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-primary/5 p-4">
      <div className="max-w-md mx-auto pt-8 space-y-6">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-primary/10 mb-2">
            <Gift className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">
            {inviterName} 邀请你加入 JoyJoin
          </h1>
          <p className="text-muted-foreground">
            有趣的人在这里相遇，探索盲盒社交的惊喜
          </p>
        </div>

        <Card data-testid="card-new-user-benefits">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h2 className="font-semibold">新用户专属福利</h2>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-green-500/10">
              <div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                <Star className="h-5 w-5 text-green-600" />
              </div>
              <div className="flex-1">
                <div className="font-medium text-sm">首单 5 折优惠</div>
                <p className="text-xs text-muted-foreground">首次报名盲盒活动立享五折</p>
              </div>
              <Badge variant="secondary" className="text-xs">限时</Badge>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg bg-accent/30">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <div className="font-medium text-sm">认识有趣的人</div>
                <p className="text-xs text-muted-foreground">AI 智能匹配志同道合的新朋友</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Button 
          className="w-full"
          size="lg"
          onClick={handleJoin}
          data-testid="button-join-now"
        >
          立即加入
        </Button>

        <div className="text-center text-xs text-muted-foreground space-y-1">
          <p>通过好友邀请链接注册，双方都能获得奖励</p>
          <p>注册即表示同意 JoyJoin 的服务条款</p>
        </div>
      </div>
    </div>
  );
}
